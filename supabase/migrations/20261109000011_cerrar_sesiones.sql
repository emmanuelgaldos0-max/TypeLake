-- ═══════════════════════════════════════════════════════════════════════════
-- TypeLake · Migración 11: cerrar las sesiones abiertas de un alumno.
-- Cuando el admin le da una contraseña nueva (por ejemplo, porque otra persona
-- entró con sus credenciales y se la cambió), se cierran todas sus sesiones para
-- que quien estuviera dentro tenga que volver a iniciar sesión.
-- Solo la puede usar el servidor (clave secreta), nunca un usuario.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.cerrar_sesiones_alumno(p_alumno_id uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from auth.sessions
  where user_id = p_alumno_id
    and exists (select 1 from public.perfiles p where p.id = p_alumno_id and p.rol = 'alumno');
$$;

revoke execute on function public.cerrar_sesiones_alumno(uuid) from public, anon, authenticated;
grant  execute on function public.cerrar_sesiones_alumno(uuid) to service_role;
