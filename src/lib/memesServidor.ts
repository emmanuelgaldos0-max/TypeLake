// Funciones de memes solo para el servidor (no son acciones llamables desde el navegador).
import { crearClienteAdmin } from "@/lib/supabase/server";

/** Preferencia efectiva de memes de un alumno (sin fila, o sin la migración 12: activados y sin bloqueo). */
export async function preferenciaMemes(alumnoId: string) {
  const { data } = await crearClienteAdmin().from("preferencias_memes").select("activos, bloqueados").eq("alumno_id", alumnoId).maybeSingle();
  return { activos: data?.activos ?? true, bloqueados: data?.bloqueados ?? false };
}

/** Enlaces temporales (1 hora) para mostrar imágenes del bucket privado de memes. */
export async function enlacesMemes(rutas: string[]): Promise<Record<string, string>> {
  if (!rutas.length) return {};
  const { data } = await crearClienteAdmin().storage.from("memes").createSignedUrls(rutas, 3600);
  const enlaces: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) enlaces[d.path] = d.signedUrl;
  return enlaces;
}
