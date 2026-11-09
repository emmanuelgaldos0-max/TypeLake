-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Esquema inicial de la base de datos
-- Ejecutar una sola vez en Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────── 1. CONFIGURACIÓN GENERAL ─────────────────────────
-- Una sola fila con los ajustes que el administrador puede cambiar desde el panel.

create table public.configuracion (
  id                      boolean primary key default true check (id),
  anio_escolar            int     not null default extract(year from now())::int,
  -- Antitrampas: un intento es sospechoso si ppm > max(referencia × factor, referencia + margen)
  sospecha_factor         numeric not null default 2.0,
  sospecha_margen         numeric not null default 10,
  sospecha_repeticiones   int     not null default 3,     -- si repite la velocidad N veces, se acepta
  intentos_referencia     int     not null default 10,    -- la referencia es la mediana de los últimos N intentos válidos
  ppm_maximo              numeric not null default 150,   -- por encima de esto se considera imposible
  ritmo_variacion_minima  numeric not null default 0.15,  -- ritmo de teclas demasiado uniforme = robot
  -- Cómo ven los alumnos a sus compañeros en los rankings
  mostrar_nombres         text    not null default 'nombre_inicial'
                          check (mostrar_nombres in ('completo', 'nombre_inicial', 'anonimo')),
  actualizado_en          timestamptz not null default now()
);
insert into public.configuracion default values;


-- ───────────────────────── 2. GRADOS Y SALONES ─────────────────────────

create table public.grados (
  id           smallint generated always as identity primary key,
  nombre       text     not null unique,                 -- ej. "3.° de secundaria"
  orden        smallint not null default 0,              -- para ordenar en listas y gráficas
  nivel_texto  smallint not null default 1 check (nivel_texto between 1 and 4)  -- nivel sugerido
);

create table public.salones (
  id        int generated always as identity primary key,
  grado_id  smallint not null references public.grados (id),
  seccion   text     not null,                           -- ej. "A"
  anio      int      not null default extract(year from now())::int,
  unique (grado_id, seccion, anio)
);


-- ───────────────────────── 3. PERFILES (alumnos y administradores) ─────────────────────────
-- Cada fila está ligada a un usuario de Supabase Auth.
--  · Alumnos: los crea el administrador (usuario + contraseña).
--  · Administradores: entran con Google, solo si su correo está en admins_permitidos.

create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  rol        text not null check (rol in ('alumno', 'admin')),
  usuario    text unique,                                -- solo alumnos, ej. "jperez3a"
  nombres    text not null default '',
  apellidos  text not null default '',
  salon_id   int references public.salones (id),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
create index on public.perfiles (salon_id);

create table public.admins_permitidos (
  email        text primary key,
  agregado_en  timestamptz not null default now()
);


-- ───────────────────────── 4. BANCO DE TEXTOS ─────────────────────────

create table public.textos (
  id               int generated always as identity primary key,
  nivel            smallint not null check (nivel between 1 and 4),
  tema             text not null default 'general',
  contenido        text not null check (char_length(contenido) between 40 and 1000),
  activo           boolean not null default true,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references public.perfiles (id) on delete set null
);
create index on public.textos (nivel) where activo;


-- ───────────────────────── 5. MEDICIONES (solo en el colegio) ─────────────────────────
-- El admin crea una medición con un código. Solo cuentan los intentos hechos con ese
-- código dentro de la ventana de tiempo. Por alumno se guardan sus 5 mejores y 5 peores.

create table public.mediciones (
  id            int generated always as identity primary key,
  nombre        text not null,
  codigo        text not null unique check (codigo ~ '^[A-Z0-9]{4,8}$'),
  nivel         smallint not null check (nivel between 1 and 4),
  duracion_seg  smallint not null default 60 check (duracion_seg between 15 and 300),
  inicia_en     timestamptz not null,
  termina_en    timestamptz not null,
  escala_nota   jsonb,       -- conversión PPM → nota 0-20 (se define en la fase 6)
  creado_por    uuid references public.perfiles (id) on delete set null,
  creado_en     timestamptz not null default now(),
  check (termina_en > inicia_en)
);

-- Salones que pueden participar. Si una medición no tiene filas aquí, participan todos.
create table public.mediciones_salones (
  medicion_id  int not null references public.mediciones (id) on delete cascade,
  salon_id     int not null references public.salones (id) on delete cascade,
  primary key (medicion_id, salon_id)
);


-- ───────────────────────── 6. INTENTOS ─────────────────────────

create table public.intentos (
  id                 bigint generated always as identity primary key,
  alumno_id          uuid not null references public.perfiles (id) on delete cascade,
  salon_id           int references public.salones (id),          -- salón del alumno en ese momento
  modo               text not null check (modo in ('practica', 'medicion')),
  medicion_id        int references public.mediciones (id) on delete cascade,
  nivel              smallint not null,
  duracion_seg       smallint not null,
  ppm                numeric(5,1) not null,                       -- recalculado en el servidor
  ppm_bruta          numeric(5,1) not null,
  precision_pct      numeric(4,1) not null,
  correctos          int not null,
  incorrectos        int not null,
  pulsaciones        int not null,
  errores            int not null,
  errores_por_tecla  jsonb not null default '{}',
  senales            jsonb not null default '{}',                 -- datos crudos del antitrampas
  referencia_ppm     numeric(5,1),                                -- velocidad habitual del alumno en ese momento
  estado             text not null default 'valido'
                     check (estado in ('valido', 'sospechoso', 'aprobado', 'rechazado')),
  motivos            text[] not null default '{}',
  revisado_por       uuid references public.perfiles (id) on delete set null,
  revisado_en        timestamptz,
  creado_en          timestamptz not null default now(),
  check ((modo = 'medicion') = (medicion_id is not null))
);
create index on public.intentos (alumno_id, creado_en desc);
create index on public.intentos (medicion_id, alumno_id) where medicion_id is not null;
create index on public.intentos (creado_en) where estado = 'sospechoso';

-- Resumen diario de la práctica. En la fase 3 una tarea nocturna moverá aquí
-- los intentos de práctica antiguos para no llenar el plan gratuito.
create table public.resumen_practica (
  alumno_id           uuid not null references public.perfiles (id) on delete cascade,
  fecha               date not null,
  intentos            int not null,
  ppm_promedio        numeric(5,1) not null,
  ppm_max             numeric(5,1) not null,
  precision_promedio  numeric(4,1) not null,
  primary key (alumno_id, fecha)
);


-- ───────────────────────── 7. FÓRMULAS DE PROMEDIO DE SALÓN ─────────────────────────
-- tipo:
--   general         → promedio de todos los alumnos del salón
--   mejores_peores  → promedio de los X mejores + Y peores
--   top             → promedio de los X mejores
--   mediana         → mediana del salón
-- Siempre se usa 1 puntaje por alumno: su mejor intento válido.

create table public.formulas_promedio (
  id               int generated always as identity primary key,
  nombre           text not null,
  tipo             text not null check (tipo in ('general', 'mejores_peores', 'top', 'mediana')),
  mejores          smallint check (mejores >= 0),
  peores           smallint check (peores >= 0),
  fuente           text not null default 'mediciones' check (fuente in ('mediciones', 'todo')),
  medicion_id      int references public.mediciones (id) on delete set null,  -- null = todas
  sin_intentos     text not null default 'ignorar' check (sin_intentos in ('ignorar', 'cero')),
  visible_alumnos  boolean not null default false,
  creado_en        timestamptz not null default now()
);
insert into public.formulas_promedio (nombre, tipo, fuente, visible_alumnos)
values ('Promedio general', 'general', 'mediciones', true);


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCIONES
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;


-- Se ejecuta al crear un usuario en Supabase Auth.
-- Los datos del alumno van en app_metadata (el alumno no puede modificarlos).
create or replace function public.al_crear_usuario()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.raw_app_meta_data ->> 'rol' = 'alumno' then
    insert into perfiles (id, rol, usuario, nombres, apellidos, salon_id)
    values (
      new.id, 'alumno',
      new.raw_app_meta_data ->> 'usuario',
      coalesce(new.raw_app_meta_data ->> 'nombres', ''),
      coalesce(new.raw_app_meta_data ->> 'apellidos', ''),
      nullif(new.raw_app_meta_data ->> 'salon_id', '')::int
    );
  elsif exists (select 1 from admins_permitidos a where lower(a.email) = lower(new.email)) then
    insert into perfiles (id, rol, nombres)
    values (new.id, 'admin', coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  else
    raise exception 'Registro no permitido para %', new.email;
  end if;
  return new;
end;
$$;

create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.al_crear_usuario();


-- Registra un intento del alumno que ha iniciado sesión.
-- El servidor recalcula la velocidad, aplica el antitrampas y, si es medición,
-- valida el código y conserva solo los 5 mejores y 5 peores intentos del alumno.
create or replace function public.registrar_intento(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_alumno       perfiles%rowtype;
  v_cfg          configuracion%rowtype;
  v_med          mediciones%rowtype;
  v_modo         text     := 'practica';
  v_nivel        smallint := (p ->> 'nivel')::smallint;
  v_dur          smallint := (p ->> 'duracion_seg')::smallint;
  v_correctos    int      := greatest(0, coalesce((p ->> 'correctos')::int, 0));
  v_incorrectos  int      := greatest(0, coalesce((p ->> 'incorrectos')::int, 0));
  v_pulsaciones  int      := greatest(0, coalesce((p ->> 'pulsaciones')::int, 0));
  v_errores      int      := greatest(0, coalesce((p ->> 'errores')::int, 0));
  v_senales      jsonb    := coalesce(p -> 'senales', '{}'::jsonb);
  v_ppm          numeric;
  v_ppm_bruta    numeric;
  v_precision    numeric;
  v_ref          numeric;
  v_motivos      text[]   := '{}';
  v_estado       text;
  v_similares    int;
  v_id           bigint;
begin
  select * into v_alumno from perfiles where id = auth.uid() and rol = 'alumno' and activo;
  if not found then
    raise exception 'Solo los alumnos pueden registrar intentos';
  end if;
  select * into v_cfg from configuracion;

  -- ¿Es una medición?
  if coalesce(trim(p ->> 'codigo'), '') <> '' then
    select * into v_med from mediciones where codigo = upper(trim(p ->> 'codigo'));
    if not found then
      raise exception 'El código de medición no existe';
    end if;
    -- 2 minutos de tolerancia para quien empezó justo antes del cierre
    if now() < v_med.inicia_en or now() > v_med.termina_en + interval '2 minutes' then
      raise exception 'La medición no está abierta en este momento';
    end if;
    if exists (select 1 from mediciones_salones ms where ms.medicion_id = v_med.id)
       and not exists (select 1 from mediciones_salones ms
                       where ms.medicion_id = v_med.id and ms.salon_id = v_alumno.salon_id) then
      raise exception 'Tu salón no participa en esta medición';
    end if;
    v_modo  := 'medicion';
    v_nivel := v_med.nivel;
    v_dur   := v_med.duracion_seg;
  end if;

  if v_nivel is null or v_nivel not between 1 and 4 then
    raise exception 'Nivel no válido';
  end if;
  if v_dur is null or v_dur not between 15 and 300 then
    raise exception 'Duración no válida';
  end if;

  -- Evita enviar intentos más rápido de lo que dura una prueba
  if exists (select 1 from intentos i
             where i.alumno_id = v_alumno.id
               and i.creado_en > now() - make_interval(secs => v_dur - 5)) then
    raise exception 'Espera a terminar la prueba antes de registrar otra';
  end if;

  -- Recalcular en el servidor (no confiamos en la velocidad que envía el navegador)
  v_ppm       := round(v_correctos / 5.0 / (v_dur / 60.0), 1);
  v_ppm_bruta := round((v_correctos + v_incorrectos) / 5.0 / (v_dur / 60.0), 1);
  v_precision := case when v_pulsaciones > 0
                      then round((v_pulsaciones - least(v_errores, v_pulsaciones)) * 100.0 / v_pulsaciones, 1)
                      else 0 end;

  -- Señales de trampa
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

  -- Salto brusco respecto a su velocidad habitual
  select percentile_cont(0.5) within group (order by u.ppm) into v_ref
  from (select i.ppm from intentos i
        where i.alumno_id = v_alumno.id and i.estado in ('valido', 'aprobado')
        order by i.creado_en desc
        limit v_cfg.intentos_referencia) u;

  if v_ref is not null
     and v_ppm > greatest(v_ref * v_cfg.sospecha_factor, v_ref + v_cfg.sospecha_margen) then
    -- ¿Ya logró velocidades parecidas antes? Si se repite, es una mejora real.
    select count(*) into v_similares
    from intentos i
    where i.alumno_id = v_alumno.id
      and i.estado = 'sospechoso'
      and i.motivos = array['salto_brusco']
      and i.creado_en > now() - interval '14 days'
      and i.ppm between v_ppm * 0.8 and v_ppm * 1.2;

    if v_similares >= v_cfg.sospecha_repeticiones - 1 then
      update intentos i
         set estado = 'valido', motivos = array['validado_por_repeticion']
       where i.alumno_id = v_alumno.id
         and i.estado = 'sospechoso'
         and i.motivos = array['salto_brusco']
         and i.creado_en > now() - interval '14 days'
         and i.ppm between v_ppm * 0.8 and v_ppm * 1.2;
    else
      v_motivos := array_append(v_motivos, 'salto_brusco');
    end if;
  end if;

  v_estado := case when cardinality(v_motivos) = 0 then 'valido' else 'sospechoso' end;

  insert into intentos (
    alumno_id, salon_id, modo, medicion_id, nivel, duracion_seg,
    ppm, ppm_bruta, precision_pct, correctos, incorrectos, pulsaciones, errores,
    errores_por_tecla, senales, referencia_ppm, estado, motivos
  ) values (
    v_alumno.id, v_alumno.salon_id, v_modo, v_med.id, v_nivel, v_dur,
    v_ppm, v_ppm_bruta, v_precision, v_correctos, v_incorrectos, v_pulsaciones, v_errores,
    coalesce(p -> 'errores_por_tecla', '{}'::jsonb), v_senales, v_ref, v_estado, v_motivos
  )
  returning id into v_id;

  -- Medición: conservar solo los 5 mejores y 5 peores intentos válidos del alumno.
  -- (Los sospechosos se conservan hasta que el admin los revise.)
  if v_modo = 'medicion' then
    delete from intentos i
    where i.medicion_id = v_med.id
      and i.alumno_id = v_alumno.id
      and i.estado in ('valido', 'aprobado')
      and i.id not in (
        (select x.id from intentos x
          where x.medicion_id = v_med.id and x.alumno_id = v_alumno.id and x.estado in ('valido', 'aprobado')
          order by x.ppm desc, x.id limit 5)
        union
        (select x.id from intentos x
          where x.medicion_id = v_med.id and x.alumno_id = v_alumno.id and x.estado in ('valido', 'aprobado')
          order by x.ppm asc, x.id limit 5)
      );
  end if;

  return jsonb_build_object(
    'id', v_id,
    'estado', v_estado,
    'motivos', to_jsonb(v_motivos),
    'ppm', v_ppm,
    'precision', v_precision,
    'referencia', v_ref,
    'medicion', case when v_modo = 'medicion' then v_med.nombre end
  );
end;
$$;


-- Mejor puntaje válido de cada alumno. Uso interno de las otras funciones.
create or replace function public.puntajes_alumnos(p_fuente text default 'todo', p_medicion_id int default null)
returns table (alumno_id uuid, salon_id int, mejor_ppm numeric)
language sql stable security definer set search_path = public
as $$
  select i.alumno_id, p.salon_id, max(i.ppm)
  from intentos i
  join perfiles p on p.id = i.alumno_id
  where i.estado in ('valido', 'aprobado')
    and p.activo
    and (p_fuente = 'todo' or i.modo = 'medicion')
    and (p_medicion_id is null or i.medicion_id = p_medicion_id)
  group by i.alumno_id, p.salon_id;
$$;


-- Promedio de cada salón según una fórmula guardada.
create or replace function public.promedio_salones(p_formula_id int)
returns table (salon_id int, grado text, seccion text, alumnos int, con_puntaje int, considerados int, promedio numeric)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  f formulas_promedio%rowtype;
begin
  select * into f from formulas_promedio where id = p_formula_id;
  if not found then
    raise exception 'Fórmula no encontrada';
  end if;
  if not es_admin() and not f.visible_alumnos then
    raise exception 'No autorizado';
  end if;

  return query
  with salones_anio as (
    select s.id, s.seccion, g.nombre as grado, g.orden
    from salones s join grados g on g.id = s.grado_id
    where s.anio = (select c.anio_escolar from configuracion c)
  ),
  puntajes as (
    select p.salon_id as sid,
           case when pa.mejor_ppm is null and f.sin_intentos = 'cero' then 0 else pa.mejor_ppm end as ppm,
           pa.mejor_ppm is not null as tiene
    from perfiles p
    join salones_anio sa on sa.id = p.salon_id
    left join puntajes_alumnos(f.fuente, f.medicion_id) pa on pa.alumno_id = p.id
    where p.rol = 'alumno' and p.activo
  ),
  ordenados as (
    select pu.sid, pu.ppm,
           row_number() over (partition by pu.sid order by pu.ppm desc) as rn_desc,
           row_number() over (partition by pu.sid order by pu.ppm asc)  as rn_asc
    from puntajes pu
    where pu.ppm is not null
  ),
  elegidos as (
    select o.sid, o.ppm from ordenados o
    where f.tipo in ('general', 'mediana')
       or (f.tipo = 'top' and o.rn_desc <= coalesce(f.mejores, 10))
       or (f.tipo = 'mejores_peores'
           and (o.rn_desc <= coalesce(f.mejores, 0) or o.rn_asc <= coalesce(f.peores, 0)))
  )
  select sa.id,
         sa.grado,
         sa.seccion,
         (select count(*) from puntajes x where x.sid = sa.id)::int,
         (select count(*) from puntajes x where x.sid = sa.id and x.tiene)::int,
         (select count(*) from elegidos e where e.sid = sa.id)::int,
         (select round(case when f.tipo = 'mediana'
                            then (percentile_cont(0.5) within group (order by e.ppm))::numeric
                            else avg(e.ppm) end, 1)
            from elegidos e where e.sid = sa.id)
  from salones_anio sa
  order by sa.orden, sa.grado, sa.seccion;
end;
$$;


-- Ranking de alumnos para las gráficas de barras.
-- p_alcance: 'salon' | 'grado' | 'colegio'. p_limite: 10, 20... o null para todos.
-- El propio alumno siempre aparece aunque esté fuera del límite.
create or replace function public.ranking_alumnos(p_alcance text default 'salon', p_limite int default null, p_fuente text default 'todo')
returns table (posicion int, alumno text, salon text, mejor_ppm numeric, soy_yo boolean)
language sql stable security definer set search_path = public
as $$
  with yo as (
    select p.id, p.salon_id, s.grado_id
    from perfiles p left join salones s on s.id = p.salon_id
    where p.id = auth.uid()
  ),
  cfg as (select c.mostrar_nombres from configuracion c),
  pts as (
    select pa.alumno_id, pa.salon_id, pa.mejor_ppm, p.nombres, p.apellidos,
           s.grado_id, s.seccion, g.nombre as grado
    from puntajes_alumnos(p_fuente, null) pa
    join perfiles p on p.id = pa.alumno_id
    join salones s on s.id = pa.salon_id
    join grados g on g.id = s.grado_id
    where s.anio = (select c.anio_escolar from configuracion c)
  ),
  filtrados as (
    select pts.* from pts left join yo on true
    where p_alcance = 'colegio'
       or (p_alcance = 'grado' and pts.grado_id = yo.grado_id)
       or (p_alcance = 'salon' and pts.salon_id = yo.salon_id)
  ),
  posiciones as (
    select f.*, (rank() over (order by f.mejor_ppm desc))::int as pos from filtrados f
  )
  select r.pos,
         case
           when r.alumno_id = auth.uid() or public.es_admin() then trim(r.nombres || ' ' || r.apellidos)
           when cfg.mostrar_nombres = 'completo' then trim(r.nombres || ' ' || r.apellidos)
           when cfg.mostrar_nombres = 'nombre_inicial'
             then trim(split_part(r.nombres, ' ', 1) || ' ' || left(r.apellidos, 1) || '.')
           else 'Alumno ' || r.pos
         end,
         r.grado || ' ' || r.seccion,
         r.mejor_ppm,
         r.alumno_id = auth.uid()
  from posiciones r cross join cfg
  where p_limite is null or r.pos <= p_limite or r.alumno_id = auth.uid()
  order by r.pos;
$$;


-- Permisos de ejecución: nada para visitantes anónimos.
revoke execute on function public.es_admin()                         from public, anon;
revoke execute on function public.al_crear_usuario()                 from public, anon, authenticated;
revoke execute on function public.registrar_intento(jsonb)           from public, anon;
revoke execute on function public.puntajes_alumnos(text, int)        from public, anon, authenticated;
revoke execute on function public.promedio_salones(int)              from public, anon;
revoke execute on function public.ranking_alumnos(text, int, text)   from public, anon;
grant  execute on function public.es_admin()                         to authenticated;
grant  execute on function public.registrar_intento(jsonb)           to authenticated;
grant  execute on function public.promedio_salones(int)              to authenticated;
grant  execute on function public.ranking_alumnos(text, int, text)   to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- SEGURIDAD POR FILAS (RLS)
-- Alumno: ve solo lo suyo. Admin: ve y edita todo.
-- Los intentos solo se crean a través de registrar_intento().
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.configuracion       enable row level security;
alter table public.grados              enable row level security;
alter table public.salones             enable row level security;
alter table public.perfiles            enable row level security;
alter table public.admins_permitidos   enable row level security;
alter table public.textos              enable row level security;
alter table public.mediciones          enable row level security;
alter table public.mediciones_salones  enable row level security;
alter table public.intentos            enable row level security;
alter table public.resumen_practica    enable row level security;
alter table public.formulas_promedio   enable row level security;

-- Lectura general para usuarios con sesión
create policy "leer configuracion" on public.configuracion for select to authenticated using (true);
create policy "leer grados"        on public.grados        for select to authenticated using (true);
create policy "leer salones"       on public.salones       for select to authenticated using (true);

-- Los textos activos se pueden leer sin sesión (práctica libre sin cuenta)
create policy "leer textos activos" on public.textos for select to anon, authenticated
  using (activo or public.es_admin());

-- Cada uno ve su perfil; el admin ve todos
create policy "leer perfil propio" on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());

-- Cada alumno ve sus intentos y su resumen
create policy "leer intentos propios" on public.intentos for select to authenticated
  using (alumno_id = auth.uid() or public.es_admin());
create policy "leer resumen propio" on public.resumen_practica for select to authenticated
  using (alumno_id = auth.uid() or public.es_admin());

-- Fórmulas visibles para alumnos
create policy "leer formulas visibles" on public.formulas_promedio for select to authenticated
  using (visible_alumnos or public.es_admin());

-- El administrador puede hacer todo
create policy "admin configuracion"      on public.configuracion      for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin grados"             on public.grados             for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin salones"            on public.salones            for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin perfiles"           on public.perfiles           for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin admins_permitidos"  on public.admins_permitidos  for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin textos"             on public.textos             for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin mediciones"         on public.mediciones         for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin mediciones_salones" on public.mediciones_salones for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin intentos"           on public.intentos           for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin resumen_practica"   on public.resumen_practica   for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "admin formulas"           on public.formulas_promedio  for all to authenticated using (public.es_admin()) with check (public.es_admin());
