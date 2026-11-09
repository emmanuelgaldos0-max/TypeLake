-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 14: resultado del profesor como inspiración.
-- Las pruebas del admin se guardan en una tabla APARTE (no en intentos), así que
-- nunca cuentan para promedios, rankings, récords ni mediciones de ningún salón.
-- El admin decide si los alumnos ven su récord (desactivado por defecto).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.configuracion
  add column if not exists mostrar_profesor boolean not null default false;

create table if not exists public.resultados_profesor (
  id             bigint generated always as identity primary key,
  admin_id       uuid not null references public.perfiles (id) on delete cascade,
  ppm            numeric(5,1) not null check (ppm >= 0 and ppm <= 300),
  precision_pct  numeric(4,1) check (precision_pct between 0 and 100),
  creado_en      timestamptz not null default now()
);

alter table public.resultados_profesor enable row level security;

-- Solo el admin lee y escribe; los alumnos reciben el récord ya calculado desde el servidor.
create policy "admin resultados profesor" on public.resultados_profesor
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
