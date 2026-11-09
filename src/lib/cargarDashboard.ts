import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlumnoDash, EvaluadoSinNota, Formula, IntentoDash, SalonDash } from "@/lib/estadisticas";
import { traerTodo } from "@/lib/supabase/paginar";

export interface DatosDashboard {
  salones: SalonDash[];
  alumnos: AlumnoDash[];
  intentos: IntentoDash[];
  /** Evaluados que decidieron no dar su evaluación (x, W, Justify en el Excel). */
  sinNota: EvaluadoSinNota[];
  mediciones: { id: number; nombre: string }[];
  formulas: Formula[];
}

type Privacidad = "completo" | "nombre_inicial" | "anonimo";

/**
 * Carga los datos de los dashboards.
 *  - admin:   nombres completos, usuarios e ids reales, todas las fórmulas.
 *  - publico: nombres según la configuración de privacidad, sin usuarios ni ids reales,
 *             y solo las fórmulas marcadas como visibles para alumnos.
 */
export async function cargarDashboard(db: SupabaseClient, modo: "admin" | "publico"): Promise<DatosDashboard> {
  const { data: cfg } = await db.from("configuracion").select("anio_escolar, mostrar_nombres").single();
  const privacidad = (cfg?.mostrar_nombres ?? "nombre_inicial") as Privacidad;

  let formulasQ = db.from("formulas_promedio").select("*").order("id");
  if (modo === "publico") formulasQ = formulasQ.eq("visible_alumnos", true);

  const [salonesRaw, perfiles, intentosRaw, sinNotaRaw, { data: mediciones }, { data: formulas }] = await Promise.all([
    traerTodo((d, h) => db.from("salones").select("id, seccion, grados(nombre, orden)").eq("anio", cfg?.anio_escolar ?? 0).range(d, h)),
    traerTodo((d, h) => db.from("perfiles").select("id, usuario, nombres, apellidos, salon_id").eq("rol", "alumno").eq("activo", true).range(d, h)),
    traerTodo((d, h) =>
      db.from("intentos").select("alumno_id, ppm, precision_pct, medicion_id, creado_en").in("estado", ["valido", "aprobado"]).order("creado_en").range(d, h),
    ),
    // Si la migración 9 aún no se aplicó, el dashboard sigue funcionando sin estos datos
    traerTodo((d, h) => db.from("evaluados_sin_nota").select("alumno_id, medicion_id").range(d, h)).catch((e) => {
      console.error("[dashboard] evaluados_sin_nota:", e instanceof Error ? e.message : e);
      return [] as { alumno_id: string; medicion_id: number }[];
    }),
    db.from("mediciones").select("id, nombre, inicia_en").order("inicia_en"),
    formulasQ,
  ]);

  type SalonRaw = { id: number; seccion: string; grados: { nombre: string; orden: number } | null };
  const salones: SalonDash[] = (salonesRaw as unknown as SalonRaw[])
    .map((s) => ({ id: s.id, nombre: `${s.grados?.nombre ?? ""} ${s.seccion}`.trim(), grado: s.grados?.nombre ?? "", gradoOrden: s.grados?.orden ?? 999 }))
    .sort((a, b) => a.gradoOrden - b.gradoOrden || a.nombre.localeCompare(b.nombre));
  const salonPorId = new Map(salones.map((s) => [s.id, s]));

  // En modo público los ids reales se reemplazan por ids anónimos
  const idPublico = new Map<string, string>();
  const nombrePublico = (nombres: string, apellidos: string, n: number) => {
    if (privacidad === "completo") return `${apellidos}, ${nombres}`;
    if (privacidad === "anonimo") return `Alumno ${n}`;
    return `${nombres.split(" ")[0]} ${apellidos.charAt(0)}.`;
  };

  const alumnos: AlumnoDash[] = perfiles
    .filter((p) => salonPorId.has(p.salon_id))
    .map((p, n) => {
      const s = salonPorId.get(p.salon_id)!;
      const publico = modo === "publico";
      if (publico) idPublico.set(p.id, `a${n + 1}`);
      return {
        id: publico ? `a${n + 1}` : p.id,
        nombre: publico ? nombrePublico(p.nombres, p.apellidos, n + 1) : `${p.apellidos}, ${p.nombres}`,
        usuario: publico ? "" : p.usuario,
        salonId: s.id,
        salon: s.nombre,
        grado: s.grado,
        gradoOrden: s.gradoOrden,
      };
    });

  const intentos: IntentoDash[] = intentosRaw
    .filter((i) => modo === "admin" || idPublico.has(i.alumno_id))
    .map((i) => ({
      a: modo === "publico" ? idPublico.get(i.alumno_id)! : i.alumno_id,
      ppm: Number(i.ppm),
      prec: i.precision_pct === null ? null : Number(i.precision_pct),
      med: i.medicion_id,
      t: i.creado_en,
    }));

  const sinNota: EvaluadoSinNota[] = sinNotaRaw
    .filter((e) => modo === "admin" || idPublico.has(e.alumno_id))
    .map((e) => ({ a: modo === "publico" ? idPublico.get(e.alumno_id)! : e.alumno_id, med: e.medicion_id }));

  return {
    salones,
    alumnos,
    intentos,
    sinNota,
    mediciones: (mediciones ?? []).map((m) => ({ id: m.id, nombre: m.nombre })),
    formulas: (formulas ?? []) as Formula[],
  };
}
