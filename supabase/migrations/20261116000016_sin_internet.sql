-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 16: app de escritorio para PCs sin internet.
-- · origen_id: identificador único de cada intento hecho sin internet, para que
--   subir dos veces el mismo archivo no duplique nada.
-- · hashes_alumnos(): contraseñas cifradas (bcrypt) para que la app pueda
--   comprobar usuario y contraseña sin conexión. Solo la llama el servidor.
-- · importar_intento_offline(): registra un intento con el mismo antitrampas que
--   registrar_intento, pero con el alumno y la fecha del archivo. Solo el servidor.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.intentos add column if not exists origen_id uuid unique;

create or replace function public.hashes_alumnos()
returns table (id uuid, hash text)
language sql stable security definer set search_path = public, auth
as $$
  select u.id, u.encrypted_password::text
  from auth.users u
  join public.perfiles p on p.id = u.id
  where p.rol = 'alumno' and p.activo and u.encrypted_password is not null;
$$;

revoke execute on function public.hashes_alumnos() from public, anon, authenticated;
grant  execute on function public.hashes_alumnos() to service_role;


create or replace function public.importar_intento_offline(p jsonb)
returns text   -- 'valido' | 'sospechoso' | 'duplicado'
language plpgsql security definer set search_path = public
as $$
declare
  v_alumno       perfiles%rowtype;
  v_cfg          configuracion%rowtype;
  v_origen       uuid     := (p ->> 'origen_id')::uuid;
  v_creado       timestamptz := (p ->> 'creado_en')::timestamptz;
  v_med_id       int      := nullif(p ->> 'medicion_id', '')::int;
  v_modo         text     := case when nullif(p ->> 'medicion_id', '') is null then 'practica' else 'medicion' end;
  v_dur          smallint := (p ->> 'duracion_seg')::smallint;
  v_correctos    int      := greatest(0, coalesce((p ->> 'correctos')::int, 0));
  v_incorrectos  int      := greatest(0, coalesce((p ->> 'incorrectos')::int, 0));
  v_pulsaciones  int      := greatest(0, coalesce((p ->> 'pulsaciones')::int, 0));
  v_errores      int      := greatest(0, coalesce((p ->> 'errores')::int, 0));
  v_senales      jsonb    := coalesce(p -> 'senales', '{}'::jsonb) || '{"sin_internet": true}'::jsonb;
  v_ppm          numeric;
  v_ppm_bruta    numeric;
  v_precision    numeric;
  v_ref          numeric;
  v_motivos      text[]   := '{}';
  v_similares    int;
begin
  if v_origen is null or v_creado is null then
    raise exception 'Intento sin identificador o fecha';
  end if;
  if exists (select 1 from intentos where origen_id = v_origen) then
    return 'duplicado';
  end if;
  select * into v_alumno from perfiles where id = (p ->> 'alumno_id')::uuid and rol = 'alumno';
  if not found then
    raise exception 'Alumno no encontrado';
  end if;
  if v_med_id is not null and not exists (select 1 from mediciones where id = v_med_id) then
    raise exception 'Medición no encontrada';
  end if;
  if v_dur is null or v_dur not between 15 and 300 then
    raise exception 'Duración no válida';
  end if;
  if v_creado > now() + interval '1 day' then
    v_creado := now();  -- reloj de la PC adelantado
  end if;
  select * into v_cfg from configuracion;

  v_ppm       := round(v_correctos / 5.0 / (v_dur / 60.0), 1);
  v_ppm_bruta := round((v_correctos + v_incorrectos) / 5.0 / (v_dur / 60.0), 1);
  v_precision := case when v_pulsaciones > 0
                      then round((v_pulsaciones - least(v_errores, v_pulsaciones)) * 100.0 / v_pulsaciones, 1)
                      else 0 end;

  if v_correctos + v_incorrectos > v_pulsaciones then
    v_motivos := array_append(v_motivos, 'datos_inconsistentes');
  end if;
  if v_ppm > v_cfg.ppm_maximo then
    v_motivos := array_append(v_motivos, 'velocidad_imposible');
  end if;
  if (v_senales ->> 'variacionRitmo') is not null
     and (v_senales ->> 'variacionRitmo')::numeric < v_cfg.ritmo_variacion_minima then
    v_motivos := array_append(v_motivos, 'ritmo_robotico');
  end if;
  if coalesce((v_senales ->> 'insercionesMasivas')::int, 0) > 0 then
    v_motivos := array_append(v_motivos, 'insercion_masiva');
  end if;
  if v_modo = 'medicion' and coalesce((v_senales ->> 'salidasPestana')::int, 0) > 0 then
    v_motivos := array_append(v_motivos, 'salio_de_la_pestana');
  end if;

  -- Velocidad habitual del alumno ANTES de este intento
  select percentile_cont(0.5) within group (order by u.ppm) into v_ref
  from (select i.ppm from intentos i
        where i.alumno_id = v_alumno.id and i.estado in ('valido', 'aprobado') and i.creado_en < v_creado
        order by i.creado_en desc
        limit v_cfg.intentos_referencia) u;

  if v_ref is not null
     and v_ppm > greatest(v_ref * v_cfg.sospecha_factor, v_ref + v_cfg.sospecha_margen) then
    select count(*) into v_similares
    from intentos i
    where i.alumno_id = v_alumno.id
      and i.estado = 'sospechoso'
      and i.motivos = array['salto_brusco']
      and i.creado_en between v_creado - interval '14 days' and v_creado
      and i.ppm between v_ppm * 0.8 and v_ppm * 1.2;

    if v_similares >= v_cfg.sospecha_repeticiones - 1 then
      update intentos i
         set estado = 'valido', motivos = array['validado_por_repeticion']
       where i.alumno_id = v_alumno.id
         and i.estado = 'sospechoso'
         and i.motivos = array['salto_brusco']
         and i.creado_en between v_creado - interval '14 days' and v_creado
         and i.ppm between v_ppm * 0.8 and v_ppm * 1.2;
    else
      v_motivos := array_append(v_motivos, 'salto_brusco');
    end if;
  end if;

  insert into intentos (
    alumno_id, salon_id, modo, medicion_id, duracion_seg,
    ppm, ppm_bruta, precision_pct, correctos, incorrectos, pulsaciones, errores,
    errores_por_tecla, senales, referencia_ppm, estado, motivos, origen_id, creado_en
  ) values (
    v_alumno.id, v_alumno.salon_id, v_modo, v_med_id, v_dur,
    v_ppm, v_ppm_bruta, v_precision, v_correctos, v_incorrectos, v_pulsaciones, v_errores,
    coalesce(p -> 'errores_por_tecla', '{}'::jsonb), v_senales, v_ref,
    case when cardinality(v_motivos) = 0 then 'valido' else 'sospechoso' end,
    v_motivos, v_origen, v_creado
  );

  -- En una medición se guardan solo los 5 mejores y 5 peores intentos válidos (igual que en línea)
  if v_modo = 'medicion' then
    delete from intentos i
    where i.medicion_id = v_med_id
      and i.alumno_id = v_alumno.id
      and i.estado in ('valido', 'aprobado')
      and i.id not in (
        (select x.id from intentos x
          where x.medicion_id = v_med_id and x.alumno_id = v_alumno.id and x.estado in ('valido', 'aprobado')
          order by x.ppm desc, x.id limit 5)
        union
        (select x.id from intentos x
          where x.medicion_id = v_med_id and x.alumno_id = v_alumno.id and x.estado in ('valido', 'aprobado')
          order by x.ppm asc, x.id limit 5)
      );
  end if;

  return case when cardinality(v_motivos) = 0 then 'valido' else 'sospechoso' end;
end;
$$;

revoke execute on function public.importar_intento_offline(jsonb) from public, anon, authenticated;
grant  execute on function public.importar_intento_offline(jsonb) to service_role;
