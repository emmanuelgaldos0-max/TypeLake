"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarMeme, guardarMeme } from "@/app/memes/acciones";
import SelectorCriterio from "@/components/memes/SelectorCriterio";
import { describirCriterio, type CriterioMeme } from "@/lib/memes";

export interface MemeAdmin {
  id: number;
  url: string | null;
  estado: "pendiente" | "aprobado";
  criterio: CriterioMeme;
  autor: string;
  creadoEn: string;
}

const fecha = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });

export default function AdministrarMemes({ memes }: { memes: MemeAdmin[] }) {
  const pendientes = memes.filter((m) => m.estado === "pendiente");
  const aprobados = memes.filter((m) => m.estado === "aprobado");
  return (
    <>
      <section className="tarjeta p-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Esperando aprobación <span className="text-slate-400 font-normal">({pendientes.length})</span>
        </h2>
        <p className="text-sm text-slate-500 mb-4">Revisa que sean apropiados. Puedes ajustar cuándo aparecen antes de aprobarlos.</p>
        {pendientes.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-6 text-center">No hay memes pendientes.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendientes.map((m) => (
              <TarjetaMeme key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Aprobados <span className="text-slate-400 font-normal">({aprobados.length})</span>
        </h2>
        {aprobados.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-6 text-center">Todavía no hay memes aprobados.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {aprobados.map((m) => (
              <TarjetaMeme key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function TarjetaMeme({ m }: { m: MemeAdmin }) {
  const router = useRouter();
  const [criterio, setCriterio] = useState(m.criterio);
  const [editando, setEditando] = useState(m.estado === "pendiente");
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState("");
  const cambiado = JSON.stringify(criterio) !== JSON.stringify(m.criterio);

  const ejecutar = (accion: () => Promise<string | null>) =>
    iniciar(async () => {
      setError("");
      const fallo = await accion();
      if (fallo) setError(fallo);
      else {
        if (m.estado === "aprobado") setEditando(false);
        router.refresh();
      }
    });

  const borrar = () => {
    const texto = m.estado === "pendiente" ? "¿Rechazar este meme? Se borrará la imagen." : "¿Eliminar este meme? Dejará de aparecer y se borrará la imagen.";
    if (confirm(texto)) ejecutar(() => eliminarMeme(m.id));
  };

  return (
    <li className={`rounded-xl border p-3 text-sm ${m.estado === "pendiente" ? "border-amber-200 bg-amber-50/40" : "border-slate-200"}`}>
      {m.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- enlace temporal del bucket privado
        <img src={m.url} alt="Meme" className="h-44 w-full object-contain rounded-lg bg-slate-50" />
      ) : (
        <div className="h-44 rounded-lg bg-slate-100 grid place-items-center text-xs text-slate-400">Imagen no disponible</div>
      )}
      <div className="mt-2 text-xs text-slate-500">
        {m.autor} · {fecha.format(new Date(m.creadoEn))}
      </div>

      {editando ? (
        <div className="mt-3">
          <SelectorCriterio valor={criterio} onCambio={setCriterio} permitirPpm />
        </div>
      ) : (
        <div className="mt-2 font-medium text-slate-700">{describirCriterio(m.criterio)}</div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {m.estado === "pendiente" ? (
          <button onClick={() => ejecutar(() => guardarMeme(m.id, criterio, true))} disabled={pendiente} className="btn btn-exito px-3 py-1.5">
            Aprobar
          </button>
        ) : editando ? (
          <>
            <button onClick={() => ejecutar(() => guardarMeme(m.id, criterio, false))} disabled={pendiente || !cambiado} className="btn btn-primario px-3 py-1.5">
              Guardar
            </button>
            <button
              onClick={() => {
                setCriterio(m.criterio);
                setEditando(false);
              }}
              className="btn-enlace text-slate-500"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button onClick={() => setEditando(true)} className="btn-enlace">
            Cambiar cuándo aparece
          </button>
        )}
        <button onClick={borrar} disabled={pendiente} className="btn-enlace text-rose-600 ml-auto">
          {m.estado === "pendiente" ? "Rechazar" : "Eliminar"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </li>
  );
}
