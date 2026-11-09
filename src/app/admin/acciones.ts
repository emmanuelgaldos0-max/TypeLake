"use server";

import { revalidatePath } from "next/cache";
import { crearClienteAdmin, emailDeUsuario, obtenerSesion } from "@/lib/supabase/server";
import { generarClave, normalizar, ordenDeGrado, usuarioBase } from "@/lib/credenciales";

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

/** Crea las cuentas de una tanda de alumnos (máx. 25 por llamada). */
export async function crearAlumnos(filas: FilaAlumno[]): Promise<ResultadoAlumno[]> {
  await exigirAdmin();
  if (filas.length > 25) throw new Error("Máximo 25 alumnos por tanda");
  const db = crearClienteAdmin();

  const { data: cfg } = await db.from("configuracion").select("anio_escolar").single();
  const anio = cfg!.anio_escolar as number;

  // Grados y salones (se crean si no existen)
  const { data: grados } = await db.from("grados").select("id, nombre");
  const gradoPorNombre = new Map((grados ?? []).map((g) => [normalizar(g.nombre), g.id as number]));
  const { data: salones } = await db.from("salones").select("id, grado_id, seccion").eq("anio", anio);
  const salonPorClave = new Map((salones ?? []).map((s) => [`${s.grado_id}|${s.seccion.toUpperCase()}`, s.id as number]));

  const obtenerSalon = async (grado: string, seccion: string) => {
    const claveGrado = normalizar(grado);
    let gradoId = gradoPorNombre.get(claveGrado);
    if (!gradoId) {
      const { data, error } = await db.from("grados").insert({ nombre: grado, orden: ordenDeGrado(grado) }).select("id").single();
      if (error) throw new Error(`No se pudo crear el grado "${grado}": ${error.message}`);
      gradoId = data.id as number;
      gradoPorNombre.set(claveGrado, gradoId);
    }
    const claveSalon = `${gradoId}|${seccion.toUpperCase()}`;
    let salonId = salonPorClave.get(claveSalon);
    if (!salonId) {
      const { data, error } = await db.from("salones").insert({ grado_id: gradoId, seccion: seccion.toUpperCase(), anio }).select("id").single();
      if (error) throw new Error(`No se pudo crear el salón ${grado} ${seccion}: ${error.message}`);
      salonId = data.id as number;
      salonPorClave.set(claveSalon, salonId);
    }
    return salonId;
  };

  // Usuarios existentes para evitar duplicados
  const { data: perfiles } = await db.from("perfiles").select("usuario, nombres, apellidos, salon_id").eq("rol", "alumno");
  const usados = new Set((perfiles ?? []).map((p) => p.usuario as string));
  const existentes = new Set((perfiles ?? []).map((p) => `${normalizar(p.nombres)}|${normalizar(p.apellidos)}|${p.salon_id}`));

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
      const salonId = await obtenerSalon(fila.grado, fila.seccion);

      if (existentes.has(`${normalizar(fila.nombres)}|${normalizar(fila.apellidos)}|${salonId}`)) {
        resultados.push({ ...fila, estado: "ya_existe", detalle: "Ya tiene cuenta en este salón" });
        continue;
      }

      const base = usuarioBase(fila.nombres, fila.apellidos);
      let usuario = base;
      for (let n = 2; usados.has(usuario); n++) usuario = `${base}${n}`;
      const clave = generarClave();

      const { error } = await db.auth.admin.createUser({
        email: emailDeUsuario(usuario),
        password: clave,
        email_confirm: true,
        app_metadata: { rol: "alumno", usuario, nombres: fila.nombres, apellidos: fila.apellidos, salon_id: salonId },
      });
      if (error) throw new Error(error.message);

      usados.add(usuario);
      resultados.push({ ...fila, usuario, clave, estado: "creado" });
    } catch (e) {
      resultados.push({ ...fila, estado: "error", detalle: e instanceof Error ? e.message : String(e) });
    }
  }

  revalidatePath("/admin/alumnos");
  return resultados;
}

/** Genera una contraseña nueva para un alumno y la devuelve para entregársela. */
export async function restablecerClave(alumnoId: string): Promise<string> {
  await exigirAdmin();
  const db = crearClienteAdmin();
  const clave = generarClave();
  const { error } = await db.auth.admin.updateUserById(alumnoId, { password: clave });
  if (error) throw new Error(error.message);
  return clave;
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
