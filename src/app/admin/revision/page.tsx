import TablaIntentos, { type FilaIntento } from "@/components/admin/TablaIntentos";
import { traerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function PaginaRevision({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const historial = ver === "historial";
  const db = await crearClienteServidor();

  const [intentos, perfiles, { data: mediciones }] = await Promise.all([
    traerTodo((d, h) => {
      let q = db.from("intentos").select("id, alumno_id, ppm, precision_pct, referencia_ppm, estado, motivos, medicion_id, creado_en");
      q = historial ? q.not("revisado_en", "is", null).order("revisado_en", { ascending: false }) : q.eq("estado", "sospechoso").order("creado_en", { ascending: false });
      return q.range(d, h);
    }),
    traerTodo((d, h) => db.from("perfiles").select("id, nombres, apellidos, salones(seccion, grados(nombre))").eq("rol", "alumno").range(d, h)),
    db.from("mediciones").select("id, nombre"),
  ]);

  type Perfil = { id: string; nombres: string; apellidos: string; salones: { seccion: string; grados: { nombre: string } | null } | null };
  const alumno = new Map(
    (perfiles as unknown as Perfil[]).map((p) => [
      p.id,
      { id: p.id, nombre: `${p.apellidos}, ${p.nombres}`, salon: p.salones ? `${p.salones.grados?.nombre ?? ""} ${p.salones.seccion}` : "Sin salón" },
    ]),
  );
  const nombreMedicion = new Map((mediciones ?? []).map((m) => [m.id as number, m.nombre as string]));

  const filas: FilaIntento[] = intentos.map((i) => ({
    id: i.id,
    fecha: i.creado_en,
    ppm: Number(i.ppm),
    precision: i.precision_pct === null ? null : Number(i.precision_pct),
    referencia: i.referencia_ppm === null ? null : Number(i.referencia_ppm),
    estado: i.estado,
    motivos: i.motivos ?? [],
    medicion: i.medicion_id === null ? null : (nombreMedicion.get(i.medicion_id) ?? "Medición"),
    alumno: alumno.get(i.alumno_id),
  }));

  return (
    <div className="space-y-6 animate-aparecer">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="titulo-pagina">Revisión de intentos</h1>
          <p className="subtitulo">
            Intentos que el antitrampas marcó como sospechosos. No cuentan para récords ni promedios hasta que los apruebes.
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm">
          <a href="/admin/revision" className={`rounded-lg px-3 py-1.5 ${!historial ? "bg-white shadow-sm font-semibold text-slate-900" : "text-slate-500"}`}>
            Pendientes
          </a>
          <a href="/admin/revision?ver=historial" className={`rounded-lg px-3 py-1.5 ${historial ? "bg-white shadow-sm font-semibold text-slate-900" : "text-slate-500"}`}>
            Ya revisados
          </a>
        </div>
      </div>

      <section className="tarjeta p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">{historial ? "Revisados" : `Pendientes (${filas.length})`}</h2>
        <p className="text-sm text-slate-500 mb-4">
          {historial
            ? "Puedes cambiar tu decisión en cualquier momento."
            : 'Compara la velocidad del intento con su velocidad "habitual". Si sospechas, revisa la ficha del alumno o pídele que lo repita en clase.'}
        </p>
        <TablaIntentos filas={filas} mostrarAlumno vacio={historial ? "Todavía no has revisado intentos." : "🎉 No hay intentos pendientes de revisión."} />
      </section>
    </div>
  );
}
