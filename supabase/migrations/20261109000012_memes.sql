-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 12: memes en el resultado de cada intento.
--  · El admin sube memes (quedan aprobados) y los alumnos también (quedan
--    pendientes hasta que el admin los apruebe). Aprobados, salen a todos.
--  · Cada meme se elige por el resultado frente al récord del alumno
--    (nuevo récord / cerca / le fue peor) o por un rango de PPM.
--  · Cada alumno puede apagarlos; el admin puede bloqueárselos (manda el admin).
-- Las imágenes van en un bucket PRIVADO: solo el servidor las lee y entrega
-- enlaces temporales de los memes aprobados.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.memes (
  id          int generated always as identity primary key,
  ruta        text not null unique,                 -- ruta del archivo en el bucket "memes"
  criterio    text not null check (criterio in ('record', 'ppm')),
  categoria   text check (categoria in ('nuevo_record', 'cerca', 'peor')),
  ppm_min     numeric,                              -- incluido
  ppm_max     numeric,                              -- excluido
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'aprobado')),
  subido_por  uuid references public.perfiles (id) on delete set null,
  creado_en   timestamptz not null default now(),
  check (criterio <> 'record' or categoria is not null),
  check (criterio <> 'ppm' or ppm_min is not null or ppm_max is not null),
  check (ppm_min is null or ppm_max is null or ppm_min < ppm_max)
);
create index if not exists memes_estado on public.memes (estado);

create table if not exists public.preferencias_memes (
  alumno_id   uuid primary key references public.perfiles (id) on delete cascade,
  activos     boolean not null default true,   -- lo decide el alumno
  bloqueados  boolean not null default false,  -- lo decide el admin
  actualizado_en timestamptz not null default now()
);

alter table public.memes enable row level security;
alter table public.preferencias_memes enable row level security;

drop policy if exists "leer memes propios" on public.memes;
create policy "leer memes propios" on public.memes for select to authenticated
  using (subido_por = auth.uid() or public.es_admin());
drop policy if exists "admin memes" on public.memes;
create policy "admin memes" on public.memes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "leer preferencias propias" on public.preferencias_memes;
create policy "leer preferencias propias" on public.preferencias_memes for select to authenticated
  using (alumno_id = auth.uid() or public.es_admin());
drop policy if exists "admin preferencias" on public.preferencias_memes;
create policy "admin preferencias" on public.preferencias_memes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Bucket privado: máx. 2 MB por imagen, solo formatos de imagen
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memes', 'memes', false, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
