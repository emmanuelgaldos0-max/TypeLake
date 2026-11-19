import PanelSinInternet from "@/components/admin/PanelSinInternet";
import { codigoSalon } from "@/lib/sinInternetCripto";
import { crearClienteAdmin } from "@/lib/supabase/server";

export default async function PaginaSinInternet() {
  // El layout de /admin ya exige ser admin
  const db = crearClienteAdmin();
  const [{ data }, { data: cfg }, { data: salones }] = await Promise.all([
    db.from("mediciones").select("id, nombre, inicia_en").order("inicia_en", { ascending: false }),
    db.from("configuracion").select("anio_escolar").single(),
    db.from("salones").select("id, anio, seccion, grados(nombre, orden)"),
  ]);
  const mediciones = (data ?? []).map((m) => ({ id: m.id as number, nombre: m.nombre as string }));
  type Salon = { id: number; anio: number; seccion: string; grados: { nombre: string; orden: number } | null };
  const codigos = ((salones ?? []) as unknown as Salon[])
    .filter((s) => s.anio === cfg?.anio_escolar)
    .sort((a, b) => (a.grados?.orden ?? 99) - (b.grados?.orden ?? 99) || a.seccion.localeCompare(b.seccion))
    .map((s) => ({ nombre: `${s.grados?.nombre ?? ""} ${s.seccion}`.trim(), codigo: codigoSalon(process.env.SUPABASE_SECRET_KEY!, s.id) }));

  return (
    <div className="space-y-6 animate-aparecer">
      <div>
        <h1 className="titulo-pagina">PCs sin internet</h1>
        <p className="subtitulo">
          La app de escritorio TypeLake funciona sin conexión: los alumnos entran con su usuario y el código de su salón, y los resultados se guardan en la PC
          hasta que los traigas en una USB.
        </p>
      </div>
      <PanelSinInternet mediciones={mediciones} codigos={codigos} />
    </div>
  );
}
