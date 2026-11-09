"use client";

import { useEffect, useState } from "react";
import Segmentado from "@/components/progreso/Segmentado";
import { crearClienteNavegador } from "@/lib/supabase/client";

type Alcance = "salon" | "grado" | "colegio";
interface Fila {
  posicion: number;
  alumno: string;
  salon: string;
  mejor_ppm: number;
  soy_yo: boolean;
}

const AZUL = "#2a78d6";
const NARANJA = "#eb6834";

interface Props {
  /** false: el admin desactivó ver otros salones; solo se compara con el propio salón. */
  verOtrosSalones: boolean;
  /** Puntaje más alto del colegio (sin nombre); se muestra cuando no se ven otros salones. */
  mejorColegio: number | null;
}

export default function RankingAlumnos({ verOtrosSalones, mejorColegio }: Props) {
  const [alcance, setAlcance] = useState<Alcance>("salon");
  const [limite, setLimite] = useState<number>(10);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    setFilas(null);
    crearClienteNavegador()
      .rpc("ranking_alumnos", { p_alcance: alcance, p_limite: limite || null })
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) setError(error.message);
        else setFilas((data as Fila[]).map((f) => ({ ...f, mejor_ppm: Number(f.mejor_ppm) })));
      });
    return () => {
      vigente = false;
    };
  }, [alcance, limite]);

  const max = Math.max(1, ...(filas ?? []).map((f) => f.mejor_ppm));
  const yo = filas?.find((f) => f.soy_yo);
  const fueraDelTop = yo && limite > 0 && yo.posicion > limite;
  const visibles = (filas ?? []).filter((f) => !(fueraDelTop && f.soy_yo));

  return (
    <section className="tarjeta p-6 animate-aparecer">
      <h2 className="font-semibold text-slate-800">¿Cómo vas frente a los demás?</h2>
      <p className="text-sm text-slate-500 mb-4">
        Mejor resultado válido de cada alumno{verOtrosSalones ? "" : " de tu salón"}, en palabras por minuto.
      </p>

      {!verOtrosSalones && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
          <span className="text-sm text-amber-900">Puntaje más alto del colegio</span>
          <span className="text-xl font-extrabold tabular-nums text-amber-700">
            {mejorColegio === null ? "—" : Math.round(mejorColegio * 10) / 10}
            {mejorColegio !== null && <span className="text-sm font-medium ml-1">ppm</span>}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {verOtrosSalones && (
          <Segmentado
            etiqueta="Comparar con"
            valor={alcance}
            onCambio={setAlcance}
            opciones={[
              { valor: "salon", texto: "Mi salón" },
              { valor: "grado", texto: "Mi grado" },
              { valor: "colegio", texto: "Colegio" },
            ]}
          />
        )}
        <Segmentado
          etiqueta="Mostrar"
          valor={limite}
          onCambio={setLimite}
          opciones={[
            { valor: 10, texto: "Top 10" },
            { valor: 20, texto: "Top 20" },
            { valor: 0, texto: "Todos" },
          ]}
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!filas && !error && <p className="text-sm text-slate-400">Cargando…</p>}
      {filas && filas.length === 0 && <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-6 text-center">Todavía nadie tiene resultados aquí.</p>}

      {filas && filas.length > 0 && (
        <ol className="space-y-1.5">
          {visibles.map((f) => (
            <FilaBarra key={`${f.posicion}-${f.alumno}`} f={f} max={max} />
          ))}
          {fueraDelTop && yo && (
            <>
              <li className="text-center text-slate-400 text-xs leading-3">⋯</li>
              <FilaBarra f={yo} max={max} />
            </>
          )}
        </ol>
      )}
      {filas && !yo && filas.length > 0 && (
        <p className="text-xs text-slate-500 mt-3">Aún no apareces aquí: haz una prueba válida para entrar al ranking.</p>
      )}
    </section>
  );
}

function FilaBarra({ f, max }: { f: Fila; max: number }) {
  return (
    <li className={`flex items-center gap-2 text-sm rounded-md px-1 ${f.soy_yo ? "bg-orange-50" : ""}`} title={`${f.alumno} · ${f.salon} · ${f.mejor_ppm} ppm`}>
      <span className="w-6 shrink-0 text-right tabular-nums text-slate-400">{f.posicion}</span>
      <span className={`w-32 shrink-0 truncate ${f.soy_yo ? "font-semibold text-slate-900" : "text-slate-700"}`}>
        {f.soy_yo ? `Tú · ${f.alumno.split(" ")[0]}` : f.alumno}
      </span>
      <span className="flex-1 h-4">
        <span
          className="block h-full rounded-r transition-[width] duration-500"
          style={{ width: `${(f.mejor_ppm / max) * 100}%`, background: f.soy_yo ? NARANJA : AZUL }}
        />
      </span>
      <span className="w-10 shrink-0 tabular-nums text-slate-700 text-right">{Math.round(f.mejor_ppm)}</span>
    </li>
  );
}
