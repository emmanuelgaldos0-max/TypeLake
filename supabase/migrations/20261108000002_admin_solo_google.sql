-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Los administradores solo pueden registrarse con Google.
-- Evita que alguien cree una cuenta con correo y contraseña usando el correo
-- de un administrador que todavía no ha ingresado.
-- ═══════════════════════════════════════════════════════════════════════════

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
  elsif new.raw_app_meta_data ->> 'provider' = 'google'
        and exists (select 1 from admins_permitidos a where lower(a.email) = lower(new.email)) then
    insert into perfiles (id, rol, nombres)
    values (new.id, 'admin', coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  else
    raise exception 'Registro no permitido para %', new.email;
  end if;
  return new;
end;
$$;
