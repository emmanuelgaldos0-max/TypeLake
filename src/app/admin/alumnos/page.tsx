import ImportarAlumnos from "@/components/admin/ImportarAlumnos";
import TablaAlumnos, { type FilaTabla } from "@/components/admin/TablaAlumnos";
import { CLAVE_CAMBIADA_POR_ALUMNO } from "@/lib/credenciales";
import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/server";

export default async function PaginaAlumnos() {
  const db = await crearClienteServidor();
  const { data } = await db
    .from("perfiles")
    .select("id, usuario, nombres, apellidos, activo, salon_id, salones(seccion, grados(nombre, orden)), credenciales(clave)")
    .eq("rol", "alumno");

  // Alumnos con memes bloqueados (si la migración 12 aún no se aplicó, ninguno)
  const { data: bloqueos } = await crearClienteAdmin().from("preferencias_memes").select("alumno_id").eq("bloqueados", true);
  const memesBloqueados = new Set((bloqueos ?? []).map((b) => b.alumno_id as string));

  type Salon = { seccion: string; grados: { nombre: string; orden: number } | null } | null;
  const filas: FilaTabla[] = (data ?? [])
    .map((p) => {
      const s = p.salones as unknown as Salon;
      const cred = p.credenciales as unknown as { clave: string } | { clave: string }[] | null;
      const clave = Array.isArray(cred) ? cred[0]?.clave : cred?.clave;
      return {
        id: p.id as string,
        usuario: p.usuario as string,
        nombres: p.nombres as string,
        apellidos: p.apellidos as string,
        activo: p.activo as boolean,
        salon: s ? `${s.grados?.nombre ?? ""} ${s.seccion}` : "Sin salón",
        salonId: (p.salon_id as number | null) ?? null,
        clavePropia: clave === CLAVE_CAMBIADA_POR_ALUMNO,
        memesBloqueados: memesBloqueados.has(p.id as string),
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
