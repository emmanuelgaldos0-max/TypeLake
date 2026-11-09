"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { cambiarActivo, generarClaves, listarCredenciales, restablecerClave, type FilaCredencial } from "@/app/admin/acciones";
import Spinner from "@/components/ui/Spinner";
import { mensajeError } from "@/lib/errores";

export interface FilaTabla {
  id: string;
  usuario: string;
  nombres: string;
  apellidos: string;
  activo: boolean;
  salon: string;
  salonId: number | null;
  orden: number;
  /** El alumno eligió su propia contraseña (no se guarda ni se muestra). */
  clavePropia: boolean;
}

const TANDA = 20;

/** Un Excel con una hoja por salón: Apellidos, Nombres, Usuario, Contraseña. */
function descargarExcel(filas: FilaCredencial[], nombreArchivo: string) {
  const libro = XLSX.utils.book_new();
  const porSalon = new Map<string, FilaCredencial[]>();
  for (const f of filas) {
    const k = `${f.grado} ${f.seccion}`.trim();
    porSalon.set(k, [...(porSalon.get(k) ?? []), f]);
  }
  for (const [salon, lista] of porSalon) {
    const hoja = XLSX.utils.json_to_sheet(
      lista.map((f, i) => ({
        "N°": i + 1,
        Apellidos: f.apellidos,
        Nombres: f.nombres,
        Usuario: f.usuario,
        Contraseña: f.clave ?? (f.cambiadaPorAlumno ? "Contraseña propia" : "(no guardada)"),
      })),
    );
    hoja["!cols"] = [{ wch: 4 }, { wch: 26 }, { wch: 24 }, { wch: 16 }, { wch: 16 }];
    // Nombre de hoja: máx. 31 caracteres y sin caracteres especiales
    const nombreHoja = salon.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Alumnos";
    XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  }
  XLSX.writeFile(libro, nombreArchivo);
}

export default function TablaAlumnos({ filas }: { filas: FilaTabla[] }) {
  const salones = useMemo(() => {
    const m = new Map<string, number | null>();
    filas.forEach((f) => m.set(f.salon, f.salonId));
    return Array.from(m, ([nombre, id]) => ({ nombre, id }));
  }, [filas]);
  const [salon, setSalon] = useState("todos");
  const [buscar, setBuscar] = useState("");
  const [claves, setClaves] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null); // id de la fila o "descarga"
  const [progreso, setProgreso] = useState("");
  const [pendiente, iniciar] = useTransition();

  const visibles = filas.filter(
    (f) =>
      (salon === "todos" || f.salon === salon) &&
      `${f.nombres} ${f.apellidos} ${f.usuario}`.toLowerCase().includes(buscar.toLowerCase()),
  );

  const nuevaClave = (f: FilaTabla) => {
    const aviso = f.clavePropia && !claves[f.id] ? "\n\nEste alumno eligió su propia contraseña: dejará de funcionar y tendrás que darle la nueva." : "";
    if (
      !confirm(
        `¿Generar una contraseña nueva para ${f.nombres} ${f.apellidos}?\n\nLa anterior dejará de funcionar y se cerrará su sesión en todos los dispositivos.${aviso}`,
      )
    )
      return;
    setOcupado(f.id);
    iniciar(async () => {
      const clave = await restablecerClave(f.id);
      setClaves((c) => ({ ...c, [f.id]: clave }));
      setOcupado(null);
    });
  };

  const alternar = (f: FilaTabla) => {
    const accion = f.activo ? "desactivar" : "activar";
    if (!confirm(`¿Seguro que quieres ${accion} a ${f.nombres} ${f.apellidos}?`)) return;
    setOcupado(f.id);
    iniciar(async () => {
      await cambiarActivo(f.id, !f.activo);
      setOcupado(null);
    });
  };

  const descargar = async () => {
    const salonElegido = salones.find((s) => s.nombre === salon);
    setOcupado("descarga");
    setProgreso("Preparando…");
    window.dispatchEvent(new Event("typelake:cargando"));
    try {
      let lista = await listarCredenciales(salon === "todos" ? null : (salonElegido?.id ?? null));
      // Quien cambió su contraseña no se regenera: el alumno la conoce
      const sinClave = lista.filter((f) => !f.clave && !f.cambiadaPorAlumno);

      if (sinClave.length > 0) {
        const ok = confirm(
          `${sinClave.length} alumno(s) no tienen su contraseña guardada (sus cuentas se crearon antes de esta función).\n\n` +
            `¿Generar contraseñas NUEVAS para ellos? Sus contraseñas actuales dejarán de funcionar.\n\n` +
            `Aceptar = generar nuevas e incluirlas · Cancelar = descargar sin esas contraseñas`,
        );
        if (ok) {
          const nuevas: Record<string, string> = {};
          for (let i = 0; i < sinClave.length; i += TANDA) {
            setProgreso(`Generando contraseñas ${Math.min(i + TANDA, sinClave.length)}/${sinClave.length}…`);
            Object.assign(nuevas, await generarClaves(sinClave.slice(i, i + TANDA).map((f) => f.id)));
          }
          lista = lista.map((f) => (f.clave ? f : { ...f, clave: nuevas[f.id] ?? null }));
        }
      }

      const sufijo = salon === "todos" ? "todos" : salon.replace(/[^a-zA-Z0-9]+/g, "_");
      descargarExcel(lista, `credenciales_${sufijo}.xlsx`);
    } catch (e) {
      alert(`No se pudieron descargar las credenciales: ${mensajeError(e)}`);
    } finally {
      setOcupado(null);
      setProgreso("");
      window.dispatchEvent(new Event("typelake:listo"));
    }
  };

  return (
    <section className="tarjeta p-6 animate-aparecer">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="mr-auto">
          <h2 className="text-lg font-bold text-slate-900">Cuentas</h2>
          <p className="text-sm text-slate-500">
            {visibles.length} de {filas.length} alumnos
          </p>
        </div>
        <select value={salon} onChange={(e) => setSalon(e.target.value)} className="campo w-auto">
          <option value="todos">Todos los salones</option>
          {salones.map((s) => (
            <option key={s.nombre}>{s.nombre}</option>
          ))}
        </select>
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar alumno…" className="campo w-48" />
        <button onClick={descargar} disabled={!!ocupado || filas.length === 0} className="btn btn-exito">
          {ocupado === "descarga" ? (
            <>
              <Spinner /> {progreso}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Descargar credenciales{salon === "todos" ? "" : ` de ${salon}`}
            </>
          )}
        </button>
      </div>

      {filas.length === 0 ? (
        <p className="text-slate-500 text-sm bg-slate-50 rounded-xl px-4 py-8 text-center">Todavía no hay alumnos. Importa un Excel para empezar.</p>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-y border-slate-100 bg-slate-50/60">
                <th className="py-2.5 pl-6 pr-3 font-semibold">Salón</th>
                <th className="py-2.5 pr-3 font-semibold">Apellidos y nombres</th>
                <th className="py-2.5 pr-3 font-semibold">Usuario</th>
                <th className="py-2.5 pr-3 font-semibold">Contraseña</th>
                <th className="py-2.5 pr-3 font-semibold">Estado</th>
                <th className="py-2.5 pr-6 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className={`border-b border-slate-50 transition hover:bg-lago-50/40 ${f.activo ? "" : "opacity-50"}`}>
                  <td className="py-2.5 pl-6 pr-3 whitespace-nowrap">
                    <span className="chip">{f.salon}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-800">
                    <Link href={`/admin/alumnos/${f.id}`} className="hover:text-lago-700 hover:underline">
                      <span className="font-medium">{f.apellidos}</span>, {f.nombres}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-slate-600">{f.usuario}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {f.clavePropia && !claves[f.id] ? (
                      <span className="chip bg-violet-50 text-violet-700" title="El alumno la cambió. No se guarda ni se muestra; si la olvidó, genera una nueva.">
                        Contraseña propia
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Del sistema</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`chip ${f.activo ? "bg-emerald-50 text-emerald-700" : ""}`}>{f.activo ? "Activo" : "Desactivado"}</span>
                  </td>
                  <td className="py-2.5 pr-6 text-right whitespace-nowrap">
                    {ocupado === f.id && pendiente ? (
                      <Spinner className="h-4 w-4 inline text-lago-600" />
                    ) : (
                      <>
                        {claves[f.id] ? (
                          <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg mr-2">{claves[f.id]}</span>
                        ) : (
                          <button disabled={!!ocupado} onClick={() => nuevaClave(f)} className="btn-enlace">
                            Nueva contraseña
                          </button>
                        )}
                        <button disabled={!!ocupado} onClick={() => alternar(f)} className="btn-enlace text-slate-500">
                          {f.activo ? "Desactivar" : "Activar"}
                        </button>
                      </>
                    )}
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
