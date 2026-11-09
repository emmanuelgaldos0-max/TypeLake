"use client";

import { useEffect, useState } from "react";
import Segmentado from "@/components/progreso/Segmentado";
import { crearClienteNavegador } from "@/lib/supabase/client";

interface Fila {
  salon_id: number;
  grado: string;
  seccion: string;
  alumnos: number;
  con_puntaje: number;
  promedio: number | null;
}

const AZUL = "#2a78d6";
const NARANJA = "#eb6834";

export default function PromedioSalones({ formulas, miSalon }: { formulas: { id: number; nombre: string }[]; miSalon: number | null }) {
  const [formula, setFormula] = useState<number | null>(formulas.at(-1)?.id ?? null);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (formula === null) return;
    let vigente = true;
    setFilas(null);
    crearClienteNavegador()
      .rpc("promedio_salones", { p_formula_id: formula })
      .then(({ data, error }) => {
        if (!vigente) return;
        if (error) setError(error.message);
        else setFilas((data as Fila[]).map((f) => ({ ...f, promedio: f.promedio === null ? null : Number(f.promedio) })));
      });
    return () => {
      vigente = false;
    };
  }, [formula]);

  const conDatos = (filas ?? []).filter((f) => f.promedio !== null).sort((a, b) => b.promedio! - a.promedio!);
  const sinDatos = (filas ?? []).filter((f) => f.promedio === null);
  const max = Math.max(1, ...conDatos.map((f) => f.promedio!));
  const posMiSalon = conDatos.findIndex((f) => f.salon_id === miSalon);

  return (
    <section className="tarjeta p-6 animate-aparecer">
      <h2 className="font-semibold text-slate-800">Promedio por salón</h2>
      <p className="text-sm text-slate-500 mb-4">
        {posMiSalon >= 0 ? `Tu salón va en el puesto ${posMiSalon + 1} de ${conDatos.length}.` : "Así van los salones del colegio."}
      </p>

      {formulas.length > 1 && (
        <div className="mb-5">
          <Segmentado etiqueta="Fórmula" valor={formula ?? 0} onCambio={setFormula} opciones={formulas.map((f) => ({ valor: f.id, texto: f.nombre }))} />
        </div>
      )}

      {formula === null && <p className="text-sm text-slate-500">El profesor aún no publicó el promedio de salones.</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {formula !== null && !filas && !error && <p className="text-sm text-slate-400">Cargando…</p>}
      {filas && conDatos.length === 0 && (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-6 text-center">Todavía no hay resultados para esta fórmula.</p>
      )}

      {conDatos.length > 0 && (
        <ol className="space-y-1.5">
          {conDatos.map((f, i) => {
            const mio = f.salon_id === miSalon;
            return (
              <li
                key={f.salon_id}
                className={`flex items-center gap-2 text-sm rounded-md px-1 ${mio ? "bg-orange-50" : ""}`}
                title={`${f.grado} ${f.seccion}: ${f.promedio} ppm · ${f.con_puntaje} de ${f.alumnos} alumnos con resultado`}
              >
                <span className="w-6 shrink-0 text-right tabular-nums text-slate-400">{i + 1}</span>
                <span className={`w-36 shrink-0 truncate ${mio ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                  {f.grado} {f.seccion}
                  {mio && " (tu salón)"}
                </span>
                <span className="flex-1 h-4">
                  <span className="block h-full rounded-r transition-[width] duration-500" style={{ width: `${(f.promedio! / max) * 100}%`, background: mio ? NARANJA : AZUL }} />
                </span>
                <span className="w-12 shrink-0 tabular-nums text-slate-700 text-right">{f.promedio!.toFixed(1)}</span>
              </li>
            );
          })}
        </ol>
      )}
      {sinDatos.length > 0 && conDatos.length > 0 && (
        <p className="text-xs text-slate-400 mt-3">Sin resultados todavía: {sinDatos.map((f) => `${f.grado} ${f.seccion}`).join(", ")}.</p>
      )}
    </section>
  );
}
