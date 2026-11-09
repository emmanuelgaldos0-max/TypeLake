"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import EditorFormulas from "@/components/admin/EditorFormulas";
import Sparkline from "@/components/admin/Sparkline";
import {
  aplicarFormula,
  describirFormula,
  evaluadosSinNota,
  fechaCorta,
  filtrarFuente,
  promedio,
  type AlumnoDash,
  type EvaluadoSinNota,
  type Formula,
  type Fuente,
  type IntentoDash,
  type SalonDash,
} from "@/lib/estadisticas";

const AZUL = "#2a78d6";
const POR_PAGINA = 50;

type Pestana = "promedios" | "salon" | "todos";
type Orden = "mejor" | "promedio" | "intentos" | "nombre" | "salon" | "ultima";

interface FilaAlumno {
  alumno: AlumnoDash;
  mejor: number | null;
  promedio: number | null;
  intentos: number;
  ultima: string | null;
  tendencia: number[];
  /** Evaluado en la fuente elegida, pero decidió no dar su evaluación. */
  evaluadoSinNota: boolean;
}

interface Props {
  salones: SalonDash[];
  alumnos: AlumnoDash[];
  intentos: IntentoDash[];
  sinNota: EvaluadoSinNota[];
  mediciones: { id: number; nombre: string }[];
  formulas: Formula[];
  /** admin: edita fórmulas, exporta y enlaza a las fichas. publico: solo lectura. */
  modo: "admin" | "publico";
}

export default function DashboardResultados({ salones, alumnos, intentos, sinNota, mediciones, formulas: formulasIniciales, modo }: Props) {
  const esAdmin = modo === "admin";
  const [pestana, setPestana] = useState<Pestana>("promedios");

  // ── Filtros globales ──
  const [fuenteClave, setFuenteClave] = useState<string>(mediciones.length ? "med" : "todo");
  const [grado, setGrado] = useState("todos");

  // ── Fórmulas ──
  const [formulas, setFormulas] = useState(formulasIniciales);
  const [formulaId, setFormulaId] = useState<number | null>(formulasIniciales[0]?.id ?? null);
  const formula = formulas.find((f) => f.id === formulaId) ?? formulas[0];

  const fuente: Fuente =
    fuenteClave === "todo" ? { tipo: "todo" } : fuenteClave === "practica" ? { tipo: "practica" } : { tipo: "mediciones", medicion: fuenteClave === "med" ? null : Number(fuenteClave) };
  const nombreFuente =
    fuenteClave === "todo"
      ? "Práctica y mediciones"
      : fuenteClave === "practica"
        ? "Práctica libre"
        : fuenteClave === "med"
          ? "Todas las mediciones"
          : (mediciones.find((m) => String(m.id) === fuenteClave)?.nombre ?? "");

  const grados = useMemo(() => Array.from(new Set(salones.map((s) => s.grado))), [salones]);
  const salonesVisibles = useMemo(() => salones.filter((s) => grado === "todos" || s.grado === grado), [salones, grado]);
  const intentosFuente = useMemo(() => filtrarFuente(intentos, fuente), [intentos, fuenteClave]); // eslint-disable-line react-hooks/exhaustive-deps
  const declinaron = useMemo(() => evaluadosSinNota(sinNota, fuente), [sinNota, fuenteClave]); // eslint-disable-line react-hooks/exhaustive-deps

  // Estadísticas de cada alumno (según la fuente elegida)
  const filas: FilaAlumno[] = useMemo(() => {
    const porAlumno = new Map<string, IntentoDash[]>();
    for (const i of intentosFuente) porAlumno.set(i.a, [...(porAlumno.get(i.a) ?? []), i]);
    return alumnos
      .filter((a) => grado === "todos" || a.grado === grado)
      .map((a) => {
        const lista = porAlumno.get(a.id) ?? [];
        return {
          alumno: a,
          mejor: lista.length ? Math.max(...lista.map((i) => i.ppm)) : null,
          promedio: promedio(lista.map((i) => i.ppm)),
          intentos: lista.length,
          ultima: lista.length ? lista[lista.length - 1].t : null,
          tendencia: lista.slice(-10).map((i) => i.ppm),
          evaluadoSinNota: !lista.length && declinaron.has(a.id),
        };
      });
  }, [alumnos, intentosFuente, declinaron, grado]);

  const ranking = useMemo(
    () => (formula ? aplicarFormula(formula, salonesVisibles, alumnos, intentos, sinNota).sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1)) : []),
    [formula, salonesVisibles, alumnos, intentos, sinNota],
  );

  const exportar = () => {
    const libro = XLSX.utils.book_new();
    const r = (n: number | null) => (n === null ? "" : Math.round(n * 10) / 10);
    const ordenadas = [...filas].sort((a, b) => (b.mejor ?? -1) - (a.mejor ?? -1));
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
      "Promedio de salones",
    );
    for (const s of salonesVisibles) {
      const del = ordenadas.filter((f) => f.alumno.salonId === s.id);
      XLSX.utils.book_append_sheet(
        libro,
        XLSX.utils.json_to_sheet(
          del.map((f, i) => ({
            Puesto: f.mejor === null ? "" : i + 1,
            Alumno: f.alumno.nombre,
            Usuario: f.alumno.usuario,
            "Mejor PPM": r(f.mejor),
            "Promedio PPM": r(f.promedio),
            Intentos: f.intentos,
            Observación: f.mejor !== null ? "" : f.evaluadoSinNota ? "Evaluado sin nota" : "Sin evaluar",
          })),
        ),
        s.nombre.replace(/[\\/?*[\]:]/g, "").slice(0, 31),
      );
    }
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(
        ordenadas.map((f, i) => ({
          Puesto: f.mejor === null ? "" : i + 1,
          Alumno: f.alumno.nombre,
          Salón: f.alumno.salon,
          "Mejor PPM": r(f.mejor),
          "Promedio PPM": r(f.promedio),
          Intentos: f.intentos,
          "Última prueba": f.ultima ? fechaCorta.format(new Date(f.ultima)) : "",
        })),
      ),
      "Todos los salones",
    );
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.aoa_to_sheet([
        ["Exportado", new Date().toLocaleString("es-PE")],
        ["Datos de alumnos", nombreFuente],
        ["Fórmula de salones", formula ? `${formula.nombre}: ${describirFormula(formula)}` : ""],
        ["Grado", grado === "todos" ? "Todos" : grado],
      ]),
      "Filtros",
    );
    XLSX.writeFile(libro, `resultados_typelake_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const pestanas: { id: Pestana; texto: string }[] = [
    { id: "promedios", texto: "Promedio de salones" },
    { id: "salon", texto: "Por salón" },
    { id: "todos", texto: "Todos los salones" },
  ];

  return (
    <div className="space-y-6 animate-aparecer">
      {/* Encabezado + filtros en una sola fila */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="titulo-pagina">{esAdmin ? "Resultados" : "Tablero del concurso"}</h1>
          <p className="subtitulo">Cada alumno cuenta con su mejor resultado válido, en palabras por minuto (ppm).</p>
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
          <select className="campo w-48" value={grado} onChange={(e) => setGrado(e.target.value)}>
            <option value="todos">Todos los grados</option>
            {grados.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        {esAdmin && (
          <button className="btn btn-exito" onClick={exportar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Exportar a Excel
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div role="tablist" className="flex gap-1 rounded-2xl bg-white/70 border border-slate-200/70 p-1 w-fit max-w-full overflow-x-auto shadow-sm">
        {pestanas.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              pestana === p.id ? "bg-lago-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {pestana === "promedios" && (
        <PestanaPromedios
          esAdmin={esAdmin}
          filas={filas}
          ranking={ranking}
          formulas={formulas}
          formula={formula}
          setFormulaId={setFormulaId}
          setFormulas={setFormulas}
          mediciones={mediciones}
          grados={grados.filter((g) => grado === "todos" || g === grado)}
          nombreFuente={nombreFuente}
        />
      )}
      {pestana === "salon" && <PestanaSalon esAdmin={esAdmin} filas={filas} salones={salonesVisibles} nombreFuente={nombreFuente} ranking={ranking} formula={formula} />}
      {pestana === "todos" && <PestanaTodos esAdmin={esAdmin} filas={filas} salones={salonesVisibles} nombreFuente={nombreFuente} />}
    </div>
  );
}

// ═══════════════════════ Pestaña 1: Promedio de salones ═══════════════════════

function PestanaPromedios({
  esAdmin,
  filas,
  ranking,
  formulas,
  formula,
  setFormulaId,
  setFormulas,
  mediciones,
  grados,
  nombreFuente,
}: {
  esAdmin: boolean;
  filas: FilaAlumno[];
  ranking: ReturnType<typeof aplicarFormula>;
  formulas: Formula[];
  formula: Formula | undefined;
  setFormulaId: (id: number) => void;
  setFormulas: (f: Formula[]) => void;
  mediciones: { id: number; nombre: string }[];
  grados: string[];
  nombreFuente: string;
}) {
  const [editor, setEditor] = useState(false);
  const conResultado = filas.filter((f) => f.mejor !== null);
  const mejor = conResultado.reduce<FilaAlumno | null>((m, f) => (!m || f.mejor! > m.mejor! ? f : m), null);
  const promedioColegio = promedio(conResultado.map((f) => f.mejor!));
  const maxRanking = Math.max(1, ...ranking.map((r) => r.promedio ?? 0));
  const lider = ranking.find((r) => r.promedio !== null);

  const porGrado = grados.map((g) => {
    const delGrado = filas.filter((f) => f.alumno.grado === g);
    const con = delGrado.filter((f) => f.mejor !== null);
    return { grado: g, alumnos: delGrado.length, con: con.length, promedio: promedio(con.map((f) => f.mejor!)), mejor: con.length ? Math.max(...con.map((f) => f.mejor!)) : null };
  });
  const maxGrado = Math.max(1, ...porGrado.map((g) => g.promedio ?? 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Indicador titulo="Salón líder" valor={lider?.salon.nombre ?? "—"} nota={lider ? `${lider.promedio?.toFixed(1)} ppm · ${formula?.nombre}` : undefined} chico />
        <Indicador titulo="Promedio del colegio" valor={promedioColegio === null ? "—" : promedioColegio.toFixed(1)} unidad="ppm" nota={nombreFuente.toLowerCase()} />
        <Indicador titulo="Mejor resultado" valor={mejor ? String(Math.round(mejor.mejor! * 10) / 10) : "—"} unidad="ppm" nota={mejor ? `${mejor.alumno.nombre} · ${mejor.alumno.salon}` : undefined} />
        <Indicador
          titulo="Alumnos evaluados"
          valor={`${conResultado.length + filas.filter((f) => f.evaluadoSinNota).length}`}
          nota={`de ${filas.length} · ${conResultado.length} con nota${
            filas.some((f) => f.evaluadoSinNota) ? ` · ${filas.filter((f) => f.evaluadoSinNota).length} sin nota` : ""
          }`}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <section className="tarjeta p-6 lg:col-span-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="mr-auto">
              <h2 className="text-lg font-bold text-slate-900">Ranking de salones</h2>
              <p className="text-sm text-slate-500">
                {formula ? describirFormula(formula, mediciones.find((m) => m.id === formula.medicion_id)?.nombre) : "Todavía no hay fórmulas publicadas."}
              </p>
            </div>
            {formulas.length > 1 && (
              <select className="campo w-auto" value={formula?.id ?? ""} onChange={(e) => setFormulaId(Number(e.target.value))}>
                {formulas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            )}
            {esAdmin && (
              <button className={`btn ${editor ? "btn-primario" : "btn-secundario"}`} onClick={() => setEditor((e) => !e)}>
                {editor ? "Cerrar fórmulas" : "Gestionar fórmulas"}
              </button>
            )}
          </div>

          <ol className="mt-5 space-y-2">
            {ranking.map((r, i) => (
              <li key={r.salon.id} className="flex items-center gap-3 text-sm" title={`${r.salon.nombre}: ${r.considerados} alumnos considerados de ${r.alumnos}`}>
                <Medalla puesto={r.promedio === null ? null : i + 1} />
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
          {esAdmin && editor && <EditorFormulas formulas={formulas} mediciones={mediciones} onCambio={setFormulas} onElegir={setFormulaId} />}
        </section>

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
    </div>
  );
}

// ═══════════════════════ Pestaña 2: Por salón ═══════════════════════

function PestanaSalon({
  esAdmin,
  filas,
  salones,
  nombreFuente,
  ranking,
  formula,
}: {
  esAdmin: boolean;
  filas: FilaAlumno[];
  salones: SalonDash[];
  nombreFuente: string;
  ranking: ReturnType<typeof aplicarFormula>;
  formula: Formula | undefined;
}) {
  const [salonId, setSalonId] = useState<number | null>(salones[0]?.id ?? null);
  const salon = salones.find((s) => s.id === salonId) ?? salones[0];
  if (!salon) return <p className="tarjeta p-6 text-sm text-slate-500">No hay salones para este filtro.</p>;

  const del = filas.filter((f) => f.alumno.salonId === salon.id).sort((a, b) => (b.mejor ?? -1) - (a.mejor ?? -1));
  const con = del.filter((f) => f.mejor !== null);
  const sin = del.filter((f) => f.mejor === null && !f.evaluadoSinNota);
  const declinaron = del.filter((f) => f.evaluadoSinNota);
  const totalIntentos = del.reduce((s, f) => s + f.intentos, 0);
  const max = Math.max(1, ...con.map((f) => f.mejor!));
  const promedioSalon = promedio(con.map((f) => f.mejor!));
  const enRanking = ranking.filter((r) => r.promedio !== null);
  const puesto = enRanking.findIndex((r) => r.salon.id === salon.id);
  const resultadoFormula = ranking.find((r) => r.salon.id === salon.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {salones.map((s) => (
          <button
            key={s.id}
            onClick={() => setSalonId(s.id)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              s.id === salon.id ? "border-lago-600 bg-lago-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-lago-300"
            }`}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Indicador
          titulo={formula ? `Promedio (${formula.nombre})` : "Promedio del salón"}
          valor={resultadoFormula?.promedio === null || !resultadoFormula ? "—" : resultadoFormula.promedio.toFixed(1)}
          unidad="ppm"
          nota={puesto >= 0 ? `puesto ${puesto + 1} de ${enRanking.length} salones` : undefined}
        />
        <Indicador titulo="Promedio simple" valor={promedioSalon === null ? "—" : promedioSalon.toFixed(1)} unidad="ppm" nota={nombreFuente.toLowerCase()} />
        <Indicador titulo="Mejor del salón" valor={con.length ? String(Math.round(con[0].mejor! * 10) / 10) : "—"} unidad="ppm" nota={con[0]?.alumno.nombre} />
        <Indicador
          titulo="Alumnos evaluados"
          valor={`${con.length + declinaron.length}`}
          nota={`de ${del.length} · ${con.length} con nota${declinaron.length ? ` · ${declinaron.length} sin nota` : ""} · ${totalIntentos} intentos`}
        />
      </div>

      <section className="tarjeta p-6">
        <h2 className="text-lg font-bold text-slate-900">{salon.nombre}</h2>
        <p className="text-sm text-slate-500 mb-5">Mejor resultado de cada alumno · {nombreFuente}</p>
        {con.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-8 text-center">Este salón todavía no tiene resultados con este filtro.</p>
        ) : (
          <ol className="space-y-1.5">
            {con.map((f, i) => (
              <li key={f.alumno.id} className="flex items-center gap-3 text-sm">
                <Medalla puesto={i + 1} />
                <span className="w-52 shrink-0 truncate text-slate-800">
                  <NombreAlumno f={f} esAdmin={esAdmin} />
                </span>
                <span className="flex-1 h-4 rounded bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-r transition-[width] duration-500" style={{ width: `${(f.mejor! / max) * 100}%`, background: AZUL }} />
                </span>
                <span className="w-12 shrink-0 text-right font-bold tabular-nums text-slate-900">{Math.round(f.mejor! * 10) / 10}</span>
              </li>
            ))}
          </ol>
        )}
        {declinaron.length > 0 && (
          <p className="text-xs text-slate-500 mt-4" title="Se les intentó evaluar pero decidieron no dar su evaluación (x, W, Justify en el Excel)">
            Evaluados sin nota ({declinaron.length}): {declinaron.map((f) => f.alumno.nombre).join(" · ")}
          </p>
        )}
        {sin.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            Sin evaluar ({sin.length}): {sin.map((f) => f.alumno.nombre).join(" · ")}
          </p>
        )}
      </section>
    </div>
  );
}

// ═══════════════════════ Pestaña 3: Todos los salones ═══════════════════════

function PestanaTodos({ esAdmin, filas, salones, nombreFuente }: { esAdmin: boolean; filas: FilaAlumno[]; salones: SalonDash[]; nombreFuente: string }) {
  const [salonFiltro, setSalonFiltro] = useState("todos");
  const [buscar, setBuscar] = useState("");
  const [top, setTop] = useState(20);
  const [orden, setOrden] = useState<{ col: Orden; desc: boolean }>({ col: "mejor", desc: true });
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  const conResultado = filas.filter((f) => f.mejor !== null).sort((a, b) => b.mejor! - a.mejor!);
  const posicion = new Map(conResultado.map((f, i) => [f.alumno.id, i + 1]));
  const destacados = top ? conResultado.slice(0, top) : conResultado;
  const max = Math.max(1, ...destacados.map((f) => f.mejor!));

  const tabla = filas
    .filter((f) => salonFiltro === "todos" || f.alumno.salon === salonFiltro)
    .filter((f) => f.alumno.nombre.toLowerCase().includes(buscar.toLowerCase()))
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
  const ordenarPor = (col: Orden) => setOrden((o) => ({ col, desc: o.col === col ? !o.desc : col !== "nombre" && col !== "salon" }));

  return (
    <div className="space-y-6">
      <section className="tarjeta p-6">
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <div className="mr-auto">
            <h2 className="text-lg font-bold text-slate-900">Los mejores del colegio</h2>
            <p className="text-sm text-slate-500">Todos los salones juntos · {nombreFuente}</p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm">
            {[10, 20, 50, 0].map((n) => (
              <button
                key={n}
                onClick={() => setTop(n)}
                className={`rounded-lg px-3 py-1 transition ${top === n ? "bg-white shadow-sm font-semibold text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
              >
                {n ? `Top ${n}` : "Todos"}
              </button>
            ))}
          </div>
        </div>
        {destacados.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-8 text-center">Todavía no hay resultados con este filtro.</p>
        ) : (
          <ol className="space-y-1.5">
            {destacados.map((f, i) => (
              <li key={f.alumno.id} className="flex items-center gap-3 text-sm">
                <Medalla puesto={i + 1} />
                <span className="w-48 shrink-0 truncate text-slate-800">
                  <NombreAlumno f={f} esAdmin={esAdmin} />
                </span>
                <span className="hidden sm:inline-flex w-36 shrink-0">
                  <span className="chip">{f.alumno.salon}</span>
                </span>
                <span className="flex-1 h-4 rounded bg-slate-100 overflow-hidden">
                  <span className="block h-full rounded-r transition-[width] duration-500" style={{ width: `${(f.mejor! / max) * 100}%`, background: AZUL }} />
                </span>
                <span className="w-12 shrink-0 text-right font-bold tabular-nums text-slate-900">{Math.round(f.mejor! * 10) / 10}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="tarjeta p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="mr-auto">
            <h2 className="text-lg font-bold text-slate-900">Tabla completa</h2>
            <p className="text-sm text-slate-500">
              {tabla.length} alumnos{esAdmin && " · haz clic en un nombre para ver su ficha"}
            </p>
          </div>
          <select className="campo w-auto" value={salonFiltro} onChange={(e) => setSalonFiltro(e.target.value)}>
            <option value="todos">Todos los salones</option>
            {salones.map((s) => (
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
                  <td className="py-2 pr-3 font-medium text-slate-800">
                    <NombreAlumno f={f} esAdmin={esAdmin} />
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

// ═══════════════════════ Piezas ═══════════════════════

function NombreAlumno({ f, esAdmin }: { f: FilaAlumno; esAdmin: boolean }) {
  if (!esAdmin) return <>{f.alumno.nombre}</>;
  return (
    <Link href={`/admin/alumnos/${f.alumno.id}`} className="hover:text-lago-700 hover:underline">
      {f.alumno.nombre}
    </Link>
  );
}

function Medalla({ puesto }: { puesto: number | null }) {
  const estilo =
    puesto === 1 ? "bg-amber-100 text-amber-700" : puesto === 2 ? "bg-slate-200 text-slate-700" : puesto === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500";
  return <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums ${estilo}`}>{puesto ?? "–"}</span>;
}

function Indicador({ titulo, valor, unidad, nota, chico }: { titulo: string; valor: string; unidad?: string; nota?: string; chico?: boolean }) {
  return (
    <div className="tarjeta p-5">
      <div className="text-sm text-slate-500 truncate">{titulo}</div>
      <div className={`mt-1 font-extrabold text-slate-900 truncate ${chico ? "text-2xl" : "text-3xl"}`}>
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
