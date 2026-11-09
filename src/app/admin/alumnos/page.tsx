import ImportarAlumnos from "@/components/admin/ImportarAlumnos";
import TablaAlumnos, { type FilaTabla } from "@/components/admin/TablaAlumnos";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function PaginaAlumnos() {
  const db = await crearClienteServidor();
  const { data } = await db
    .from("perfiles")
    .select("id, usuario, nombres, apellidos, activo, salon_id, salones(seccion, grados(nombre, orden))")
    .eq("rol", "alumno");

  type Salon = { seccion: string; grados: { nombre: string; orden: number } | null } | null;
  const filas: FilaTabla[] = (data ?? [])
    .map((p) => {
      const s = p.salones as unknown as Salon;
      return {
        id: p.id as string,
        usuario: p.usuario as string,
        nombres: p.nombres as string,
        apellidos: p.apellidos as string,
        activo: p.activo as boolean,
        salon: s ? `${s.grados?.nombre ?? ""} ${s.seccion}` : "Sin salón",
        salonId: (p.salon_id as number | null) ?? null,
        orden: (s?.grados?.orden ?? 99) * 100 + (s?.seccion.charCodeAt(0) ?? 0),
      };
    })
    .sort((a, b) => a.orden - b.orden || a.apellidos.localeCompare(b.apellidos, "es"));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="titulo-pagina">Alumnos</h1>
        <p className="subtitulo">Crea las cuentas desde un Excel y entrega a cada alumno su usuario y contraseña.</p>
      </div>
      <TablaAlumnos filas={filas} />
      <ImportarAlumnos />
    </div>
  );
}
