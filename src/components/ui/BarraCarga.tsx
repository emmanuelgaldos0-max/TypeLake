"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Barra fina en la parte superior que aparece al cambiar de página
 * (clic en un enlace interno o envío de formulario) y se completa al llegar.
 * También se puede activar desde cualquier acción con:
 *   window.dispatchEvent(new Event("typelake:cargando"))  /  "typelake:listo"
 */
export default function BarraCarga() {
  const ruta = usePathname();
  const params = useSearchParams();
  const [estado, setEstado] = useState<"oculta" | "cargando" | "completa">("oculta");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iniciar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setEstado("cargando");
  };
  const terminar = () => {
    setEstado((e) => (e === "cargando" ? "completa" : e));
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado("oculta"), 350);
  };

  // Llegó la página nueva
  useEffect(() => {
    terminar();
  }, [ruta, params]);

  useEffect(() => {
    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      iniciar();
    };
    const alEnviar = () => iniciar();
    window.addEventListener("click", alClic, true);
    window.addEventListener("submit", alEnviar, true);
    window.addEventListener("typelake:cargando", iniciar);
    window.addEventListener("typelake:listo", terminar);
    return () => {
      window.removeEventListener("click", alClic, true);
      window.removeEventListener("submit", alEnviar, true);
      window.removeEventListener("typelake:cargando", iniciar);
      window.removeEventListener("typelake:listo", terminar);
    };
  }, []);

  if (estado === "oculta") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]" role="progressbar" aria-label="Cargando">
      <div
        className="h-full origin-left bg-gradient-to-r from-lago-400 via-lago-600 to-acento-500 shadow-[0_0_10px_rgba(42,120,214,0.6)]"
        style={
          estado === "cargando"
            ? { animation: "avance 8s cubic-bezier(0.1, 0.7, 0.3, 1) forwards" }
            : { transform: "scaleX(1)", opacity: 0, transition: "transform 0.2s ease-out, opacity 0.3s ease 0.15s" }
        }
      />
    </div>
  );
}
