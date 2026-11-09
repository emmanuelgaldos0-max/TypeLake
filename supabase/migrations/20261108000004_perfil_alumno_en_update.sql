-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Corrección del alta de alumnos.
-- Supabase crea primero el usuario y DESPUÉS le asigna app_metadata con un UPDATE,
-- así que el perfil del alumno se crea cuando aparece rol = 'alumno'.
-- (app_metadata solo lo puede escribir el servidor con la clave secreta.)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.al_crear_usuario()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email like '%@alumnos.typelake.local' then
    -- Cuenta de alumno: el perfil se crea cuando el servidor asigna app_metadata.
    if new.raw_app_meta_data ->> 'rol' = 'alumno' then
      perform public.crear_perfil_alumno(new.id, new.raw_app_meta_data);
    end if;
  elsif new.raw_app_meta_data ->> 'provider' = 'google'
        and exists (select 1 from admins_permitidos a where lower(a.email) = lower(new.email)) then
    insert into perfiles (id, rol, nombres)
    values (new.id, 'admin', coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
    on conflict (id) do nothing;
  else
    raise exception 'Registro no permitido para %', new.email;
  end if;
  return new;
end;
$$;

create or replace function public.crear_perfil_alumno(p_id uuid, p_meta jsonb)
returns void
language sql security definer set search_path = public
as $$
  insert into perfiles (id, rol, usuario, nombres, apellidos, salon_id)
  values (
    p_id, 'alumno',
    p_meta ->> 'usuario',
    coalesce(p_meta ->> 'nombres', ''),
    coalesce(p_meta ->> 'apellidos', ''),
    nullif(p_meta ->> 'salon_id', '')::int
  )
  on conflict (id) do nothing;
$$;

create or replace function public.al_actualizar_usuario()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.email like '%@alumnos.typelake.local'
     and new.raw_app_meta_data ->> 'rol' = 'alumno'
     and coalesce(old.raw_app_meta_data ->> 'rol', '') <> 'alumno' then
    perform public.crear_perfil_alumno(new.id, new.raw_app_meta_data);
  end if;
  return new;
end;
$$;

drop trigger if exists al_actualizar_usuario on auth.users;
create trigger al_actualizar_usuario
after update of raw_app_meta_data on auth.users
for each row execute function public.al_actualizar_usuario();

revoke execute on function public.crear_perfil_alumno(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.al_actualizar_usuario()        from public, anon, authenticated;
