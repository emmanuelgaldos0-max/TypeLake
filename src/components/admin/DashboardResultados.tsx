"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import EditorFormulas from "@/components/admin/EditorFormulas";
import Sparkline from "@/components/admin/Sparkline";
import {
  aplicarFormula,
  describirFormula,
  fechaCorta,
  filtrarFuente,
  promedio,
  type AlumnoDash,
  type Formula,
  type Fuente,
  type IntentoDash,
  type SalonDash,
} from "@/lib/estadisticas";

const AZUL = "#2a78d6";
const POR_PAGINA = 50;

type Orden = "mejor" | "promedio" | "intentos" | "nombre" | "salon" | "ultima";

interface FilaAlumno {
  alumno: AlumnoDash;
  mejor: number | null;
  promedio: number | null;
  intentos: number;
  ultima: string | null;
  tendencia: number[];
}

export default function DashboardResultados({
  salones,
  alumnos,
  intentos,
  mediciones,
  formulas: formulasIniciales,
}: {
  salones: SalonDash[];
  alumnos: AlumnoDash[];
  intentos: IntentoDash[];
  mediciones: { id: number; nombre: string }[];
  formulas: Formula[];
}) {
  // ── Filtros ──
  const [fuenteClave, setFuenteClave] = useState<string>(mediciones.length ? "med" : "todo");
  const [grado, setGrado] = useState("todos");
  const [salonFiltro, setSalonFiltro] = useState("todos");
  const [buscar, setBuscar] = useState("");
  const [orden, setOrden] = useState<{ col: Orden; desc: boolean }>({ col: "mejor", desc: true });
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  // ── Fórmulas ──
  const [formulas, setFormulas] = useState(formulasIniciales);
  const [formulaId, setFormulaId] = useState<number | null>(formulasIniciales[0]?.id ?? null);
  const [editor, setEditor] = useState(false);
  const formula = formulas.find((f) => f.id === formulaId) ?? formulas[0];

  const fuente: Fuente =
    fuenteClave === "todo" ? { tipo: "todo" } : fuenteClave === "practica" ? { tipo: "practica" } : { tipo: "mediciones", medicion: fuenteClave === "med" ? null : Number(fuenteClave) };

  const grados = useMemo(() => Array.from(new Set(salones.map((s) => s.grado))), [salones]);
  const salonesVisibles = salones.filter((s) => grado === "todos" || s.grado === grado);
  const alumnosVisibles = alumnos.filter((a) => grado === "todos" || a.grado === grado);
  const intentosFuente = useMemo(() => filtrarFuente(intentos, fuente), [intentos, fuenteClave]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Estadísticas por alumno ──
  const filas: FilaAlumno[] = useMemo(() => {
    const porAlumno = new Map<string, IntentoDash[]>();
    for (const i of intentosFuente) porAlumno.set(i.a, [...(porAlumno.get(i.a) ?? []), i]);
    return alumnosVisibles.map((a) => {
      const lista = porAlumno.get(a.id) ?? [];
      return {
        alumno: a,
        mejor: lista.length ? Math.max(...lista.map((i) => i.ppm)) : null,
        promedio: promedio(lista.map((i) => i.ppm)),
        intentos: lista.length,
        ultima: lista.length ? lista[lista.length - 1].t : null,
        tendencia: lista.slice(-10).map((i) => i.ppm),
      };
    });
  }, [alumnosVisibles, intentosFuente]);

  const conResultado = filas.filter((f) => f.mejor !== null);
  const mejorAlumno = conResultado.reduce<FilaAlumno | null>((m, f) => (!m || f.mejor! > m.mejor! ? f : m), null);
  const promedioColegio = promedio(conResultado.map((f) => f.mejor!));
  const totalIntentos = filas.reduce((s, f) => s + f.intentos, 0);

  // ── Ranking de salones con la fórmula ──
  const ranking = useMemo(
    () => (formula ? aplicarFormula(formula, salonesVisibles, alumnos, intentos).sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1)) : []),
    [formula, salonesVisibles, alumnos, intentos],
  );
  const maxRanking = Math.max(1, ...ranking.map((r) => r.promedio ?? 0));

  // ── Por grado ──
  const porGrado = grados
    .filter((g) => grado === "todos" || g === grado)
    .map((g) => {
      const delGrado = filas.filter((f) => f.alumno.grado === g);
      const con = delGrado.filter((f) => f.mejor !== null);
      return { grado: g, alumnos: delGrado.length, con: con.length, promedio: promedio(con.map((f) => f.mejor!)), mejor: con.length ? Math.max(...con.map((f) => f.mejor!)) : null };
    });
  const maxGrado = Math.max(1, ...porGrado.map((g) => g.promedio ?? 0));

  // ── Tabla de alumnos ──
  const tabla = filas
    .filter((f) => salonFiltro === "todos" || f.alumno.salon === salonFiltro)
    .filter((f) => `${f.alumno.nombre} ${f.alumno.usuario}`.toLowerCase().includes(buscar.toLowerCase()))
    .sort((a, b) => {
      const dir = orden.desc ? -1 : 1;
      const v = (f: FilaAlumno): number | string => {
        switch (orden.col) {
          case "nombre":
            return f.alumno.nombre;
          case "salon":
            return f.alumno.gradoOrden * 1000 + (f.alumno.salonId ?? 0);
          case "ultima":
            return f.ultima ?? "";
          default:
            return f[orden.col] ?? -1;
        }
      };
      const va = v(a);
      const vb = v(b);
      return (typeof va === "string" ? va.localeCompare(vb as string, "es") : va - (vb as number)) * dir;
    });
  const posicion = new Map([...conResultado].sort((a, b) => b.mejor! - a.mejor!).map((f, i) => [f.alumno.id, i + 1]));

  const ordenarPor = (col: Orden) => setOrden((o) => ({ col, desc: o.col === col ? !o.desc : col !== "nombre" && col !== "salon" }));

  const nombreFuente =
    fuenteClave === "todo"
      ? "Práctica y mediciones"
      : fuenteClave === "practica"
        ? "Práctica libre"
        : fuenteClave === "med"
          ? "Todas las mediciones"
          : (mediciones.find((m) => String(m.id) === fuenteClave)?.nombre ?? "");

  const exportar = () => {
    const libro = XLSX.utils.book_new();
    const r = (n: number | null) => (n === null ? "" : Math.round(n * 10) / 10);
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(
        ranking.map((x, i) => ({
          Puesto: x.promedio === null ? "" : i + 1,
          Salón: x.salon.nombre,
          Promedio: r(x.promedio),
          "Alumnos considerados": x.considerados,
          "Alumnos con nota": x.conPuntaje,
          "Total alumnos": x.alumnos,
          "Mejor PPM": r(x.mejor),
          "Peor PPM": r(x.peor),
        })),
      ),
      "Salones",
    );
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(porGrado.map((g) => ({ Grado: g.grado, Promedio: r(g.promedio), "Alumnos con resultado": g.con, "Total alumnos": g.alumnos, "Mejor PPM": r(g.mejor) }))),
      "Grados",
    );
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(
        tabla.map((f) => ({
          Puesto: posicion.get(f.alumno.id) ?? "",
          Alumno: f.alumno.nombre,
          Usuario: f.alumno.usuario,
          Salón: f.alumno.salon,
          "Mejor PPM": r(f.mejor),
          "Promedio PPM": r(f.promedio),
          Intentos: f.intentos,
          "Última prueba": f.ultima ? fechaCorta.format(new Date(f.ultima)) : "",
        })),
      ),
      "Alumnos",
    );
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([
        ["Exportado", new Date().toLocaleString("es-PE")],
        ["Datos de alumnos y grados", nombreFuente],
        ["Fórmula de salones", formula ? `${formula.nombre}: ${describirFormula(formula)}` : ""],
        ["Grado", grado === "todos" ? "Todos" : grado],
      ]),
      "Filtros",
    );
    XLSX.writeFile(libro, `resultados_typelake_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-aparecer">
      {/* Encabezado + filtros en una sola fila */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="titulo-pagina">Resultados</h1>
          <p className="subtitulo">Cada alumno cuenta con su mejor resultado válido.</p>
        </div>
        <label className="text-sm">
          <span className="etiqueta">Datos de</span>
          <select className="campo w-56" value={fuenteClave} onChange={(e) => setFuenteClave(e.target.value)}>
            <option value="med">Todas las mediciones</option>
            {mediciones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
            <option value="practica">Práctica libre</option>
            <option value="todo">Práctica y mediciones</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="etiqueta">Grado</span>
          <select
            className="campo w-48"
            value={grado}
            onChange={(e) => {
              setGrado(e.target.value);
              setSalonFiltro("todos");
            }}
          >
            <option value="todos">Todos los grados</option>
            {grados.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-exito" onClick={exportar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Exportar a Excel
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Indicador titulo="Alumnos con resultado" valor={`${conResultado.length}`} nota={`de ${filas.length} alumnos`} />
        <Indicador titulo="Promedio del colegio" valor={promedioColegio === null ? "—" : promedioColegio.toFixed(1)} unidad="ppm" nota="promedio de los mejores" />
        <Indicador
          titulo="Mejor resultado"
          valor={mejorAlumno ? String(Math.round(mejorAlumno.mejor!)) : "—"}
          unidad="ppm"
          nota={mejorAlumno ? `${mejorAlumno.alumno.nombre.split(",")[1]?.trim().split(" ")[0]} ${mejorAlumno.alumno.nombre.split(" ")[0]} · ${mejorAlumno.alumno.salon}` : undefined}
        />
        <Indicador titulo="Intentos" valor={String(totalIntentos)} nota={nombreFuente.toLowerCase()} />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Ranking de salones */}
        <section className="tarjeta p-6 lg:col-span-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="mr-auto">
              <h2 className="text-lg font-bold text-slate-900">Ranking de salones</h2>
              <p className="text-sm text-slate-500">{formula ? describirFormula(formula, mediciones.find((m) => m.id === formula.medicion_id)?.nombre) : "Crea una fórmula para comparar salones."}</p>
            </div>
            {formulas.length > 0 && (
              <select className="campo w-auto" value={formula?.id ?? ""} onChange={(e) => setFormulaId(Number(e.target.value))}>
                {formulas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            )}
            <button className={`btn ${editor ? "btn-primario" : "btn-secundario"}`} onClick={() => setEditor((e) => !e)}>
              {editor ? "Cerrar fórmulas" : "Gestionar fórmulas"}
            </button>
          </div>

          <ol className="mt-5 space-y-2">
            {ranking.map((r, i) => (
              <li key={r.salon.id} className="flex items-center gap-3 text-sm" title={`${r.salon.nombre}: ${r.considerados} alumnos considerados de ${r.alumnos}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${i < 3 && r.promedio !== null ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                  {r.promedio === null ? "–" : i + 1}
                </span>
                <span className="w-40 shrink-0 truncate font-medium text-slate-800">{r.salon.nombre}</span>
                <span className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-r transition-[width] duration-500" style={{ width: `${((r.promedio ?? 0) / maxRanking) * 100}%`, background: AZUL }} />
                </span>
                <span className="w-12 shrink-0 text-right font-bold tabular-nums text-slate-900">{r.promedio === null ? "—" : r.promedio.toFixed(1)}</span>
                <span className="w-20 shrink-0 text-right text-xs text-slate-400 tabular-nums">
                  {r.considerados}/{r.alumnos} al.
                </span>
              </li>
            ))}
          </ol>
          {editor && (
            <EditorFormulas
              formulas={formulas}
              mediciones={mediciones}
              onCambio={setFormulas}
              onElegir={(id) => setFormulaId(id)}
            />
          )}
        </section>

        {/* Por grado */}
        <section className="tarjeta p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Promedio por grado</h2>
          <p className="text-sm text-slate-500 mb-5">{nombreFuente} · promedio del mejor resultado de cada alumno</p>
          <ul className="space-y-4">
            {porGrado.map((g) => (
              <li key={g.grado}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span className="font-medium text-slate-800">{g.grado}</span>
                  <span className="font-bold tabular-nums text-slate-900">{g.promedio === null ? "—" : `${g.promedio.toFixed(1)} ppm`}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${((g.promedio ?? 0) / maxGrado) * 100}%`, background: AZUL }} />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {g.con} de {g.alumnos} con resultado{g.mejor !== null && ` · mejor: ${Math.round(g.mejor)} ppm`}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Alumnos */}
      <section className="tarjeta p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="mr-auto">
            <h2 className="text-lg font-bold text-slate-900">Alumnos</h2>
            <p className="text-sm text-slate-500">
              {nombreFuente} · {tabla.length} alumnos · haz clic en un nombre para ver su ficha
            </p>
          </div>
          <select className="campo w-auto" value={salonFiltro} onChange={(e) => setSalonFiltro(e.target.value)}>
            <option value="todos">Todos los salones</option>
            {salonesVisibles.map((s) => (
              <option key={s.id}>{s.nombre}</option>
            ))}
          </select>
          <input className="campo w-52" placeholder="Buscar alumno…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-y border-slate-100 bg-slate-50/60">
                <th className="py-2.5 pl-6 pr-2 font-semibold w-12">#</th>
                <Th col="nombre" orden={orden} onClick={ordenarPor}>
                  Alumno
                </Th>
                <Th col="salon" orden={orden} onClick={ordenarPor}>
                  Salón
                </Th>
                <Th col="mejor" orden={orden} onClick={ordenarPor} derecha>
                  Mejor
                </Th>
                <Th col="promedio" orden={orden} onClick={ordenarPor} derecha>
                  Promedio
                </Th>
                <Th col="intentos" orden={orden} onClick={ordenarPor} derecha>
                  Intentos
                </Th>
                <Th col="ultima" orden={orden} onClick={ordenarPor}>
                  Última
                </Th>
                <th className="py-2.5 pr-6 font-semibold">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {tabla.slice(0, mostrar).map((f) => (
                <tr key={f.alumno.id} className="border-b border-slate-50 hover:bg-lago-50/40 transition">
                  <td className="py-2 pl-6 pr-2 tabular-nums text-slate-400">{posicion.get(f.alumno.id) ?? "–"}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/admin/alumnos/${f.alumno.id}`} className="font-medium text-slate-800 hover:text-lago-700 hover:underline">
                      {f.alumno.nombre}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className="chip">{f.alumno.salon}</span>
                  </td>
                  <td className="py-2 pr-3 text-right font-bold tabular-nums text-slate-900">{f.mejor === null ? "—" : Math.round(f.mejor * 10) / 10}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{f.promedio === null ? "—" : f.promedio.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{f.intentos}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{f.ultima ? fechaCorta.format(new Date(f.ultima)) : "—"}</td>
                  <td className="py-2 pr-6">
                    <Sparkline valores={f.tendencia} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tabla.length > mostrar && (
          <div className="text-center mt-4">
            <button className="btn btn-secundario" onClick={() => setMostrar((m) => m + POR_PAGINA)}>
              Ver más ({tabla.length - mostrar} restantes)
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Indicador({ titulo, valor, unidad, nota }: { titulo: string; valor: string; unidad?: string; nota?: string }) {
  return (
    <div className="tarjeta p-5">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div className="mt-1 text-3xl font-extrabold text-slate-900">
        {valor}
        {unidad && valor !== "—" && <span className="ml-1 text-base font-medium text-slate-500">{unidad}</span>}
      </div>
      {nota && <div className="text-xs text-slate-400 mt-0.5 truncate">{nota}</div>}
    </div>
  );
}

function Th({
  col,
  orden,
  onClick,
  derecha,
  children,
}: {
  col: Orden;
  orden: { col: Orden; desc: boolean };
  onClick: (c: Orden) => void;
  derecha?: boolean;
  children: React.ReactNode;
}) {
  const activo = orden.col === col;
  return (
    <th className={`py-2.5 pr-3 font-semibold ${derecha ? "text-right" : ""}`}>
      <button onClick={() => onClick(col)} className={`uppercase tracking-wider hover:text-slate-700 ${activo ? "text-lago-700" : ""}`}>
        {children}
        {activo && (orden.desc ? " ↓" : " ↑")}
      </button>
    </th>
  );
}
