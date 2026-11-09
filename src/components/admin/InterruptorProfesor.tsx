"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { borrarResultadosProfesor, cambiarMostrarProfesor } from "@/app/admin/acciones";
import { mensajeError } from "@/lib/errores";

/** Interruptor para mostrar (u ocultar) el récord del profesor a los alumnos, como inspiración. */
export default function InterruptorProfesor({ inicial, record }: { inicial: boolean; record: number | null }) {
  const [mostrar, setMostrar] = useState(inicial);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState("");

  const ejecutar = (accion: () => Promise<string | null>, deshacer?: () => void) => {
    setError("");
    iniciar(async () => {
      try {
        const fallo = await accion();
        if (fallo) {
          deshacer?.();
          setError(fallo);
        }
      } catch (e) {
        deshacer?.();
        setError(mensajeError(e));
      }
    });
  };

  const cambiar = () => {
    const nuevo = !mostrar;
    setMostrar(nuevo);
    ejecutar(() => cambiarMostrarProfesor(nuevo), () => setMostrar(!nuevo));
  };

  const borrar = () => {
    if (!confirm("¿Borrar todas tus pruebas guardadas? Tu récord volverá a empezar.")) return;
    ejecutar(() => borrarResultadosProfesor());
  };

  return (
    <section className="tarjeta p-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="font-semibold text-slate-900">Mostrar mi récord a los alumnos</h2>
          <p className="text-sm text-slate-500 mt-1">
            {mostrar ? (
              <>
                <b className="text-slate-700">Activado:</b> los alumnos y el tablero ven tu mejor resultado como reto para superar.
              </>
            ) : (
              <>
                <b className="text-slate-700">Desactivado:</b> tu resultado solo lo ves tú.
              </>
            )}{" "}
            Tus pruebas se guardan aparte: no cuentan para ningún salón, promedio, ranking ni medición.
          </p>
          <p className="text-sm text-slate-600 mt-3">
            Tu récord:{" "}
            <b className="text-slate-900 tabular-nums">{record === null ? "aún no tienes pruebas" : `${Math.round(record)} ppm`}</b>
            {" · "}
            <Link href="/" className="text-lago-600 font-medium hover:underline">
              Hacer una prueba
            </Link>
            {record !== null && (
              <>
                {" · "}
                <button type="button" onClick={borrar} disabled={pendiente} className="text-rose-600 font-medium hover:underline disabled:opacity-60">
                  Borrar mis pruebas
                </button>
              </>
            )}
          </p>
          {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={mostrar}
          aria-label="Mostrar mi récord a los alumnos"
          onClick={cambiar}
          disabled={pendiente}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${mostrar ? "bg-lago-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${mostrar ? "translate-x-5" : ""}`} />
        </button>
      </div>
    </section>
  );
}
