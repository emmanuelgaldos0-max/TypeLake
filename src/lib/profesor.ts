// Récord del profesor (admin), solo para el servidor. Sus pruebas viven en
// resultados_profesor, aparte de los intentos de los alumnos.
import { crearClienteAdmin } from "@/lib/supabase/server";

export interface RecordProfesor {
  nombre: string;
  ppm: number;
}

/** Mejor resultado del profesor, o null si el admin lo ocultó, no hay pruebas o falta la migración 14. */
export async function recordProfesorVisible(): Promise<RecordProfesor | null> {
  const db = crearClienteAdmin();
  const { data: cfg } = await db.from("configuracion").select("*").single();
  if (!(cfg as { mostrar_profesor?: boolean } | null)?.mostrar_profesor) return null;
  return mejorResultadoProfesor();
}

export async function mejorResultadoProfesor(): Promise<RecordProfesor | null> {
  const db = crearClienteAdmin();
  const { data, error } = await db
    .from("resultados_profesor")
    .select("ppm, perfiles(nombres)")
    .order("ppm", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const perfil = data.perfiles as unknown as { nombres: string } | null;
  return { nombre: perfil?.nombres.split(" ")[0] ?? "", ppm: Number(data.ppm) };
}
