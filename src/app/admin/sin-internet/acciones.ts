"use server";

import { revalidatePath } from "next/cache";
import { armarPaquete } from "@/lib/armarPaquete";
import { crearClienteAdmin, obtenerSesion } from "@/lib/supabase/server";
import type { IntentoSinInternet } from "@/lib/sinInternet";
import { claveFirmaPaquete, firmaValida } from "@/lib/sinInternetCripto";

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
    const r = await armarPaquete(crearClienteAdmin(), secreto(), pin);
    return { error: null, contenido: r.contenido, alumnos: r.alumnos, memes: r.memes };
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
