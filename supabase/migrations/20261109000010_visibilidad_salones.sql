-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 10: visibilidad de otros salones.
-- Activado (por defecto, como hasta ahora): los alumnos ven rankings de su grado y
-- de todo el colegio. Desactivado: solo ven nombres y puntajes de su propio salón;
-- del resto del colegio solo el promedio por salón y el puntaje más alto (sin nombre).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.configuracion
  add column if not exists ver_otros_salones boolean not null default true;


-- Ranking de alumnos: igual que antes, pero respeta ver_otros_salones.
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
  -- Si el admin desactivó "ver otros salones", los alumnos solo ven su salón
  alc as (
    select case when public.es_admin() or c.ver_otros_salones then p_alcance else 'salon' end as a
    from configuracion c
  ),
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
    select pts.* from pts left join yo on true cross join alc
    where alc.a = 'colegio'
       or (alc.a = 'grado' and pts.grado_id = yo.grado_id)
       or (alc.a = 'salon' and pts.salon_id = yo.salon_id)
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


-- Puntaje más alto del colegio (sin decir de quién es).
create or replace function public.mejor_puntaje_colegio(p_fuente text default 'todo')
returns numeric
language sql stable security definer set search_path = public
as $$
  select max(pa.mejor_ppm)
  from puntajes_alumnos(p_fuente, null) pa
  join perfiles p on p.id = pa.alumno_id and p.activo
  join salones s on s.id = pa.salon_id
  where s.anio = (select c.anio_escolar from configuracion c);
$$;

revoke execute on function public.mejor_puntaje_colegio(text) from public, anon;
grant  execute on function public.mejor_puntaje_colegio(text) to authenticated;
