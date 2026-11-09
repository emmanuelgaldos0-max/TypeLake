"use client";

import { useState } from "react";
import { cambiarMiClave } from "@/app/cuenta/acciones";
import Spinner from "@/components/ui/Spinner";
import { mensajeError } from "@/lib/errores";

export default function FormularioClave() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setListo(false);
    if (nueva !== repetir) return setError("Las contraseñas nuevas no coinciden.");
    setCargando(true);
    try {
      const fallo = await cambiarMiClave(actual, nueva);
      if (fallo) setError(fallo);
      else {
        setListo(true);
        setActual("");
        setNueva("");
        setRepetir("");
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="tarjeta p-6 space-y-4 animate-aparecer">
      <div>
        <h2 className="font-semibold text-slate-800">Cambiar contraseña</h2>
        <p className="text-sm text-slate-500 mt-1">
          Elige una que recuerdes y no la compartas. Si la olvidas, pídele a tu profesor que te dé una nueva.
        </p>
      </div>
      <div>
        <label className="etiqueta" htmlFor="actual">
          Contraseña actual
        </label>
        <input id="actual" type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required className="campo py-2.5" />
      </div>
      <div>
        <label className="etiqueta" htmlFor="nueva">
          Contraseña nueva
        </label>
        <input
          id="nueva"
          type="password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
          className="campo py-2.5"
        />
        <p className="text-xs text-slate-400 mt-1">Mínimo 6 caracteres.</p>
      </div>
      <div>
        <label className="etiqueta" htmlFor="repetir">
          Repite la contraseña nueva
        </label>
        <input
          id="repetir"
          type="password"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          autoComplete="new-password"
          required
          className="campo py-2.5"
        />
      </div>
      {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
      {listo && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          ¡Listo! Tu contraseña se cambió. Úsala la próxima vez que entres.
        </p>
      )}
      <button disabled={cargando} className="btn btn-primario w-full py-3">
        {cargando ? (
          <>
            <Spinner /> Guardando…
          </>
        ) : (
          "Cambiar contraseña"
        )}
      </button>
    </form>
  );
}
