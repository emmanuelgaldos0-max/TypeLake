-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 8: credenciales descargables.
-- Guarda la contraseña vigente de cada alumno para que el administrador pueda
-- volver a descargarlas. Solo los administradores pueden leer esta tabla.
-- (Las contraseñas de alumnos son generadas por el sistema y no se reutilizan
--  en otros servicios; los administradores no tienen contraseña, entran con Google.)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.credenciales (
  alumno_id       uuid primary key references public.perfiles (id) on delete cascade,
  clave           text not null,
  actualizado_en  timestamptz not null default now()
);

alter table public.credenciales enable row level security;

drop policy if exists "admin credenciales" on public.credenciales;
create policy "admin credenciales" on public.credenciales for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.credenciales from anon;
