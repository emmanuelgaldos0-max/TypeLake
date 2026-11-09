"use client";

import { useMemo, useState, useTransition } from "react";
import { cambiarActivo, restablecerClave } from "@/app/admin/acciones";

export interface FilaTabla {
  id: string;
  usuario: string;
  nombres: string;
  apellidos: string;
  activo: boolean;
  salon: string;
  orden: number;
}

export default function TablaAlumnos({ filas }: { filas: FilaTabla[] }) {
  const salones = useMemo(() => Array.from(new Set(filas.map((f) => f.salon))), [filas]);
  const [salon, setSalon] = useState("todos");
  const [buscar, setBuscar] = useState("");
  const [claves, setClaves] = useState<Record<string, string>>({});
  const [pendiente, iniciar] = useTransition();

  const visibles = filas.filter(
    (f) =>
      (salon === "todos" || f.salon === salon) &&
      `${f.nombres} ${f.apellidos} ${f.usuario}`.toLowerCase().includes(buscar.toLowerCase()),
  );

  const nuevaClave = (f: FilaTabla) => {
    if (!confirm(`¿Generar una contraseña nueva para ${f.nombres} ${f.apellidos}? La anterior dejará de funcionar.`)) return;
    iniciar(async () => {
      const clave = await restablecerClave(f.id);
      setClaves((c) => ({ ...c, [f.id]: clave }));
    });
  };

  const alternar = (f: FilaTabla) => {
    const accion = f.activo ? "desactivar" : "activar";
    if (!confirm(`¿Seguro que quieres ${accion} a ${f.nombres} ${f.apellidos}?`)) return;
    iniciar(() => cambiarActivo(f.id, !f.activo));
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-800 mr-auto">Cuentas ({filas.length})</h2>
        <select value={salon} onChange={(e) => setSalon(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-slate-200">
          <option value="todos">Todos los salones</option>
          {salones.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar alumno…"
          className="text-sm px-3 py-2 rounded-lg border border-slate-200"
        />
      </div>

      {filas.length === 0 ? (
        <p className="text-slate-500 text-sm">Todavía no hay alumnos. Importa un Excel para empezar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">Salón</th>
                <th className="py-2 pr-3 font-medium">Apellidos y nombres</th>
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className={`border-b border-slate-50 ${f.activo ? "" : "opacity-50"}`}>
                  <td className="py-2 pr-3 whitespace-nowrap">{f.salon}</td>
                  <td className="py-2 pr-3">{f.apellidos}, {f.nombres}</td>
                  <td className="py-2 pr-3 font-mono">{f.usuario}</td>
                  <td className="py-2 pr-3">{f.activo ? "Activo" : "Desactivado"}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {claves[f.id] ? (
                      <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded mr-2">{claves[f.id]}</span>
                    ) : (
                      <button disabled={pendiente} onClick={() => nuevaClave(f)} className="text-sky-700 hover:underline mr-3">
                        Nueva contraseña
                      </button>
                    )}
                    <button disabled={pendiente} onClick={() => alternar(f)} className="text-slate-500 hover:underline">
                      {f.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
