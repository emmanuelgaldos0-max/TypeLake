import { redirect } from "next/navigation";
import FormularioClave from "@/components/FormularioClave";
import { obtenerSesion } from "@/lib/supabase/server";

export default async function PaginaCuenta() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol === "admin") redirect("/admin");
  const { perfil } = sesion;

  return (
    <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="titulo-pagina">Mi cuenta</h1>
        <p className="subtitulo">
          {perfil.nombres} {perfil.apellidos} · usuario <b className="font-mono">{perfil.usuario}</b>
        </p>
      </div>
      <FormularioClave />
    </main>
  );
}
