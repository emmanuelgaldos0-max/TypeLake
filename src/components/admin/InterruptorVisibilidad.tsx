"use client";

import { useState, useTransition } from "react";
import { cambiarVerOtrosSalones } from "@/app/admin/acciones";
import { mensajeError } from "@/lib/errores";

/** Interruptor para que los alumnos vean (o no) nombres y puntajes de otros salones. */
export default function InterruptorVisibilidad({ inicial }: { inicial: boolean }) {
  const [ver, setVer] = useState(inicial);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState("");

  const cambiar = () => {
    const nuevo = !ver;
    setError("");
    setVer(nuevo);
    iniciar(async () => {
      try {
        const fallo = await cambiarVerOtrosSalones(nuevo);
        if (fallo) {
          setVer(!nuevo);
          setError(fallo);
        }
      } catch (e) {
        setVer(!nuevo);
        setError(mensajeError(e));
      }
    });
  };

  return (
    <section className="tarjeta p-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="font-semibold text-slate-900">Ver datos de otros salones</h2>
          <p className="text-sm text-slate-500 mt-1">
            {ver ? (
              <>
                <b className="text-slate-700">Activado:</b> los alumnos ven los rankings de su grado y de todo el colegio, con nombres y puntajes.
              </>
            ) : (
              <>
                <b className="text-slate-700">Desactivado:</b> los alumnos solo ven nombres y puntajes de su propio salón. Del resto del colegio
                solo ven el promedio por salón y el puntaje más alto, sin el nombre de quién lo hizo.
              </>
            )}
          </p>
          {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ver}
          aria-label="Ver datos de otros salones"
          onClick={cambiar}
          disabled={pendiente}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${ver ? "bg-lago-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${ver ? "translate-x-5" : ""}`} />
        </button>
      </div>
    </section>
  );
}
