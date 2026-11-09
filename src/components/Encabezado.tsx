import Link from "next/link";
import { obtenerSesion } from "@/lib/supabase/server";

export default async function Encabezado() {
  const sesion = await obtenerSesion();
  const perfil = sesion?.perfil;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-sky-600 text-white grid place-items-center font-bold">T</div>
          <span className="text-xl font-bold text-slate-800">TypeLake</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {perfil?.rol === "admin" && (
            <>
              <Link href="/admin" className="text-slate-600 hover:text-sky-700">Panel</Link>
              <Link href="/admin/alumnos" className="text-slate-600 hover:text-sky-700">Alumnos</Link>
            </>
          )}
          {perfil ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-700 hidden sm:inline">
                {perfil.nombres.split(" ")[0]} {perfil.apellidos.split(" ")[0]}
              </span>
              <form action="/auth/salir" method="post">
                <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Salir</button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700">Ingresar</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
