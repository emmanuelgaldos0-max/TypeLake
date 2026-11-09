"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteAdmin, emailDeUsuario, obtenerSesion } from "@/lib/supabase/server";
import { claveGrado, generarClave, normalizar, ordenDeGrado, usuarioBase } from "@/lib/credenciales";

export interface FilaAlumno {
  grado: string;
  seccion: string;
  nombres: string;
  apellidos: string;
}

export interface ResultadoAlumno extends FilaAlumno {
  usuario?: string;
  clave?: string;
  estado: "creado" | "ya_existe" | "error";
  detalle?: string;
}

async function exigirAdmin() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.perfil.rol !== "admin") throw new Error("No autorizado");
  return sesion;
}

const limpiar = (s: string) => String(s ?? "").trim().replace(/\s+/g, " ");
const claveAlumno = (nombres: string, apellidos: string, salonId: number) => `${normalizar(nombres)}|${normalizar(apellidos)}|${salonId}`;

/**
 * Carga grados, salones y alumnos existentes una vez, y ofrece funciones para
 * obtener/crear salones y alumnos sin duplicados.
 */
async function contextoAlumnos(db: SupabaseClient) {
  const { data: cfg } = await db.from("configuracion").select("anio_escolar").single();
  const anio = cfg!.anio_escolar as number;

  const { data: grados } = await db.from("grados").select("id, nombre");
  const gradoPorNombre = new Map((grados ?? []).map((g) => [claveGrado(g.nombre), g.id as number]));
  const { data: salones } = await db.from("salones").select("id, grado_id, seccion").eq("anio", anio);
  const salonPorClave = new Map((salones ?? []).map((s) => [`${s.grado_id}|${s.seccion.toUpperCase()}`, s.id as number]));

  const { data: perfiles } = await db.from("perfiles").select("id, usuario, nombres, apellidos, salon_id").eq("rol", "alumno");
  const usados = new Set((perfiles ?? []).map((p) => p.usuario as string));
  const alumnoPorClave = new Map((perfiles ?? []).map((p) => [claveAlumno(p.nombres, p.apellidos, p.salon_id), p.id as string]));

  const salonId = async (grado: string, seccion: string) => {
    const clave = claveGrado(grado);
    let gradoId = gradoPorNombre.get(clave);
    if (!gradoId) {
      const { data, error } = await db.from("grados").insert({ nombre: grado, orden: ordenDeGrado(grado) }).select("id").single();
      if (error) throw new Error(`No se pudo crear el grado "${grado}": ${error.message}`);
      gradoId = data.id as number;
      gradoPorNombre.set(clave, gradoId);
    }
    const claveSalon = `${gradoId}|${seccion.toUpperCase()}`;
    let id = salonPorClave.get(claveSalon);
    if (!id) {
      const { data, error } = await db.from("salones").insert({ grado_id: gradoId, seccion: seccion.toUpperCase(), anio }).select("id").single();
      if (error) throw new Error(`No se pudo crear el salón ${grado} ${seccion}: ${error.message}`);
      id = data.id as number;
      salonPorClave.set(claveSalon, id);
    }
    return id;
  };

  const buscarAlumno = (nombres: string, apellidos: string, salon: number) => alumnoPorClave.get(claveAlumno(nombres, apellidos, salon));

  const crearAlumno = async (nombres: string, apellidos: string, salon: number) => {
    const base = usuarioBase(nombres, apellidos);
    let usuario = base;
    for (let n = 2; usados.has(usuario); n++) usuario = `${base}${n}`;
    const clave = generarClave();
    const { data, error } = await db.auth.admin.createUser({
      email: emailDeUsuario(usuario),
      password: clave,
      email_confirm: true,
      app_metadata: { rol: "alumno", usuario, nombres, apellidos, salon_id: salon },
    });
    if (error) throw new Error(error.message);
    usados.add(usuario);
    alumnoPorClave.set(claveAlumno(nombres, apellidos, salon), data.user.id);
    await guardarClave(db, data.user.id, clave);
    return { id: data.user.id, usuario, clave };
  };

  return { salonId, buscarAlumno, crearAlumno };
}

/** Crea las cuentas de una tanda de alumnos (máx. 25 por llamada). */
export async function crearAlumnos(filas: FilaAlumno[]): Promise<ResultadoAlumno[]> {
  await exigirAdmin();
  if (filas.length > 25) throw new Error("Máximo 25 alumnos por tanda");
  const ctx = await contextoAlumnos(crearClienteAdmin());

  const resultados: ResultadoAlumno[] = [];
  for (const original of filas) {
    const fila = {
      grado: limpiar(original.grado),
      seccion: limpiar(original.seccion),
      nombres: limpiar(original.nombres),
      apellidos: limpiar(original.apellidos),
    };
    try {
      if (!fila.grado || !fila.seccion || !fila.nombres || !fila.apellidos) throw new Error("Faltan datos en la fila");
      const salon = await ctx.salonId(fila.grado, fila.seccion);
      if (ctx.buscarAlumno(fila.nombres, fila.apellidos, salon)) {
        resultados.push({ ...fila, estado: "ya_existe", detalle: "Ya tiene cuenta en este salón" });
        continue;
      }
      const { usuario, clave } = await ctx.crearAlumno(fila.nombres, fila.apellidos, salon);
      resultados.push({ ...fila, usuario, clave, estado: "creado" });
    } catch (e) {
      resultados.push({ ...fila, estado: "error", detalle: e instanceof Error ? e.message : String(e) });
    }
  }

  revalidatePath("/admin/alumnos");
  return resultados;
}

/** Guarda la contraseña vigente para poder volver a descargarla (si la tabla existe). */
async function guardarClave(db: SupabaseClient, alumnoId: string, clave: string) {
  await db.from("credenciales").upsert({ alumno_id: alumnoId, clave, actualizado_en: new Date().toISOString() });
}

/** Genera una contraseña nueva para un alumno y la devuelve para entregársela. */
export async function restablecerClave(alumnoId: string): Promise<string> {
  await exigirAdmin();
  const db = crearClienteAdmin();
  const clave = generarClave();
  const { error } = await db.auth.admin.updateUserById(alumnoId, { password: clave });
  if (error) throw new Error(error.message);
  await guardarClave(db, alumnoId, clave);
  return clave;
}

export interface FilaCredencial {
  id: string;
  grado: string;
  seccion: string;
  orden: number;
  apellidos: string;
  nombres: string;
  usuario: string;
  clave: string | null; // null = creada antes de guardar contraseñas
}

/** Credenciales de los alumnos activos (de un salón, o de todos si salonId es null). */
export async function listarCredenciales(salonId: number | null): Promise<FilaCredencial[]> {
  await exigirAdmin();
  const db = crearClienteAdmin();
  let q = db
    .from("perfiles")
    .select("id, usuario, nombres, apellidos, salon_id, salones(seccion, grados(nombre, orden)), credenciales(clave)")
    .eq("rol", "alumno")
    .eq("activo", true);
  if (salonId !== null) q = q.eq("salon_id", salonId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  type Fila = {
    id: string;
    usuario: string;
    nombres: string;
    apellidos: string;
    salones: { seccion: string; grados: { nombre: string; orden: number } | null } | null;
    credenciales: { clave: string } | { clave: string }[] | null;
  };
  return ((data ?? []) as unknown as Fila[])
    .map((p) => {
      const cred = Array.isArray(p.credenciales) ? p.credenciales[0] : p.credenciales;
      return {
        id: p.id,
        grado: p.salones?.grados?.nombre ?? "Sin salón",
        seccion: p.salones?.seccion ?? "",
        orden: p.salones?.grados?.orden ?? 999,
        apellidos: p.apellidos,
        nombres: p.nombres,
        usuario: p.usuario,
        clave: cred?.clave ?? null,
      };
    })
    .sort((a, b) => a.orden - b.orden || a.seccion.localeCompare(b.seccion) || a.apellidos.localeCompare(b.apellidos, "es"));
}

/** Genera y guarda contraseñas nuevas para varios alumnos (máx. 25 por llamada). */
export async function generarClaves(alumnoIds: string[]): Promise<Record<string, string>> {
  await exigirAdmin();
  if (alumnoIds.length > 25) throw new Error("Máximo 25 alumnos por tanda");
  const db = crearClienteAdmin();
  const nuevas: Record<string, string> = {};
  for (const id of alumnoIds) {
    const clave = generarClave();
    const { error } = await db.auth.admin.updateUserById(id, { password: clave });
    if (error) throw new Error(error.message);
    await guardarClave(db, id, clave);
    nuevas[id] = clave;
  }
  return nuevas;
}

/** Activa o desactiva una cuenta de alumno (desactivado = no cuenta en promedios ni rankings). */
export async function cambiarActivo(alumnoId: string, activo: boolean) {
  await exigirAdmin();
  const db = crearClienteAdmin();
  const { error } = await db.from("perfiles").update({ activo }).eq("id", alumnoId).eq("rol", "alumno");
  if (error) throw new Error(error.message);
  // Bloquear también el inicio de sesión
  await db.auth.admin.updateUserById(alumnoId, { ban_duration: activo ? "none" : "876000h" });
  revalidatePath("/admin/alumnos");
}

// ───────────────────────── Importación de mediciones ─────────────────────────

export interface NotaImportada {
  nombres: string;
  apellidos: string;
  /** PPM por columna (WPM 1, WPM 2…), en su posición; null = celda vacía, x, W, Justify. */
  notas: (number | null)[];
}

export interface ResultadoImportacion {
  nombres: string;
  apellidos: string;
  estado: "importado" | "sin_cambios" | "sin_notas" | "error";
  cuentaNueva?: { usuario: string; clave: string };
  /** Cambios aplicados respecto a lo que ya estaba importado. */
  nuevas: number;
  cambiadas: number;
  quitadas: number;
  detalle?: string;
}

const LIMA = "-05:00";

function codigoAleatorio() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => letras[randomInt(letras.length)]).join("");
}

/** Si ya existe una medición con ese nombre, devuelve su fecha (YYYY-MM-DD, hora de Lima). */
export async function buscarMedicionPorNombre(nombre: string): Promise<{ id: number; fecha: string } | null> {
  await exigirAdmin();
  const db = crearClienteAdmin();
  const { data } = await db.from("mediciones").select("id, inicia_en").eq("nombre", limpiar(nombre)).maybeSingle();
  if (!data) return null;
  const fecha = new Date(new Date(data.inicia_en as string).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  return { id: data.id as number, fecha };
}

/** Crea (o reutiliza, si ya existe con el mismo nombre) una medición pasada de un día completo. */
export async function prepararMedicionHistorica(nombre: string, fecha: string): Promise<number> {
  const sesion = await exigirAdmin();
  const db = crearClienteAdmin();
  nombre = limpiar(nombre);
  if (!nombre) throw new Error("Escribe un nombre para la medición");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Fecha no válida");

  const { data: existente } = await db.from("mediciones").select("id").eq("nombre", nombre).maybeSingle();
  const inicia = `${fecha}T00:00:00${LIMA}`;
  const termina = `${fecha}T23:59:00${LIMA}`;
  if (existente) {
    await db.from("mediciones").update({ inicia_en: inicia, termina_en: termina }).eq("id", existente.id);
    return existente.id as number;
  }
  for (let intento = 0; intento < 5; intento++) {
    const { data, error } = await db
      .from("mediciones")
      .insert({ nombre, codigo: codigoAleatorio(), inicia_en: inicia, termina_en: termina, duracion_seg: 60, creado_por: sesion.perfil.id })
      .select("id")
      .single();
    if (!error) return data.id as number;
    if (!error.message.includes("codigo")) throw new Error(error.message);
  }
  throw new Error("No se pudo generar un código único");
}

const redondear = (ppm: number) => Math.round(ppm * 10) / 10;

/** Campos de un intento importado que dependen de las PPM. */
function camposNota(ppm: number) {
  const correctos = Math.round(ppm * 5);
  return { ppm: redondear(ppm), ppm_bruta: redondear(ppm), correctos, pulsaciones: correctos };
}

/**
 * Importa las notas de un salón (máx. 25 alumnos por llamada).
 * Crea las cuentas que falten y, si la medición ya tenía notas importadas, solo aplica
 * las diferencias columna por columna: agrega las nuevas, corrige las que cambiaron y
 * quita las que ya no están en el Excel. Volver a subir el mismo archivo no cambia nada.
 * Los intentos hechos en línea durante la medición nunca se tocan.
 */
export async function importarNotasMedicion(
  medicionId: number,
  fecha: string,
  grado: string,
  seccion: string,
  filas: NotaImportada[],
): Promise<ResultadoImportacion[]> {
  await exigirAdmin();
  if (filas.length > 25) throw new Error("Máximo 25 alumnos por tanda");
  const db = crearClienteAdmin();
  const ctx = await contextoAlumnos(db);
  const salon = await ctx.salonId(limpiar(grado), limpiar(seccion));
  const creadoEn = new Date(`${fecha}T10:00:00${LIMA}`).getTime();

  const resultados: ResultadoImportacion[] = [];
  for (const f of filas) {
    const nombres = limpiar(f.nombres);
    const apellidos = limpiar(f.apellidos);
    try {
      if (!nombres || !apellidos) throw new Error("Nombre incompleto");
      let alumnoId = ctx.buscarAlumno(nombres, apellidos, salon);
      let cuentaNueva: ResultadoImportacion["cuentaNueva"];
      if (!alumnoId) {
        const nuevo = await ctx.crearAlumno(nombres, apellidos, salon);
        alumnoId = nuevo.id;
        cuentaNueva = { usuario: nuevo.usuario, clave: nuevo.clave };
      }

      const notas = f.notas.map((n) => (typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1000 ? n : null));

      // Lo que ya estaba importado de esta medición para este alumno, por columna
      const { data: previos, error: errLeer } = await db
        .from("intentos")
        .select("id, ppm, senales")
        .eq("medicion_id", medicionId)
        .eq("alumno_id", alumnoId)
        .eq("senales->>importado", "true");
      if (errLeer) throw new Error(errLeer.message);
      const porColumna = new Map<number, { id: number; ppm: number }>();
      const sobrantes: number[] = [];
      for (const p of previos ?? []) {
        const col = Number((p.senales as { columna?: number })?.columna);
        if (!col || porColumna.has(col) || col > notas.length) sobrantes.push(p.id as number);
        else porColumna.set(col, { id: p.id as number, ppm: Number(p.ppm) });
      }

      const insertar: Record<string, unknown>[] = [];
      const borrar = [...sobrantes];
      let cambiadas = 0;
      for (let i = 0; i < notas.length; i++) {
        const col = i + 1;
        const nota = notas[i];
        const previo = porColumna.get(col);
        if (nota === null) {
          if (previo) borrar.push(previo.id);
        } else if (!previo) {
          insertar.push({
            alumno_id: alumnoId,
            salon_id: salon,
            modo: "medicion",
            medicion_id: medicionId,
            duracion_seg: 60,
            ...camposNota(nota),
            precision_pct: null,
            incorrectos: 0,
            errores: 0,
            senales: { importado: true, columna: col },
            estado: "aprobado",
            motivos: ["importado_de_excel"],
            creado_en: new Date(creadoEn + i * 60000).toISOString(),
          });
        } else if (previo.ppm !== redondear(nota)) {
          const { error } = await db.from("intentos").update(camposNota(nota)).eq("id", previo.id);
          if (error) throw new Error(error.message);
          cambiadas++;
        }
      }

      if (borrar.length) {
        const { error } = await db.from("intentos").delete().in("id", borrar);
        if (error) throw new Error(error.message);
      }
      if (insertar.length) {
        const { error } = await db.from("intentos").insert(insertar);
        if (error) throw new Error(error.message);
      }

      const nuevas = insertar.length;
      const quitadas = borrar.length;
      const conNota = notas.some((n) => n !== null);
      const estado = nuevas || cambiadas || quitadas ? "importado" : conNota ? "sin_cambios" : "sin_notas";
      resultados.push({ nombres, apellidos, estado, cuentaNueva, nuevas, cambiadas, quitadas });
    } catch (e) {
      resultados.push({ nombres, apellidos, estado: "error", nuevas: 0, cambiadas: 0, quitadas: 0, detalle: e instanceof Error ? e.message : String(e) });
    }
  }

  revalidatePath("/admin/mediciones");
  revalidatePath("/admin/alumnos");
  return resultados;
}

// ───────────────────────── Fórmulas de promedio ─────────────────────────

export interface DatosFormula {
  id?: number;
  nombre: string;
  tipo: "general" | "mejores_peores" | "top" | "mediana";
  mejores: number | null;
  peores: number | null;
  fuente: "mediciones" | "todo";
  medicion_id: number | null;
  sin_intentos: "ignorar" | "cero";
  visible_alumnos: boolean;
}

/** Crea o actualiza una fórmula y devuelve su id. */
export async function guardarFormula(f: DatosFormula): Promise<number> {
  await exigirAdmin();
  const db = crearClienteAdmin();
  const nombre = limpiar(f.nombre);
  if (!nombre) throw new Error("Ponle un nombre a la fórmula");
  const fila = {
    nombre,
    tipo: f.tipo,
    mejores: f.tipo === "top" || f.tipo === "mejores_peores" ? Math.max(0, Math.floor(f.mejores ?? 0)) : null,
    peores: f.tipo === "mejores_peores" ? Math.max(0, Math.floor(f.peores ?? 0)) : null,
    fuente: f.fuente,
    medicion_id: f.fuente === "mediciones" ? f.medicion_id : null,
    sin_intentos: f.sin_intentos,
    visible_alumnos: f.visible_alumnos,
  };
  const { data, error } = f.id
    ? await db.from("formulas_promedio").update(fila).eq("id", f.id).select("id").single()
    : await db.from("formulas_promedio").insert(fila).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/resultados");
  return data.id as number;
}

export async function eliminarFormula(id: number) {
  await exigirAdmin();
  const { error } = await crearClienteAdmin().from("formulas_promedio").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/resultados");
}

// ───────────────────────── Revisión de intentos ─────────────────────────

/** Aprueba (cuenta para récords y promedios) o rechaza (no cuenta) un intento. */
export async function revisarIntento(intentoId: number, decision: "aprobado" | "rechazado") {
  const sesion = await exigirAdmin();
  const { error } = await crearClienteAdmin()
    .from("intentos")
    .update({ estado: decision, revisado_por: sesion.perfil.id, revisado_en: new Date().toISOString() })
    .eq("id", intentoId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/revision");
  revalidatePath("/admin");
}
