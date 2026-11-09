import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Cliente con la sesión del usuario (respeta RLS). Para Server Components y Server Actions. */
export async function crearClienteServidor() {
  const almacen = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
          } catch {
            // En Server Components no se pueden escribir cookies; el middleware las renueva.
          }
        },
      },
    },
  );
}

/** Cliente con la clave secreta: salta RLS. SOLO usar en el servidor tras verificar que es admin. */
export function crearClienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface Perfil {
  id: string;
  rol: "alumno" | "admin";
  usuario: string | null;
  nombres: string;
  apellidos: string;
  salon_id: number | null;
}

/** Usuario actual con su perfil, o null si no hay sesión. */
export async function obtenerSesion() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, rol, usuario, nombres, apellidos, salon_id")
    .eq("id", user.id)
    .maybeSingle<Perfil>();
  if (!perfil) return null;
  return { user, perfil };
}

export const DOMINIO_ALUMNOS = "alumnos.typelake.local";
export const emailDeUsuario = (usuario: string) => `${usuario.trim().toLowerCase()}@${DOMINIO_ALUMNOS}`;
