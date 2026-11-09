import ImportarMedicion from "@/components/admin/ImportarMedicion";
import { crearClienteServidor } from "@/lib/supabase/server";

const fechaCorta = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" });

export default async function PaginaMediciones() {
  const db = await crearClienteServidor();
  const { data: mediciones } = await db.from("mediciones").select("id, nombre, codigo, inicia_en").order("inicia_en", { ascending: false });

  const resumen = await Promise.all(
    (mediciones ?? []).map(async (m) => {
      const [{ data }, { data: sinNota }] = await Promise.all([
        db.from("intentos").select("alumno_id, ppm").eq("medicion_id", m.id).in("estado", ["valido", "aprobado"]),
        db.from("evaluados_sin_nota").select("alumno_id").eq("medicion_id", m.id),
      ]);
      const mejores = new Map<string, number>();
      for (const i of data ?? []) mejores.set(i.alumno_id, Math.max(mejores.get(i.alumno_id) ?? 0, Number(i.ppm)));
      const valores = [...mejores.values()];
      return {
        ...m,
        alumnos: valores.length,
        sinNota: (sinNota ?? []).filter((e) => !mejores.has(e.alumno_id)).length,
        promedio: valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null,
        mejor: valores.length ? Math.max(...valores) : null,
      };
    }),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="titulo-pagina">Mediciones</h1>
        <p className="subtitulo">Pruebas oficiales tomadas en el colegio. Por ahora puedes importar las que ya tienes en Excel.</p>
      </div>

      <section className="tarjeta p-6 animate-aparecer">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Mediciones registradas</h2>
        {resumen.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay mediciones.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">Medición</th>
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium text-right">Evaluados</th>
                <th className="py-2 pr-3 font-medium text-right">Con nota</th>
                <th className="py-2 pr-3 font-medium text-right" title="Se les evaluó pero decidieron no dar su evaluación (x, W, Justify)">
                  Sin nota
                </th>
                <th className="py-2 pr-3 font-medium text-right">Promedio (mejor de cada uno)</th>
                <th className="py-2 font-medium text-right">Mejor PPM</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((m) => (
                <tr key={m.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium text-slate-800">{m.nombre}</td>
                  <td className="py-2 pr-3 text-slate-600">{fechaCorta.format(new Date(m.inicia_en))}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium">{m.alumnos + m.sinNota}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{m.alumnos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{m.sinNota}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{m.promedio === null ? "—" : m.promedio.toFixed(1)}</td>
                  <td className="py-2 text-right tabular-nums">{m.mejor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ImportarMedicion />
    </div>
  );
}
