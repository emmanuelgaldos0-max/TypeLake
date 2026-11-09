-- Datos iniciales de TypeLake (generado por scripts/generar-seed.ts).
-- Ejecutar en Supabase → SQL Editor DESPUÉS de las migraciones.

-- Administrador inicial (entra con Google). Agrega más correos aquí o desde el panel.
-- El banco de textos se carga en la migración 5.
insert into public.admins_permitidos (email) values ('emmanuelgaldos0@gmail.com')
on conflict do nothing;
