"use client";

import { useState } from "react";
import { eliminarFormula, guardarFormula } from "@/app/admin/acciones";
import Spinner from "@/components/ui/Spinner";
import { describirFormula, type Formula, type TipoFormula } from "@/lib/estadisticas";

const VACIA: Omit<Formula, "id"> = {
  nombre: "",
  tipo: "mejores_peores",
  mejores: 5,
  peores: 5,
  fuente: "mediciones",
  medicion_id: null,
  sin_intentos: "ignorar",
  visible_alumnos: false,
};

const TIPOS: { valor: TipoFormula; texto: string }[] = [
  { valor: "mejores_peores", texto: "X mejores + Y peores" },
  { valor: "general", texto: "Promedio de todos" },
  { valor: "top", texto: "Solo los X mejores" },
  { valor: "mediana", texto: "Mediana del salón" },
];

export default function EditorFormulas({
  formulas,
  mediciones,
  onCambio,
  onElegir,
}: {
  formulas: Formula[];
  mediciones: { id: number; nombre: string }[];
  onCambio: (f: Formula[]) => void;
  onElegir: (id: number) => void;
}) {
  const [editando, setEditando] = useState<Omit<Formula, "id"> & { id?: number }>(VACIA);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof Formula>(k: K, v: Formula[K]) => setEditando((e) => ({ ...e, [k]: v }));

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const id = await guardarFormula(editando);
      const nueva = { ...editando, id } as Formula;
      onCambio(editando.id ? formulas.map((f) => (f.id === id ? nueva : f)) : [...formulas, nueva]);
      onElegir(id);
      setEditando(VACIA);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (f: Formula) => {
    if (!confirm(`¿Eliminar la fórmula "${f.nombre}"?`)) return;
    await eliminarFormula(f.id);
    onCambio(formulas.filter((x) => x.id !== f.id));
  };

  const medicionNombre = (id: number | null) => mediciones.find((m) => m.id === id)?.nombre;

  return (
    <div className="mt-5 grid lg:grid-cols-2 gap-5 rounded-2xl border border-lago-100 bg-lago-50/40 p-5 animate-aparecer">
      {/* Lista */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-3">Fórmulas guardadas</h3>
        <ul className="space-y-2">
          {formulas.map((f) => (
            <li key={f.id} className="rounded-xl bg-white border border-slate-200 px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 flex items-center gap-2">
                    {f.nombre}
                    {f.visible_alumnos && <span className="chip bg-emerald-50 text-emerald-700">visible para alumnos</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{describirFormula(f, medicionNombre(f.medicion_id))}</div>
                </div>
                <button className="btn-enlace" onClick={() => setEditando(f)}>
                  Editar
                </button>
                <button className="btn-enlace text-rose-600 hover:bg-rose-50" onClick={() => eliminar(f)}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Formulario */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-3">
        <h3 className="font-semibold text-slate-800">{editando.id ? "Editar fórmula" : "Nueva fórmula"}</h3>
        <div>
          <label className="etiqueta">Nombre</label>
          <input className="campo" value={editando.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="ej. Premio por salón" />
        </div>
        <div>
          <label className="etiqueta">Cómo se calcula</label>
          <select className="campo" value={editando.tipo} onChange={(e) => set("tipo", e.target.value as TipoFormula)}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </div>
        {(editando.tipo === "mejores_peores" || editando.tipo === "top") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiqueta">X mejores</label>
              <input type="number" min={0} className="campo" value={editando.mejores ?? 0} onChange={(e) => set("mejores", Number(e.target.value))} />
            </div>
            {editando.tipo === "mejores_peores" && (
              <div>
                <label className="etiqueta">Y peores</label>
                <input type="number" min={0} className="campo" value={editando.peores ?? 0} onChange={(e) => set("peores", Number(e.target.value))} />
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiqueta">Datos</label>
            <select
              className="campo"
              value={editando.fuente === "todo" ? "todo" : String(editando.medicion_id ?? "med")}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "todo") setEditando((x) => ({ ...x, fuente: "todo", medicion_id: null }));
                else setEditando((x) => ({ ...x, fuente: "mediciones", medicion_id: v === "med" ? null : Number(v) }));
              }}
            >
              <option value="med">Todas las mediciones</option>
              {mediciones.map((m) => (
                <option key={m.id} value={m.id}>
                  Solo: {m.nombre}
                </option>
              ))}
              <option value="todo">Práctica y mediciones</option>
            </select>
          </div>
          <div>
            <label className="etiqueta">Alumno sin nota</label>
            <select className="campo" value={editando.sin_intentos} onChange={(e) => set("sin_intentos", e.target.value as Formula["sin_intentos"])}>
              <option value="ignorar">No cuenta</option>
              <option value="cero">Cuenta como 0</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={editando.visible_alumnos} onChange={(e) => set("visible_alumnos", e.target.checked)} />
          Los alumnos pueden ver esta fórmula en &quot;Mi progreso&quot;
        </label>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{describirFormula(editando, medicionNombre(editando.medicion_id))}</p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primario" disabled={guardando} onClick={guardar}>
            {guardando && <Spinner />} {editando.id ? "Guardar cambios" : "Crear fórmula"}
          </button>
          {editando.id && (
            <button className="btn btn-secundario" onClick={() => setEditando(VACIA)}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
