"use client";

import { CATEGORIAS, type CategoriaRecord, type CriterioMeme } from "@/lib/memes";

/** Elige para qué resultado sale un meme: frente al récord o (solo admin) por rango de PPM. */
export default function SelectorCriterio({
  valor,
  onCambio,
  permitirPpm,
}: {
  valor: CriterioMeme;
  onCambio: (c: CriterioMeme) => void;
  permitirPpm: boolean;
}) {
  const numero = (t: string) => (t.trim() === "" ? null : Number(t));
  return (
    <div className="space-y-2">
      {permitirPpm && (
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm" role="radiogroup" aria-label="Tipo de criterio">
          {(["record", "ppm"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={valor.criterio === c}
              onClick={() => onCambio(c === "record" ? { criterio: "record", categoria: "nuevo_record" } : { criterio: "ppm", ppmMin: null, ppmMax: null })}
              className={`rounded-md px-3 py-1 font-medium transition ${valor.criterio === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {c === "record" ? "Frente a su récord" : "Por rango de PPM"}
            </button>
          ))}
        </div>
      )}
      {valor.criterio === "record" ? (
        <select
          value={valor.categoria}
          onChange={(e) => onCambio({ criterio: "record", categoria: e.target.value as CategoriaRecord })}
          className="campo"
          aria-label="Para qué resultado"
        >
          {CATEGORIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.texto}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Desde</span>
          <input
            type="number"
            min={0}
            step="any"
            value={valor.ppmMin ?? ""}
            onChange={(e) => onCambio({ ...valor, ppmMin: numero(e.target.value) })}
            placeholder="sin mínimo"
            className="campo w-28"
            aria-label="PPM mínimo"
          />
          <span>hasta menos de</span>
          <input
            type="number"
            min={0}
            step="any"
            value={valor.ppmMax ?? ""}
            onChange={(e) => onCambio({ ...valor, ppmMax: numero(e.target.value) })}
            placeholder="sin máximo"
            className="campo w-28"
            aria-label="PPM máximo"
          />
          <span>ppm</span>
        </div>
      )}
    </div>
  );
}
