import PanelSinInternet from "@/components/admin/PanelSinInternet";
import { crearClienteAdmin } from "@/lib/supabase/server";

export default async function PaginaSinInternet() {
  // El layout de /admin ya exige ser admin
  const { data } = await crearClienteAdmin().from("mediciones").select("id, nombre, inicia_en").order("inicia_en", { ascending: false });
  const mediciones = (data ?? []).map((m) => ({ id: m.id as number, nombre: m.nombre as string }));

  return (
    <div className="space-y-6 animate-aparecer">
      <div>
        <h1 className="titulo-pagina">PCs sin internet</h1>
        <p className="subtitulo">
          La app de escritorio TypeLake funciona sin conexión: los alumnos entran con su usuario y contraseña y los resultados se guardan en la PC
          hasta que los traigas en una USB.
        </p>
      </div>
      <PanelSinInternet mediciones={mediciones} />
    </div>
  );
}
