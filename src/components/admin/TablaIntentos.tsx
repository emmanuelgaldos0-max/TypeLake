"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { revisarIntento } from "@/app/admin/acciones";
import Spinner from "@/components/ui/Spinner";
import { fechaHora } from "@/lib/estadisticas";

export interface FilaIntento {
  id: number;
  fecha: string;
  ppm: number;
  precision: number | null;
  referencia: number | null;
  estado: "valido" | "sospechoso" | "aprobado" | "rechazado";
  motivos: string[];
  medicion: string | null; // nombre de la medición, o null si es práctica
  alumno?: { id: string; nombre: string; salon: string };
}

export const MOTIVOS: Record<string, string> = {
  salto_brusco: "Salto brusco frente a su velocidad habitual",
  velocidad_imposible: "Velocidad imposible",
  ritmo_robotico: "Ritmo de teclas robótico",
  insercion_masiva: "Texto ingresado de golpe",
  datos_inconsistentes: "Datos inconsistentes",
  salio_de_la_pestana: "Salió de la pestaña en la medición",
  validado_por_repeticion: "Validado: repitió esa velocidad",
  importado_de_excel: "Importado desde Excel",
};

const ESTADOS: Record<FilaIntento["estado"], { texto: string; clase: string }> = {
  valido: { texto: "Válido", clase: "bg-emerald-50 text-emerald-700" },
  aprobado: { texto: "Aprobado", clase: "bg-lago-50 text-lago-700" },
  sospechoso: { texto: "En revisión", clase: "bg-amber-50 text-amber-700" },
  rechazado: { texto: "Rechazado", clase: "bg-rose-50 text-rose-700" },
};

export default function TablaIntentos({ filas, mostrarAlumno = false, vacio }: { filas: FilaIntento[]; mostrarAlumno?: boolean; vacio: string }) {
  const router = useRouter();
  const [estados, setEstados] = useState<Record<number, FilaIntento["estado"]>>({});
  const [ocupado, setOcupado] = useState<number | null>(null);

  const decidir = async (f: FilaIntento, decision: "aprobado" | "rechazado") => {
    setOcupado(f.id);
    try {
      await revisarIntento(f.id, decision);
      setEstados((e) => ({ ...e, [f.id]: decision }));
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(null);
    }
  };

  if (!filas.length) return <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-8 text-center">{vacio}</p>;

  return (
    <div className="overflow-x-auto -mx-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-y border-slate-100 bg-slate-50/60">
            {mostrarAlumno && <th className="py-2.5 pl-6 pr-3 font-semibold">Alumno</th>}
            <th className={`py-2.5 pr-3 font-semibold ${mostrarAlumno ? "" : "pl-6"}`}>Fecha</th>
            <th className="py-2.5 pr-3 font-semibold">Tipo</th>
            <th className="py-2.5 pr-3 font-semibold text-right">PPM</th>
            <th className="py-2.5 pr-3 font-semibold text-right">Precisión</th>
            <th className="py-2.5 pr-3 font-semibold text-right">Habitual</th>
            <th className="py-2.5 pr-3 font-semibold">Estado</th>
            <th className="py-2.5 pr-3 font-semibold">Motivo</th>
            <th className="py-2.5 pr-6 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const estado = estados[f.id] ?? f.estado;
            const e = ESTADOS[estado];
            return (
              <tr key={f.id} className={`border-b border-slate-50 transition hover:bg-lago-50/40 ${estado === "rechazado" ? "opacity-60" : ""}`}>
                {mostrarAlumno && f.alumno && (
                  <td className="py-2 pl-6 pr-3">
                    <Link href={`/admin/alumnos/${f.alumno.id}`} className="font-medium text-slate-800 hover:text-lago-700 hover:underline">
                      {f.alumno.nombre}
                    </Link>
                    <div className="text-xs text-slate-400">{f.alumno.salon}</div>
                  </td>
                )}
                <td className={`py-2 pr-3 whitespace-nowrap text-slate-600 ${mostrarAlumno ? "" : "pl-6"}`}>{fechaHora.format(new Date(f.fecha))}</td>
                <td className="py-2 pr-3">
                  {f.medicion ? <span className="chip bg-violet-50 text-violet-700">{f.medicion}</span> : <span className="chip">Práctica</span>}
                </td>
                <td className="py-2 pr-3 text-right font-bold tabular-nums text-slate-900">{f.ppm}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{f.precision === null ? "—" : `${f.precision}%`}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{f.referencia === null ? "—" : f.referencia}</td>
                <td className="py-2 pr-3">
                  <span className={`chip ${e.clase}`}>{e.texto}</span>
                </td>
                <td className="py-2 pr-3 text-xs text-slate-500 max-w-56">{f.motivos.map((m) => MOTIVOS[m] ?? m).join(" · ") || "—"}</td>
                <td className="py-2 pr-6 text-right whitespace-nowrap">
                  {ocupado === f.id ? (
                    <Spinner className="h-4 w-4 inline text-lago-600" />
                  ) : (
                    <>
                      {estado !== "aprobado" && estado !== "valido" && (
                        <button className="btn-enlace text-emerald-700 hover:bg-emerald-50" onClick={() => decidir(f, "aprobado")}>
                          Aprobar
                        </button>
                      )}
                      {estado !== "rechazado" && (
                        <button className="btn-enlace text-rose-600 hover:bg-rose-50" onClick={() => decidir(f, "rechazado")}>
                          Rechazar
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
