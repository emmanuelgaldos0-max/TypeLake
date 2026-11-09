import type { Metadata } from "next";
import DashboardResultados from "@/components/admin/DashboardResultados";
import { cargarDashboard } from "@/lib/cargarDashboard";
import { crearClienteAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tablero · TypeLake" };

/**
 * Tablero público (sin iniciar sesión), por ejemplo para proyectarlo en clase.
 * Solo lectura: los datos se preparan en el servidor con nombres según la
 * configuración de privacidad, sin usuarios ni ids reales, y solo con las
 * fórmulas marcadas como visibles para alumnos.
 */
export default async function Tablero() {
  const datos = await cargarDashboard(crearClienteAdmin(), "publico");
  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
      <DashboardResultados {...datos} modo="publico" />
    </main>
  );
}
