-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 15: quitar los memes a todo un salón.
-- Si está activado, ningún alumno del salón ve memes (aunque los tenga activados),
-- incluidos los que se agreguen después. Es independiente del bloqueo por alumno.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.salones
  add column if not exists memes_bloqueados boolean not null default false;
