// Arma el paquete cifrado para las PCs sin internet. Solo Node (servidor y script del instalador).
// Recibe un cliente de Supabase con la clave secreta.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { traerTodo } from "./supabase/paginar";
import { VERSION_FORMATO, type AlumnoPaquete, type MemePaquete, type Paquete } from "./sinInternet";
import { cifrarPaquete, claveFirmaPaquete, codigoSalon, nuevoPin } from "./sinInternetCripto";

export async function armarPaquete(db: SupabaseClient, secreto: string, pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("El PIN debe tener de 4 a 8 números.");

  const [perfiles, intentos, { data: prefs }, { data: memes }] = await Promise.all([
    traerTodo((d, h) =>
      db.from("perfiles").select("id, usuario, nombres, apellidos, salones(*, grados(nombre))").eq("rol", "alumno").eq("activo", true).range(d, h),
    ),
    traerTodo((d, h) => db.from("intentos").select("alumno_id, ppm").in("estado", ["valido", "aprobado"]).range(d, h)),
    db.from("preferencias_memes").select("alumno_id, activos, bloqueados"),
    db.from("memes").select("ruta, criterio, categoria, ppm_min, ppm_max").eq("estado", "aprobado"),
  ]);
  const mejorPor = new Map<string, number>();
  for (const i of intentos as { alumno_id: string; ppm: number }[]) {
    mejorPor.set(i.alumno_id, Math.max(mejorPor.get(i.alumno_id) ?? 0, Number(i.ppm)));
  }
  const prefPor = new Map((prefs ?? []).map((p) => [p.alumno_id as string, p]));

  type Perfil = { id: string; usuario: string; nombres: string; apellidos: string; salones: unknown };
  type Salon = { id: number; seccion: string; memes_bloqueados?: boolean; grados: { nombre: string } | null } | null;
  const alumnos: AlumnoPaquete[] = [];
  const salones = new Map<number, { id: number; nombre: string; codigo: string }>();
  for (const p of perfiles as Perfil[]) {
    const s = p.salones as Salon;
    const pref = prefPor.get(p.id);
    const nombreSalon = s ? `${s.grados?.nombre ?? ""} ${s.seccion}`.trim() : "Sin salón";
    if (s && !salones.has(s.id)) salones.set(s.id, { id: s.id, nombre: nombreSalon, codigo: codigoSalon(secreto, s.id) });
    alumnos.push({
      id: p.id,
      usuario: p.usuario,
      nombres: p.nombres,
      apellidos: p.apellidos,
      salon: nombreSalon,
      salonId: s?.id ?? null,
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
    clave_firma: claveFirmaPaquete(secreto, id),
    pin: nuevoPin(pin),
    salones: [...salones.values()],
    alumnos,
    memes: memesPaquete,
  };
  return {
    contenido: cifrarPaquete(paquete),
    alumnos: alumnos.length,
    conRecord: alumnos.filter((a) => a.mejor !== null).length,
    memes: memesPaquete.length,
    /** Para la lista de usuarios y códigos (no viaja en el paquete sin cifrar). */
    lista: [...salones.values()].map((sal) => ({
      ...sal,
      alumnos: alumnos
        .filter((a) => a.salonId === sal.id)
        .map((a) => ({ apellidos: a.apellidos, nombres: a.nombres, usuario: a.usuario }))
        .sort((x, y) => x.apellidos.localeCompare(y.apellidos, "es")),
    })),
  };
}
