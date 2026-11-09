"use server";

import { createClient } from "@supabase/supabase-js";
import { CLAVE_CAMBIADA_POR_ALUMNO } from "@/lib/credenciales";
import { crearClienteAdmin, emailDeUsuario, obtenerSesion } from "@/lib/supabase/server";

const MINIMO = 6;

/**
 * El alumno cambia su propia contraseña. Devuelve un mensaje de error o null.
 * (Se devuelve el error en vez de lanzarlo porque en producción Next oculta el texto.)
 */
export async function cambiarMiClave(actual: string, nueva: string): Promise<string | null> {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.perfil.rol !== "alumno" || !sesion.perfil.usuario) return "Inicia sesión como alumno para cambiar tu contraseña.";
  if (nueva.length < MINIMO) return `La contraseña nueva debe tener al menos ${MINIMO} caracteres.`;
  if (nueva.length > 72) return "La contraseña nueva es demasiado larga.";
  if (nueva === actual) return "La contraseña nueva debe ser distinta de la actual.";
  const usuario = sesion.perfil.usuario.toLowerCase();
  if (nueva.toLowerCase().includes(usuario)) return "La contraseña no puede contener tu usuario.";

  // Comprobar la contraseña actual con un cliente aparte, sin tocar la sesión del navegador
  const verificador = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: login, error: errLogin } = await verificador.auth.signInWithPassword({ email: emailDeUsuario(usuario), password: actual });
  if (errLogin || login.user?.id !== sesion.user.id) return "Tu contraseña actual no es correcta.";
  await verificador.auth.signOut({ scope: "local" });

  const db = crearClienteAdmin();
  const { error } = await db.auth.admin.updateUserById(sesion.user.id, { password: nueva });
  if (error) return `No se pudo cambiar la contraseña: ${error.message}`;

  // La copia guardada para el admin ya no sirve: se marca como cambiada por el alumno
  // (no se guarda la contraseña que eligió el alumno).
  await db.from("credenciales").upsert({ alumno_id: sesion.user.id, clave: CLAVE_CAMBIADA_POR_ALUMNO, actualizado_en: new Date().toISOString() });
  return null;
}
