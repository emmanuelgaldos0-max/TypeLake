// Compara el cálculo del dashboard (TypeScript) con la función promedio_salones de la base de datos.
// Uso: node --env-file=.env.local --experimental-strip-types scripts/verificar-formulas.ts
import { createClient } from "@supabase/supabase-js";
import { aplicarFormula, type AlumnoDash, type Formula, type IntentoDash, type SalonDash } from "../src/lib/estadisticas.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const { data: cfg } = await db.from("configuracion").select("anio_escolar").single();
const { data: s } = await db.from("salones").select("id, seccion, grados(nombre, orden)").eq("anio", cfg!.anio_escolar);
const { data: p } = await db.from("perfiles").select("id, salon_id").eq("rol", "alumno").eq("activo", true);
const intentosRaw: { alumno_id: string; ppm: number; medicion_id: number | null; creado_en: string }[] = [];
for (let d = 0; ; d += 1000) {
  const { data } = await db.from("intentos").select("alumno_id, ppm, medicion_id, creado_en").in("estado", ["valido", "aprobado"]).range(d, d + 999);
  intentosRaw.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}

const salones: SalonDash[] = (s as unknown as { id: number; seccion: string; grados: { nombre: string; orden: number } }[]).map((x) => ({
  id: x.id, nombre: `${x.grados.nombre} ${x.seccion}`, grado: x.grados.nombre, gradoOrden: x.grados.orden,
}));
const alumnos: AlumnoDash[] = (p ?? []).map((x) => ({ id: x.id, nombre: "", usuario: "", salonId: x.salon_id, salon: "", grado: "", gradoOrden: 0 }));
const intentos: IntentoDash[] = intentosRaw.map((i) => ({ a: i.alumno_id, ppm: Number(i.ppm), prec: null, med: i.medicion_id, t: i.creado_en }));

// Fórmulas de prueba (se crean temporalmente y se borran al final)
const pruebas = [
  { nombre: "zz general med", tipo: "general", fuente: "mediciones", sin_intentos: "ignorar" },
  { nombre: "zz 5+5 med", tipo: "mejores_peores", mejores: 5, peores: 5, fuente: "mediciones", sin_intentos: "ignorar" },
  { nombre: "zz top10 cero", tipo: "top", mejores: 10, fuente: "mediciones", sin_intentos: "cero" },
  { nombre: "zz mediana cero", tipo: "mediana", fuente: "mediciones", sin_intentos: "cero" },
];
let ok = true;
for (const prueba of pruebas) {
  const { data: f } = await db.from("formulas_promedio").insert({ ...prueba, visible_alumnos: true }).select("*").single();
  try {
    const { data: sql, error } = await db.rpc("promedio_salones", { p_formula_id: f.id });
    if (error) throw error;
    const ts = aplicarFormula(f as Formula, salones, alumnos, intentos);
    for (const fila of sql) {
      const t = ts.find((x) => x.salon.id === fila.salon_id)!;
      const a = fila.promedio === null ? null : Number(fila.promedio);
      const igual = a === t.promedio && fila.considerados === t.considerados;
      if (!igual) ok = false;
      console.log(`${igual ? "✔" : "✘"} ${prueba.nombre.padEnd(16)} ${t.salon.nombre.padEnd(22)} SQL ${a} (${fila.considerados})  dashboard ${t.promedio} (${t.considerados})`);
    }
  } finally {
    await db.from("formulas_promedio").delete().eq("id", f.id);
  }
}
console.log(ok ? "\n✔ El dashboard y la base de datos calculan lo mismo" : "\n✘ Hay diferencias");
