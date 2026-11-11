"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarMisMemes, retirarMiMeme } from "@/app/memes/acciones";
import SubirMeme from "@/components/memes/SubirMeme";
import { MAX_MB, describirCriterio, type CriterioMeme } from "@/lib/memes";

export interface MiMeme {
  id: number;
  url: string | null;
  estado: "pendiente" | "aprobado";
  criterio: CriterioMeme;
}

/** Sección de memes en "Mi cuenta": activarlos/apagarlos, subir y ver los propios. */
export default function MemesAlumno({ activos: inicial, bloqueados, mios }: { activos: boolean; bloqueados: boolean; mios: MiMeme[] }) {
  const router = useRouter();
  const [activos, setActivos] = useState(inicial);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState("");

  const alternar = () => {
    const nuevo = !activos;
    setActivos(nuevo);
    setError("");
    iniciar(async () => {
      const fallo = await cambiarMisMemes(nuevo);
      if (fallo) {
        setActivos(!nuevo);
        setError(fallo);
      }
    });
  };

  const retirar = (id: number) =>
    iniciar(async () => {
      const fallo = await retirarMiMeme(id);
      if (fallo) setError(fallo);
      router.refresh();
    });

  if (bloqueados) {
    return (
      <section className="tarjeta p-6">
        <h2 className="font-semibold text-slate-800">Memes</h2>
        <p className="text-sm text-slate-500 mt-1">Tu profesor desactivó los memes para ti.</p>
      </section>
    );
  }

  return (
    <section className="tarjeta p-6 space-y-5 animate-aparecer">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="font-semibold text-slate-800">Memes</h2>
          <p className="text-sm text-slate-500 mt-1">Al terminar cada prueba aparece un meme según cómo te fue frente a tu récord.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={activos}
          aria-label="Mostrar memes"
          onClick={alternar}
          disabled={pendiente}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${activos ? "bg-lago-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${activos ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="font-medium text-slate-800 mb-1">Sube tu propio meme</h3>
        <p className="text-sm text-slate-500 mb-3">Tu profesor lo revisará; si lo aprueba, les aparecerá a todos. Imágenes o GIF de máximo {MAX_MB} MB.</p>
        <SubirMeme esAdmin={false} />
      </div>

      {mios.length > 0 && (
        <div className="border-t border-slate-100 pt-5">
          <h3 className="font-medium text-slate-800 mb-3">Tus memes</h3>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {mios.map((m) => (
              <li key={m.id} className="rounded-xl border border-slate-200 p-2 text-xs">
                {m.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- enlace temporal del bucket privado
                  <img src={m.url} alt="Tu meme" className="h-24 w-full object-contain rounded-lg bg-slate-50" />
                ) : (
                  <div className="h-24 rounded-lg bg-slate-100" />
                )}
                <div className="mt-2 text-slate-500">{describirCriterio(m.criterio)}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className={`chip ${m.estado === "aprobado" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {m.estado === "aprobado" ? "Aprobado" : "Esperando aprobación"}
                  </span>
                  {m.estado === "pendiente" && (
                    <button onClick={() => retirar(m.id)} disabled={pendiente} className="btn-enlace text-slate-500">
                      Retirar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  );
}
