"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Enlace {
  href: string;
  texto: string;
}

/** Enlaces del menú con el activo resaltado. */
export default function NavEnlaces({ enlaces }: { enlaces: Enlace[] }) {
  const ruta = usePathname();
  // El enlace más específico que coincida con la ruta es el activo
  const coincide = (href: string) => (href === "/" || href === "/admin" ? ruta === href : ruta === href || ruta.startsWith(href + "/"));
  const activo = (href: string) => coincide(href);

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {enlaces.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            activo(e.href) ? "bg-lago-50 text-lago-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}
