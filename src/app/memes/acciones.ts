"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { preferenciaMemes } from "@/lib/memesServidor";
import { crearClienteAdmin, obtenerSesion } from "@/lib/supabase/server";
import {
  MAX_BYTES,
  MAX_PENDIENTES_ALUMNO,
  TIPOS,
  categoriaDe,
  columnasCriterio,
  validarCriterio,
  type CriterioMeme,
  type FilaMeme,
} from "@/lib/memes";

// Todas devuelven { error } en vez de lanzar: en producción Next oculta el texto de los errores.
type Resultado<T = object> = ({ error: null } & T) | { error: string };

const BUCKET = "memes";
const EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

async function sesionAdmin() {
  const s = await obtenerSesion();
  return s?.perfil.rol === "admin" ? s : null;
}

/**
 * Elige un meme aprobado al azar para un intento.
 * referencia = récord previo del alumno (o mejor de la sesión si practica sin cuenta).
 * Para alumnos con cuenta se respeta su preferencia y el bloqueo del admin.
 */
export async function elegirMeme(ppm: number, referencia: number | null): Promise<{ url: string } | null> {
  if (!Number.isFinite(ppm)) return null;
  const sesion = await obtenerSesion();
  if (sesion?.perfil.rol === "alumno") {
    const p = await preferenciaMemes(sesion.user.id);
    if (p.bloqueados || !p.activos) return null;
  }
  const db = crearClienteAdmin();
  const { data, error } = await db.from("memes").select("ruta, criterio, categoria, ppm_min, ppm_max").eq("estado", "aprobado");
  if (error || !data?.length) return null;

  const categoria = categoriaDe(ppm, referencia);
  const candidatos = data.filter((m) =>
    m.criterio === "record"
      ? m.categoria === categoria
      : (m.ppm_min === null || ppm >= Number(m.ppm_min)) && (m.ppm_max === null || ppm < Number(m.ppm_max)),
  );
  if (!candidatos.length) return null;
  const elegido = candidatos[Math.floor(Math.random() * candidatos.length)];
  const { data: firmado } = await db.storage.from(BUCKET).createSignedUrl(elegido.ruta, 600);
  return firmado ? { url: firmado.signedUrl } : null;
}

/** El alumno activa o apaga sus memes. */
export async function cambiarMisMemes(activos: boolean): Promise<string | null> {
  const sesion = await obtenerSesion();
  if (sesion?.perfil.rol !== "alumno") return "Inicia sesión como alumno.";
  const db = crearClienteAdmin();
  const actual = await preferenciaMemes(sesion.user.id);
  const { error } = await db
    .from("preferencias_memes")
    .upsert({ alumno_id: sesion.user.id, activos, bloqueados: actual.bloqueados, actualizado_en: new Date().toISOString() });
  if (error) return error.message;
  revalidatePath("/cuenta");
  revalidatePath("/");
  return null;
}

/** El admin bloquea (o vuelve a permitir) los memes de un alumno. */
export async function bloquearMemesAlumno(alumnoId: string, bloqueados: boolean): Promise<string | null> {
  if (!(await sesionAdmin())) return "No autorizado.";
  const db = crearClienteAdmin();
  const actual = await preferenciaMemes(alumnoId);
  const { error } = await db
    .from("preferencias_memes")
    .upsert({ alumno_id: alumnoId, activos: actual.activos, bloqueados, actualizado_en: new Date().toISOString() });
  if (error) return error.message;
  revalidatePath("/admin/alumnos");
  return null;
}

/** Paso 1 de la subida: valida y devuelve un permiso temporal para subir el archivo al bucket. */
export async function prepararSubidaMeme(tipo: string, bytes: number): Promise<Resultado<{ ruta: string; token: string }>> {
  const sesion = await obtenerSesion();
  if (!sesion) return { error: "Inicia sesión para subir memes." };
  if (!TIPOS.includes(tipo)) return { error: "Solo se aceptan imágenes PNG, JPG, WEBP o GIF." };
  if (!(bytes > 0 && bytes <= MAX_BYTES)) return { error: "La imagen debe pesar como máximo 2 MB." };

  const db = crearClienteAdmin();
  if (sesion.perfil.rol === "alumno") {
    const { bloqueados } = await preferenciaMemes(sesion.user.id);
    if (bloqueados) return { error: "Tu profesor desactivó los memes en tu cuenta." };
    const { count } = await db.from("memes").select("id", { count: "exact", head: true }).eq("subido_por", sesion.user.id).eq("estado", "pendiente");
    if ((count ?? 0) >= MAX_PENDIENTES_ALUMNO) {
      return { error: `Ya tienes ${MAX_PENDIENTES_ALUMNO} memes esperando aprobación. Espera a que el profesor los revise.` };
    }
  }
  const ruta = `${sesion.user.id}/${randomUUID()}.${EXTENSION[tipo]}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error || !data) return { error: `No se pudo preparar la subida: ${error?.message ?? "sin respuesta"}` };
  return { error: null, ruta, token: data.token };
}

/** Paso 2: registra el meme ya subido. Del admin queda aprobado; de un alumno, pendiente. */
export async function confirmarSubidaMeme(ruta: string, criterio: CriterioMeme): Promise<string | null> {
  const sesion = await obtenerSesion();
  if (!sesion) return "Inicia sesión para subir memes.";
  const esAdmin = sesion.perfil.rol === "admin";
  if (!ruta.startsWith(`${sesion.user.id}/`) || ruta.includes("..")) return "Archivo no válido.";
  if (!esAdmin && criterio.criterio !== "record") return "Elige para qué resultado es el meme.";
  const invalido = validarCriterio(criterio);
  if (invalido) return invalido;

  const db = crearClienteAdmin();
  const [carpeta, archivo] = ruta.split("/");
  const { data: lista } = await db.storage.from(BUCKET).list(carpeta, { search: archivo, limit: 1 });
  if (!lista?.some((o) => o.name === archivo)) return "No se encontró la imagen subida. Inténtalo de nuevo.";

  const { error } = await db.from("memes").insert({
    ruta,
    ...columnasCriterio(criterio),
    estado: esAdmin ? "aprobado" : "pendiente",
    subido_por: sesion.user.id,
  });
  if (error) {
    await db.storage.from(BUCKET).remove([ruta]);
    return error.message;
  }
  revalidatePath("/admin/memes");
  revalidatePath("/cuenta");
  return null;
}

/** El admin aprueba un meme pendiente o cambia el criterio de uno aprobado. */
export async function guardarMeme(id: number, criterio: CriterioMeme, aprobar: boolean): Promise<string | null> {
  if (!(await sesionAdmin())) return "No autorizado.";
  const invalido = validarCriterio(criterio);
  if (invalido) return invalido;
  const cambios = { ...columnasCriterio(criterio), ...(aprobar ? { estado: "aprobado" } : {}) };
  const { error } = await crearClienteAdmin().from("memes").update(cambios).eq("id", id);
  if (error) return error.message;
  revalidatePath("/admin/memes");
  return null;
}

/** Rechaza (si estaba pendiente) o elimina un meme: se borran la fila y la imagen. */
export async function eliminarMeme(id: number): Promise<string | null> {
  if (!(await sesionAdmin())) return "No autorizado.";
  const db = crearClienteAdmin();
  const { data } = await db.from("memes").select("ruta").eq("id", id).maybeSingle<Pick<FilaMeme, "ruta">>();
  if (!data) return "El meme ya no existe.";
  const { error } = await db.from("memes").delete().eq("id", id);
  if (error) return error.message;
  await db.storage.from(BUCKET).remove([data.ruta]);
  revalidatePath("/admin/memes");
  return null;
}

/** El alumno retira un meme suyo que todavía no fue aprobado. */
export async function retirarMiMeme(id: number): Promise<string | null> {
  const sesion = await obtenerSesion();
  if (!sesion) return "Inicia sesión.";
  const db = crearClienteAdmin();
  const { data } = await db.from("memes").select("ruta").eq("id", id).eq("subido_por", sesion.user.id).eq("estado", "pendiente").maybeSingle();
  if (!data) return "Ese meme ya no se puede retirar.";
  await db.from("memes").delete().eq("id", id);
  await db.storage.from(BUCKET).remove([data.ruta as string]);
  revalidatePath("/cuenta");
  return null;
}
