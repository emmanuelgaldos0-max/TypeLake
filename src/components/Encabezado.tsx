import Link from "next/link";
import Logo from "@/components/Logo";
import NavEnlaces, { type Enlace } from "@/components/NavEnlaces";
import { obtenerSesion } from "@/lib/supabase/server";

export default async function Encabezado() {
  const sesion = await obtenerSesion();
  const perfil = sesion?.perfil;

  const enlaces: Enlace[] =
    perfil?.rol === "admin"
      ? [
          { href: "/admin", texto: "Panel" },
          { href: "/admin/resultados", texto: "Resultados" },
          { href: "/admin/alumnos", texto: "Alumnos" },
          { href: "/admin/mediciones", texto: "Mediciones" },
          { href: "/admin/revision", texto: "Revisión" },
          { href: "/admin/memes", texto: "Memes" },
          { href: "/", texto: "Prueba" },
        ]
      : perfil?.rol === "alumno"
        ? [
            { href: "/", texto: "Practicar" },
            { href: "/progreso", texto: "Mi progreso" },
            { href: "/tablero", texto: "Tablero" },
            { href: "/cuenta", texto: "Mi cuenta" },
          ]
        : [
            { href: "/", texto: "Practicar" },
            { href: "/tablero", texto: "Tablero" },
          ];

  const iniciales = perfil ? `${perfil.nombres.charAt(0)}${perfil.apellidos.charAt(0)}`.toUpperCase() || "?" : "";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
        <Link href={perfil?.rol === "admin" ? "/admin" : "/"} className="shrink-0" aria-label="Inicio">
          <Logo />
        </Link>

        <div className="flex-1 min-w-0 flex justify-center">{enlaces.length > 0 && <NavEnlaces enlaces={enlaces} />}</div>

        {perfil ? (
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${perfil.rol === "admin" ? "bg-acento-500" : "bg-lago-600"}`}
              >
                {iniciales}
              </span>
              <span className="text-sm leading-tight">
                <span className="block font-semibold text-slate-800">
                  {perfil.nombres.split(" ")[0]} {perfil.apellidos.split(" ")[0]}
                </span>
                <span className="block text-xs text-slate-500">{perfil.rol === "admin" ? "Administrador" : "Alumno"}</span>
              </span>
            </div>
            <form action="/auth/salir" method="post">
              <button className="btn btn-secundario px-3 py-1.5">Salir</button>
            </form>
          </div>
        ) : (
          <Link href="/login" className="btn btn-primario shrink-0 px-4 py-2">
            Ingresar
          </Link>
        )}
      </div>
    </header>
  );
}
