// Funciones de memes solo para el servidor (no son acciones llamables desde el navegador).
import { crearClienteAdmin } from "@/lib/supabase/server";

const BUCKET = "memes";
/** Tiempo que se espera a que una subida en curso se confirme antes de considerarla huérfana. */
const GRACIA_MS = 30 * 60 * 1000;

/** Preferencia efectiva de memes de un alumno (sin fila, o sin la migración 12: activados y sin bloqueo). */
export async function preferenciaMemes(alumnoId: string) {
  const { data } = await crearClienteAdmin().from("preferencias_memes").select("activos, bloqueados").eq("alumno_id", alumnoId).maybeSingle();
  return { activos: data?.activos ?? true, bloqueados: data?.bloqueados ?? false };
}

/** Enlaces temporales (1 hora) para mostrar imágenes del bucket privado de memes. */
export async function enlacesMemes(rutas: string[]): Promise<Record<string, string>> {
  if (!rutas.length) return {};
  const { data } = await crearClienteAdmin().storage.from(BUCKET).createSignedUrls(rutas, 3600);
  const enlaces: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) enlaces[d.path] = d.signedUrl;
  return enlaces;
}

export interface ArchivoMeme {
  ruta: string;
  creado: number; // ms
  registrado: boolean; // tiene fila en la tabla memes
}

/** Archivos de la carpeta de un usuario en el bucket, marcando cuáles están registrados como meme. */
export async function archivosDeCarpeta(carpeta: string): Promise<ArchivoMeme[]> {
  const db = crearClienteAdmin();
  const [{ data: objetos }, { data: filas }] = await Promise.all([
    db.storage.from(BUCKET).list(carpeta, { limit: 1000, sortBy: { column: "created_at", order: "desc" } }),
    db.from("memes").select("ruta").like("ruta", `${carpeta}/%`),
  ]);
  const registradas = new Set((filas ?? []).map((f) => f.ruta as string));
  return (objetos ?? [])
    .filter((o) => o.id) // las carpetas no tienen id
    .map((o) => {
      const ruta = `${carpeta}/${o.name}`;
      return { ruta, creado: new Date(o.created_at ?? 0).getTime(), registrado: registradas.has(ruta) };
    });
}

/**
 * Borra las imágenes que se subieron pero nunca se confirmaron como meme
 * (más antiguas que el tiempo de gracia). Sin carpeta, revisa todo el bucket.
 * Devuelve cuántos archivos borró.
 */
export async function limpiarMemesHuerfanos(carpeta?: string): Promise<number> {
  const db = crearClienteAdmin();
  let carpetas = carpeta ? [carpeta] : [];
  if (!carpeta) {
    const { data } = await db.storage.from(BUCKET).list("", { limit: 1000 });
    carpetas = (data ?? []).filter((o) => !o.id).map((o) => o.name);
  }
  const limite = Date.now() - GRACIA_MS;
  let borrados = 0;
  for (const c of carpetas) {
    const huerfanos = (await archivosDeCarpeta(c)).filter((a) => !a.registrado && a.creado < limite).map((a) => a.ruta);
    if (huerfanos.length) {
      const { error } = await db.storage.from(BUCKET).remove(huerfanos);
      if (!error) borrados += huerfanos.length;
    }
  }
  return borrados;
}
