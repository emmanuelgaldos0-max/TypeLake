import DashboardResultados from "@/components/admin/DashboardResultados";
import type { AlumnoDash, Formula, IntentoDash, SalonDash } from "@/lib/estadisticas";
import { traerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function PaginaResultados() {
  const db = await crearClienteServidor();
  const { data: cfg } = await db.from("configuracion").select("anio_escolar").single();

  const [salonesRaw, perfiles, intentosRaw, { data: mediciones }, { data: formulas }] = await Promise.all([
    traerTodo((d, h) => db.from("salones").select("id, seccion, grados(nombre, orden)").eq("anio", cfg?.anio_escolar ?? 0).range(d, h)),
    traerTodo((d, h) => db.from("perfiles").select("id, usuario, nombres, apellidos, salon_id").eq("rol", "alumno").eq("activo", true).range(d, h)),
    traerTodo((d, h) =>
      db.from("intentos").select("alumno_id, ppm, precision_pct, medicion_id, creado_en").in("estado", ["valido", "aprobado"]).order("creado_en").range(d, h),
    ),
    db.from("mediciones").select("id, nombre, inicia_en").order("inicia_en"),
    db.from("formulas_promedio").select("*").order("id"),
  ]);

  type SalonRaw = { id: number; seccion: string; grados: { nombre: string; orden: number } | null };
  const salones: SalonDash[] = (salonesRaw as unknown as SalonRaw[])
    .map((s) => ({ id: s.id, nombre: `${s.grados?.nombre ?? ""} ${s.seccion}`.trim(), grado: s.grados?.nombre ?? "", gradoOrden: s.grados?.orden ?? 999 }))
    .sort((a, b) => a.gradoOrden - b.gradoOrden || a.nombre.localeCompare(b.nombre));
  const salonPorId = new Map(salones.map((s) => [s.id, s]));

  const alumnos: AlumnoDash[] = perfiles
    .filter((p) => salonPorId.has(p.salon_id))
    .map((p) => {
      const s = salonPorId.get(p.salon_id)!;
      return {
        id: p.id,
        nombre: `${p.apellidos}, ${p.nombres}`,
        usuario: p.usuario,
        salonId: s.id,
        salon: s.nombre,
        grado: s.grado,
        gradoOrden: s.gradoOrden,
      };
    });

  const intentos: IntentoDash[] = intentosRaw.map((i) => ({
    a: i.alumno_id,
    ppm: Number(i.ppm),
    prec: i.precision_pct === null ? null : Number(i.precision_pct),
    med: i.medicion_id,
    t: i.creado_en,
  }));

  return (
    <DashboardResultados
      salones={salones}
      alumnos={alumnos}
      intentos={intentos}
      mediciones={(mediciones ?? []).map((m) => ({ id: m.id, nombre: m.nombre }))}
      formulas={(formulas ?? []) as Formula[]}
    />
  );
}
