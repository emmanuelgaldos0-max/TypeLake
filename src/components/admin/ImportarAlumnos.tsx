"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { crearAlumnos, type FilaAlumno, type ResultadoAlumno } from "@/app/admin/acciones";
import Spinner from "@/components/ui/Spinner";

const TANDA = 20;

// Acepta encabezados con o sin tildes / mayúsculas.
const clave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function leerFilas(libro: XLSX.WorkBook): { filas: FilaAlumno[]; errores: string[] } {
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "" });
  const filas: FilaAlumno[] = [];
  const errores: string[] = [];
  crudas.forEach((cruda, i) => {
    const r: Record<string, string> = {};
    for (const [k, v] of Object.entries(cruda)) r[clave(k)] = String(v).trim();
    const fila = { grado: r["grado"] ?? "", seccion: r["seccion"] ?? "", nombres: r["nombres"] ?? r["nombre"] ?? "", apellidos: r["apellidos"] ?? r["apellido"] ?? "" };
    if (!fila.grado && !fila.seccion && !fila.nombres && !fila.apellidos) return; // fila vacía
    if (!fila.grado || !fila.seccion || !fila.nombres || !fila.apellidos) errores.push(`Fila ${i + 2}: faltan datos`);
    else filas.push(fila);
  });
  return { filas, errores };
}

function descargarPlantilla() {
  const hoja = XLSX.utils.aoa_to_sheet([
    ["Grado", "Sección", "Nombres", "Apellidos"],
    ["3° de secundaria", "A", "Juan Carlos", "Pérez García"],
    ["3° de secundaria", "A", "María", "Quispe Mamani"],
  ]);
  hoja["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 22 }, { wch: 24 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Alumnos");
  XLSX.writeFile(libro, "plantilla_alumnos.xlsx");
}

function descargarCredenciales(resultados: ResultadoAlumno[]) {
  const creados = resultados.filter((r) => r.estado === "creado");
  const filas = creados
    .sort((a, b) => `${a.grado}${a.seccion}${a.apellidos}`.localeCompare(`${b.grado}${b.seccion}${b.apellidos}`, "es"))
    .map((r) => ({ Grado: r.grado, Sección: r.seccion, Apellidos: r.apellidos, Nombres: r.nombres, Usuario: r.usuario, Contraseña: r.clave }));
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 14 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Credenciales");
  XLSX.writeFile(libro, `credenciales_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function ImportarAlumnos() {
  const [filas, setFilas] = useState<FilaAlumno[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [resultados, setResultados] = useState<ResultadoAlumno[]>([]);
  const [fallo, setFallo] = useState("");

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    setResultados([]);
    setFallo("");
    if (!archivo) return;
    const libro = XLSX.read(await archivo.arrayBuffer());
    const { filas, errores } = leerFilas(libro);
    setFilas(filas);
    setErrores(errores);
  };

  const crear = async () => {
    setFallo("");
    const todos: ResultadoAlumno[] = [];
    try {
      for (let i = 0; i < filas.length; i += TANDA) {
        setProgreso(i);
        todos.push(...(await crearAlumnos(filas.slice(i, i + TANDA))));
        setResultados([...todos]);
      }
      setFilas([]);
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
    } finally {
      setProgreso(null);
    }
  };

  const creados = resultados.filter((r) => r.estado === "creado").length;
  const repetidos = resultados.filter((r) => r.estado === "ya_existe").length;
  const conError = resultados.filter((r) => r.estado === "error");

  // Resumen por salón para la vista previa
  const porSalon = filas.reduce<Record<string, number>>((acc, f) => {
    const k = `${f.grado} ${f.seccion.toUpperCase()}`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="tarjeta p-6 animate-aparecer">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Importar alumnos desde Excel</h2>
        <button onClick={descargarPlantilla} className="btn btn-secundario px-3 py-1.5">
          Descargar plantilla
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Columnas: <b>Grado</b>, <b>Sección</b>, <b>Nombres</b>, <b>Apellidos</b>. Los grados y salones se crean solos. Los alumnos que ya
        tienen cuenta en el mismo salón se omiten.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={alElegir}
        disabled={progreso !== null}
        className="block text-sm file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-lago-50 file:text-lago-700 hover:file:bg-lago-100"
      />

      {errores.length > 0 && (
        <ul className="mt-4 text-sm text-rose-600 list-disc pl-5">
          {errores.slice(0, 10).map((e) => <li key={e}>{e}</li>)}
          {errores.length > 10 && <li>…y {errores.length - 10} más</li>}
        </ul>
      )}

      {filas.length > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(porSalon).map(([salon, n]) => (
              <span key={salon} className="text-sm px-3 py-1 rounded-full bg-slate-100 text-slate-700">{salon}: {n}</span>
            ))}
          </div>
          <button
            onClick={crear}
            disabled={progreso !== null}
            className="btn btn-primario"
          >
            {progreso !== null ? (
              <>
                <Spinner /> Creando cuentas… {progreso}/{filas.length}
              </>
            ) : (
              `Crear ${filas.length} cuentas`
            )}
          </button>
        </div>
      )}

      {fallo && <p className="mt-4 text-sm text-rose-600">{fallo}</p>}

      {resultados.length > 0 && progreso === null && (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-slate-700 mb-3">
            <b className="text-emerald-600">{creados}</b> cuentas creadas
            {repetidos > 0 && <>, <b>{repetidos}</b> ya existían</>}
            {conError.length > 0 && <>, <b className="text-rose-600">{conError.length}</b> con error</>}.
          </p>
          {creados > 0 && (
            <>
              <button onClick={() => descargarCredenciales(resultados)} className="btn btn-exito">
                Descargar usuarios y contraseñas (Excel)
              </button>
              <p className="text-xs text-amber-700 mt-2">
                Descárgalo ahora: por seguridad las contraseñas no se vuelven a mostrar (podrás generar una nueva si alguien la olvida).
              </p>
            </>
          )}
          {conError.length > 0 && (
            <ul className="mt-4 text-sm text-rose-600 list-disc pl-5">
              {conError.map((r, i) => <li key={i}>{r.nombres} {r.apellidos}: {r.detalle}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
