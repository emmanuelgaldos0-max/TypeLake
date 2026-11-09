"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { importarNotasMedicion, prepararMedicionHistorica, type ResultadoImportacion } from "@/app/admin/acciones";
import { leerLibroMediciones, type HojaMedicion } from "@/lib/leerMedicionExcel";

const TANDA = 20;

interface ConfigHoja {
  incluir: boolean;
  grado: string;
  seccion: string;
}

interface ResultadoSalon extends ResultadoImportacion {
  grado: string;
  seccion: string;
}

const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function ImportarMedicion() {
  const [hojas, setHojas] = useState<HojaMedicion[]>([]);
  const [config, setConfig] = useState<Record<string, ConfigHoja>>({});
  const [grupo, setGrupo] = useState("");
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [progreso, setProgreso] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoSalon[]>([]);
  const [fallo, setFallo] = useState("");

  // Mediciones encontradas en cualquier hoja
  const grupos = useMemo(() => {
    const m = new Map<string, string>();
    hojas.forEach((h) => h.grupos.forEach((g) => m.set(g.clave, g.nombre)));
    return Array.from(m, ([clave, nombre]) => ({ clave, nombre }));
  }, [hojas]);

  const notasDe = (h: HojaMedicion) => {
    const g = h.grupos.find((x) => x.clave === grupo);
    return h.alumnos.map((a) => ({
      nombres: a.nombres,
      apellidos: a.apellidos,
      notas: g ? g.columnas.map((c) => a.valores[c]).filter((v): v is number => v !== null) : [],
    }));
  };

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    setResultados([]);
    setFallo("");
    if (!archivo) return;
    const leidas = leerLibroMediciones(XLSX.read(await archivo.arrayBuffer()));
    if (!leidas.length) {
      setFallo('No encontré hojas con una columna "Nombres" y columnas "WPM".');
      setHojas([]);
      return;
    }
    setHojas(leidas);
    setConfig(Object.fromEntries(leidas.map((h) => [h.hoja, { incluir: true, grado: h.gradoSugerido, seccion: "A" }])));
    // Por defecto, la última medición que tenga alguna nota
    const conDatos = leidas.flatMap((h) => h.grupos.filter((g) => h.alumnos.some((a) => g.columnas.some((c) => a.valores[c] !== null))));
    const elegido = conDatos.at(-1) ?? leidas[0].grupos[0];
    setGrupo(elegido.clave);
    setNombre(elegido.nombre);
  };

  const cambiarConfig = (hoja: string, cambio: Partial<ConfigHoja>) => setConfig((c) => ({ ...c, [hoja]: { ...c[hoja], ...cambio } }));

  const importar = async () => {
    setFallo("");
    setResultados([]);
    const todos: ResultadoSalon[] = [];
    try {
      setProgreso("Preparando medición…");
      const medicionId = await prepararMedicionHistorica(nombre, fecha);
      for (const h of hojas) {
        const cfg = config[h.hoja];
        if (!cfg?.incluir) continue;
        const filas = notasDe(h);
        for (let i = 0; i < filas.length; i += TANDA) {
          setProgreso(`${cfg.grado} ${cfg.seccion}: ${Math.min(i + TANDA, filas.length)} de ${filas.length} alumnos…`);
          const r = await importarNotasMedicion(medicionId, fecha, cfg.grado, cfg.seccion, filas.slice(i, i + TANDA));
          todos.push(...r.map((x) => ({ ...x, grado: cfg.grado, seccion: cfg.seccion })));
          setResultados([...todos]);
        }
      }
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setProgreso(null);
    }
  };

  const descargarCredenciales = () => {
    const filas = resultados
      .filter((r) => r.cuentaNueva)
      .map((r) => ({ Grado: r.grado, Sección: r.seccion, Apellidos: r.apellidos, Nombres: r.nombres, Usuario: r.cuentaNueva!.usuario, Contraseña: r.cuentaNueva!.clave }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 26 }, { wch: 24 }, { wch: 16 }, { wch: 14 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Credenciales");
    XLSX.writeFile(libro, `credenciales_${fecha}.xlsx`);
  };

  const incluidas = hojas.filter((h) => config[h.hoja]?.incluir);
  const totalNotas = incluidas.reduce((s, h) => s + notasDe(h).filter((a) => a.notas.length).length, 0);
  const cuentasNuevas = resultados.filter((r) => r.cuentaNueva).length;
  const importados = resultados.filter((r) => r.estado === "importado").length;
  const sinNotas = resultados.filter((r) => r.estado === "sin_notas").length;
  const errores = resultados.filter((r) => r.estado === "error");

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Importar resultados de una medición</h2>
      <p className="text-sm text-slate-500 mb-4">
        Sube el Excel con una hoja por salón (columna <b>Nombres</b> como &quot;APELLIDOS, NOMBRES&quot; y columnas <b>WPM 1</b>, <b>WPM 2</b>…).
        Las celdas con x, W, Justify o vacías no cuentan. Los alumnos sin cuenta se crean automáticamente. Si importas otra vez la misma medición,
        sus notas se reemplazan.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={alElegir}
        disabled={progreso !== null}
        className="block text-sm file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
      />

      {hojas.length > 0 && (
        <div className="mt-6 space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">Medición del Excel</span>
              <select
                value={grupo}
                onChange={(e) => {
                  setGrupo(e.target.value);
                  setNombre(grupos.find((g) => g.clave === e.target.value)?.nombre ?? "");
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              >
                {grupos.map((g) => (
                  <option key={g.clave} value={g.clave}>{g.nombre}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">Nombre en TypeLake</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">Fecha en que se tomó</span>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200" />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3 font-medium">Hoja</th>
                  <th className="py-2 pr-3 font-medium">Grado</th>
                  <th className="py-2 pr-3 font-medium">Sección</th>
                  <th className="py-2 pr-3 font-medium text-right">Alumnos</th>
                  <th className="py-2 pr-3 font-medium text-right">Con nota</th>
                  <th className="py-2 font-medium text-right">Sin nota</th>
                </tr>
              </thead>
              <tbody>
                {hojas.map((h) => {
                  const cfg = config[h.hoja];
                  const notas = notasDe(h);
                  const con = notas.filter((a) => a.notas.length).length;
                  return (
                    <tr key={h.hoja} className={`border-b border-slate-50 ${cfg?.incluir ? "" : "opacity-40"}`}>
                      <td className="py-2 pr-3">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={cfg?.incluir ?? false} onChange={(e) => cambiarConfig(h.hoja, { incluir: e.target.checked })} />
                          {h.hoja}
                        </label>
                      </td>
                      <td className="py-2 pr-3">
                        <input value={cfg?.grado ?? ""} onChange={(e) => cambiarConfig(h.hoja, { grado: e.target.value })} className="w-44 px-2 py-1 rounded border border-slate-200" />
                      </td>
                      <td className="py-2 pr-3">
                        <input value={cfg?.seccion ?? ""} onChange={(e) => cambiarConfig(h.hoja, { seccion: e.target.value })} className="w-16 px-2 py-1 rounded border border-slate-200" />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{h.alumnos.length}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{con}</td>
                      <td className="py-2 text-right tabular-nums text-slate-500">{h.alumnos.length - con}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={importar}
            disabled={progreso !== null || !incluidas.length || !nombre.trim()}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-semibold rounded-lg"
          >
            {progreso ?? `Importar "${nombre}" (${totalNotas} alumnos con nota)`}
          </button>
        </div>
      )}

      {fallo && <p className="mt-4 text-sm text-rose-600">{fallo}</p>}

      {resultados.length > 0 && progreso === null && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-slate-700 mb-3">
            <b className="text-emerald-600">{importados}</b> alumnos con notas importadas
            {sinNotas > 0 && <>, <b>{sinNotas}</b> sin nota</>}
            {cuentasNuevas > 0 && <>, <b>{cuentasNuevas}</b> cuentas nuevas</>}
            {errores.length > 0 && <>, <b className="text-rose-600">{errores.length}</b> con error</>}.
          </p>
          {cuentasNuevas > 0 && (
            <>
              <button onClick={descargarCredenciales} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg">
                Descargar usuarios y contraseñas nuevos (Excel)
              </button>
              <p className="text-xs text-amber-700 mt-2">Descárgalo ahora: por seguridad las contraseñas no se vuelven a mostrar.</p>
            </>
          )}
          {errores.length > 0 && (
            <ul className="mt-4 text-sm text-rose-600 list-disc pl-5">
              {errores.map((r, i) => (
                <li key={i}>
                  {r.apellidos}, {r.nombres}: {r.detalle}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
