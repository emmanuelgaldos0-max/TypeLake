import DashboardResultados from "@/components/admin/DashboardResultados";
import { cargarDashboard } from "@/lib/cargarDashboard";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function PaginaResultados() {
  const datos = await cargarDashboard(await crearClienteServidor(), "admin");
  return <DashboardResultados {...datos} modo="admin" />;
}
