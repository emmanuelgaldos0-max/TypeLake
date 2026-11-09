import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/supabase/server";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.perfil.rol !== "admin") redirect("/login");
  return <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">{children}</main>;
}
