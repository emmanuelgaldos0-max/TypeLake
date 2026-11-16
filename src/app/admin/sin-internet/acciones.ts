"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { traerTodo } from "@/lib/supabase/paginar";
import { crearClienteAdmin, obtenerSesion } from "@/lib/supabase/server";
import { VERSION_FORMATO, type AlumnoPaquete, type IntentoSinInternet, type MemePaquete, type Paquete } from "@/lib/sinInternet";
import { cifrarPaquete, claveFirmaPaquete, firmaValida, nuevoPin } from "@/lib/sinInternetCripto";

type Resultado<T = object> = ({ error: null } & T) | { error: string };

async function esAdmin() {
  const s = await obtenerSesion();
  return s?.perfil.rol === "admin";
}

function secreto() {
  const s = process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("Falta SUPABASE_SECRET_KEY en el servidor");
  return s;
}

/** Arma el paquete cifrado para las PCs sin internet (alumnos, contraseñas, récords, memes y PIN). */
export async function generarPaquete(pin: string): Promise<Resultado<{ contenido: string; alumnos: number; memes: number }>> {
  try {
    if (!(await esAdmin())) return { error: "No autorizado." };
    if (!/^\d{4,8}$/.test(pin)) return { error: "El PIN debe tener de 4 a 8 números." };
    const db = crearClienteAdmin();

    const [perfiles, intentos, { data: hashes, error: errHash }, { data: prefs }, { data: memes }] = await Promise.all([
      traerTodo((d, h) =>
        db.from("perfiles").select("id, usuario, nombres, apellidos, salones(*, grados(nombre))").eq("rol", "alumno").eq("activo", true).range(d, h),
      ),
      traerTodo((d, h) => db.from("intentos").select("alumno_id, ppm").in("estado", ["valido", "aprobado"]).range(d, h)),
      db.rpc("hashes_alumnos"),
      db.from("preferencias_memes").select("alumno_id, activos, bloqueados"),
      db.from("memes").select("ruta, criterio, categoria, ppm_min, ppm_max").eq("estado", "aprobado"),
    ]);
    if (errHash) {
      return { error: /hashes_alumnos/.test(errHash.message) ? "Falta aplicar la migración 16 (sin internet) en Supabase." : errHash.message };
    }

    const hashPor = new Map((hashes as { id: string; hash: string }[]).map((h) => [h.id, h.hash]));
    const mejorPor = new Map<string, number>();
    for (const i of intentos) mejorPor.set(i.alumno_id, Math.max(mejorPor.get(i.alumno_id) ?? 0, Number(i.ppm)));
    const prefPor = new Map((prefs ?? []).map((p) => [p.alumno_id as string, p]));

    type Salon = { seccion: string; memes_bloqueados?: boolean; grados: { nombre: string } | null } | null;
    const alumnos: AlumnoPaquete[] = [];
    for (const p of perfiles) {
      const hash = hashPor.get(p.id);
      if (!hash) continue;
      const s = p.salones as unknown as Salon;
      const pref = prefPor.get(p.id);
      alumnos.push({
        id: p.id,
        usuario: p.usuario,
        nombres: p.nombres,
        apellidos: p.apellidos,
        salon: s ? `${s.grados?.nombre ?? ""} ${s.seccion}`.trim() : "Sin salón",
        hash,
        mejor: mejorPor.get(p.id) ?? null,
        memesActivos: pref?.activos ?? true,
        memesBloqueados: (pref?.bloqueados ?? false) || s?.memes_bloqueados === true,
      });
    }

    const memesPaquete: MemePaquete[] = [];
    for (const m of memes ?? []) {
      const { data: archivo } = await db.storage.from("memes").download(m.ruta);
      if (!archivo) continue;
      const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64");
      memesPaquete.push({
        datos: `data:${archivo.type || "image/png"};base64,${base64}`,
        criterio: m.criterio,
        categoria: m.categoria,
        ppm_min: m.ppm_min === null ? null : Number(m.ppm_min),
        ppm_max: m.ppm_max === null ? null : Number(m.ppm_max),
      });
    }

    const id = randomUUID();
    const paquete: Paquete = {
      tipo: "typelake-paquete",
      version: VERSION_FORMATO,
      id,
      creado_en: new Date().toISOString(),
      clave_firma: claveFirmaPaquete(secreto(), id),
      pin: nuevoPin(pin),
      alumnos,
      memes: memesPaquete,
    };
    return { error: null, contenido: cifrarPaquete(paquete), alumnos: alumnos.length, memes: memesPaquete.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ResumenImportacion {
  validos: number;
  sospechosos: number;
  duplicados: number;
  rechazados: number;
  detalles: string[];
}

/**
 * Registra una tanda (máx. 200) de intentos hechos sin internet.
 * medicionId = null → práctica. Se comprueba la firma de cada intento y se recalculan las PPM.
 */
export async function importarIntentosSinInternet(
  intentos: IntentoSinInternet[],
  medicionId: number | null,
): Promise<Resultado<{ resumen: ResumenImportacion }>> {
  try {
    if (!(await esAdmin())) return { error: "No autorizado." };
    if (!Array.isArray(intentos) || intentos.length > 200) return { error: "Tanda no válida." };
    const claves = new Map<string, string>();
    const claveDe = (paqueteId: string) => {
      if (!claves.has(paqueteId)) claves.set(paqueteId, claveFirmaPaquete(secreto(), paqueteId));
      return claves.get(paqueteId)!;
    };
    const db = crearClienteAdmin();
    const resumen: ResumenImportacion = { validos: 0, sospechosos: 0, duplicados: 0, rechazados: 0, detalles: [] };

    for (const i of intentos) {
      if (!/^[0-9a-f-]{36}$/i.test(String(i.paquete_id)) || !firmaValida(claveDe(i.paquete_id), i)) {
        resumen.rechazados++;
        if (resumen.detalles.length < 20) resumen.detalles.push(`Intento del ${i.creado_en?.slice(0, 10)}: la firma no coincide (el archivo fue modificado).`);
        continue;
      }
      const { data, error } = await db.rpc("importar_intento_offline", {
        p: {
          origen_id: i.origen_id,
          alumno_id: i.alumno_id,
          creado_en: i.creado_en,
          medicion_id: medicionId,
          duracion_seg: i.duracion_seg,
          correctos: i.correctos,
          incorrectos: i.incorrectos,
          pulsaciones: i.pulsaciones,
          errores: i.errores,
          errores_por_tecla: i.errores_por_tecla,
          senales: i.senales,
        },
      });
      if (error) {
        resumen.rechazados++;
        if (resumen.detalles.length < 20) {
          resumen.detalles.push(/importar_intento_offline/.test(error.message) ? "Falta aplicar la migración 16 (sin internet) en Supabase." : error.message);
        }
      } else if (data === "duplicado") resumen.duplicados++;
      else if (data === "sospechoso") resumen.sospechosos++;
      else resumen.validos++;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/revision");
    revalidatePath("/admin/recientes");
    return { error: null, resumen };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
