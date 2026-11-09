"use client";

import { useState } from "react";
import Segmentado from "@/components/progreso/Segmentado";

export interface DatosTableroRestringido {
  /** Promedio de cada salón según cada fórmula visible (ya calculado en el servidor). */
  formulas: {
    id: number;
    nombre: string;
    descripcion: string;
    salones: { id: number; nombre: string; promedio: number | null; conPuntaje: number; alumnos: number }[];
  }[];
  /** Puntaje más alto del colegio, sin decir de quién es. */
  mejorColegio: number | null;
  /** Salón del alumno que mira (null si no inició sesión como alumno). */
  miSalon: { id: number; nombre: string; alumnos: { nombre: string; mejor: number | null }[] } | null;
}

const AZUL = "#2a78d6";
const NARANJA = "#eb6834";

/**
 * Tablero cuando el admin desactivó "ver datos de otros salones": solo promedios por
 * salón, el puntaje más alto del colegio y, para un alumno, el ranking de su propio salón.
 */
export default function TableroRestringido({ formulas, mejorColegio, miSalon }: DatosTableroRestringido) {
  const [formulaId, setFormulaId] = useState(formulas[0]?.id ?? 0);
  const formula = formulas.find((f) => f.id === formulaId) ?? formulas[0];
  const conDatos = (formula?.salones ?? []).filter((s) => s.promedio !== null).sort((a, b) => b.promedio! - a.promedio!);
  const max = Math.max(1, ...conDatos.map((s) => s.promedio!));
  const companeros = (miSalon?.alumnos ?? []).filter((a) => a.mejor !== null).sort((a, b) => b.mejor! - a.mejor!);
  const maxSalon = Math.max(1, ...companeros.map((a) => a.mejor!));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Tablero</h1>
        <p className="subtitulo">Promedio de cada salón y el mejor puntaje del colegio.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="tarjeta p-5">
          <div className="text-sm text-slate-500">Puntaje más alto del colegio</div>
          <div className="mt-1 text-3xl font-extrabold text-slate-900">
            {mejorColegio === null ? "—" : Math.round(mejorColegio * 10) / 10}
            {mejorColegio !== null && <span className="ml-1 text-base font-medium text-slate-500">ppm</span>}
          </div>
        </div>
        <div className="tarjeta p-5">
          <div className="text-sm text-slate-500">Salón líder{formula ? ` · ${formula.nombre}` : ""}</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 truncate">{conDatos[0]?.nombre ?? "—"}</div>
          {conDatos[0] && <div className="text-xs text-slate-400 mt-0.5">{conDatos[0].promedio!.toFixed(1)} ppm</div>}
        </div>
      </div>

      <div className={`grid gap-6 ${miSalon ? "lg:grid-cols-2" : ""}`}>
        <section className="tarjeta p-6">
          <h2 className="text-lg font-bold text-slate-900">Promedio por salón</h2>
          <p className="text-sm text-slate-500 mb-4">{formula ? formula.descripcion : "El profesor aún no publicó el promedio de salones."}</p>
          {formulas.length > 1 && (
            <div className="mb-5">
              <Segmentado etiqueta="Fórmula" valor={formulaId} onCambio={setFormulaId} opciones={formulas.map((f) => ({ valor: f.id, texto: f.nombre }))} />
            </div>
          )}
          {formula && conDatos.length === 0 && (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-8 text-center">Todavía no hay resultados.</p>
          )}
          <ol className="space-y-1.5">
            {conDatos.map((s, i) => {
              const mio = s.id === miSalon?.id;
              return (
                <li key={s.id} className={`flex items-center gap-3 text-sm rounded-md px-1 ${mio ? "bg-orange-50" : ""}`}>
                  <span className="w-6 shrink-0 text-right tabular-nums text-slate-400">{i + 1}</span>
                  <span className={`w-36 shrink-0 truncate ${mio ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                    {s.nombre}
                    {mio && " (tu salón)"}
                  </span>
                  <span className="flex-1 h-4 rounded bg-slate-100 overflow-hidden">
                    <span className="block h-full rounded-r" style={{ width: `${(s.promedio! / max) * 100}%`, background: mio ? NARANJA : AZUL }} />
                  </span>
                  <span className="w-12 shrink-0 text-right font-bold tabular-nums text-slate-900">{s.promedio!.toFixed(1)}</span>
                </li>
              );
            })}
          </ol>
        </section>

        {miSalon && (
          <section className="tarjeta p-6">
            <h2 className="text-lg font-bold text-slate-900">{miSalon.nombre}</h2>
            <p className="text-sm text-slate-500 mb-4">Mejor resultado de cada compañero de tu salón.</p>
            {companeros.length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-8 text-center">Tu salón todavía no tiene resultados.</p>
            ) : (
              <ol className="space-y-1.5">
                {companeros.map((a, i) => (
                  <li key={`${a.nombre}-${i}`} className="flex items-center gap-3 text-sm">
                    <span className="w-6 shrink-0 text-right tabular-nums text-slate-400">{i + 1}</span>
                    <span className="w-40 shrink-0 truncate text-slate-800">{a.nombre}</span>
                    <span className="flex-1 h-4 rounded bg-slate-100 overflow-hidden">
                      <span className="block h-full rounded-r" style={{ width: `${(a.mejor! / maxSalon) * 100}%`, background: AZUL }} />
                    </span>
                    <span className="w-12 shrink-0 text-right font-bold tabular-nums text-slate-900">{Math.round(a.mejor! * 10) / 10}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
