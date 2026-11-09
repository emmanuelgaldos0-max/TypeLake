-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 9: alumnos evaluados sin nota.
-- En el Excel de mediciones, una celda con x, W, Justify u otra marca significa que
-- al alumno sí se le intentó evaluar pero decidió no dar su evaluación. No es un
-- puntaje (no entra en promedios ni cuenta como 0), pero sí cuenta como evaluado.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.evaluados_sin_nota (
  medicion_id  int  not null references public.mediciones (id) on delete cascade,
  alumno_id    uuid not null references public.perfiles (id) on delete cascade,
  marcas       text[] not null default '{}',   -- lo que decía el Excel: {"x", "Justify"}
  creado_en    timestamptz not null default now(),
  primary key (medicion_id, alumno_id)
);

alter table public.evaluados_sin_nota enable row level security;

drop policy if exists "leer evaluados sin nota" on public.evaluados_sin_nota;
create policy "leer evaluados sin nota" on public.evaluados_sin_nota for select to authenticated
  using (alumno_id = auth.uid() or public.es_admin());

drop policy if exists "admin evaluados sin nota" on public.evaluados_sin_nota;
create policy "admin evaluados sin nota" on public.evaluados_sin_nota for all to authenticated
  using (public.es_admin()) with check (public.es_admin());


-- Promedio de cada salón: igual que antes, pero quien no quiso dar nota no cuenta como 0.
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
           -- "Sin nota cuenta como 0" no se aplica a quien fue evaluado y decidió no dar nota
           case when pa.mejor_ppm is null and f.sin_intentos = 'cero'
                     and not exists (select 1 from evaluados_sin_nota e
                                     where e.alumno_id = p.id
                                       and (f.fuente = 'todo' or f.medicion_id is null or e.medicion_id = f.medicion_id))
                then 0 else pa.mejor_ppm end as ppm,
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
