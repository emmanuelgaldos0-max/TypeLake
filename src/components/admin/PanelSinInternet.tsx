"use client";

import { useMemo, useState } from "react";
import { prepararMedicionHistorica } from "@/app/admin/acciones";
import { generarPaquete, importarIntentosSinInternet, type ResumenImportacion } from "@/app/admin/sin-internet/acciones";
import Spinner from "@/components/ui/Spinner";
import { mensajeError } from "@/lib/errores";
import { EXT_PAQUETE, EXT_RESULTADOS, type ArchivoResultados, type IntentoSinInternet } from "@/lib/sinInternet";

const TANDA = 100;
const PRACTICA = "practica";
const NUEVA = "nueva";

/** Fecha (YYYY-MM-DD) en hora de Lima. */
const diaLima = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const fechaLarga = (dia: string) =>
  new Date(`${dia}T12:00:00-05:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

interface Grupo {
  dia: string;
  intentos: IntentoSinInternet[];
  alumnos: number;
  equipos: Set<string>;
}

export default function PanelSinInternet({ mediciones }: { mediciones: { id: number; nombre: string }[] }) {
  return (
    <>
      <Pasos />
      <DescargarPaquete />
      <SubirResultados mediciones={mediciones} />
    </>
  );
}

function Pasos() {
  return (
    <section className="tarjeta p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-3">Cómo funciona</h2>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-600">
        <li>
          Instala <b>TypeLake</b> en cada PC con el instalador (<code>TypeLake-Instalador.exe</code>). Queda un ícono en el escritorio.
        </li>
        <li>
          Descarga aquí el <b>paquete</b> (alumnos, contraseñas y memes) y cárgalo en cada PC: botón <b>Profesor</b> abajo a la derecha → tu PIN →{" "}
          <b>Cargar paquete</b>. Hazlo de nuevo cuando agregues alumnos o memes.
        </li>
        <li>Los alumnos practican con su usuario y contraseña. Los resultados se guardan en la PC.</li>
        <li>
          Para traerlos: <b>Profesor</b> → <b>Guardar resultados en USB</b>. Luego súbelos abajo y elige si cuentan como práctica o como medición.
        </li>
      </ol>
    </section>
  );
}

function DescargarPaquete() {
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const descargar = async () => {
    setMensaje(null);
    if (!/^\d{4,8}$/.test(pin)) return setMensaje({ ok: false, texto: "El PIN debe tener de 4 a 8 números." });
    if (pin !== pin2) return setMensaje({ ok: false, texto: "Los dos PIN no coinciden." });
    setOcupado(true);
    try {
      const r = await generarPaquete(pin);
      if (r.error !== null) return setMensaje({ ok: false, texto: r.error });
      const fecha = new Date().toISOString().slice(0, 10);
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(new Blob([r.contenido], { type: "application/octet-stream" }));
      enlace.download = `TypeLake-paquete-${fecha}.${EXT_PAQUETE}`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
      setMensaje({ ok: true, texto: `Paquete descargado con ${r.alumnos} alumnos y ${r.memes} memes. Cópialo a tu USB.` });
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeError(e) });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="tarjeta p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">1. Descargar el paquete para las PCs</h2>
        <p className="text-sm text-slate-500 mt-1">
          Elige un PIN de profesor: lo pedirá la app para cargar paquetes y sacar los resultados. Las contraseñas de los alumnos van cifradas.
          Si un alumno cambia su contraseña en la página, en las PCs sigue valiendo la anterior hasta que cargues un paquete nuevo.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          PIN (4 a 8 números)
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.trim())} className="campo w-40 mt-1 block" />
        </label>
        <label className="text-sm text-slate-600">
          Repite el PIN
          <input type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value.trim())} className="campo w-40 mt-1 block" />
        </label>
        <button onClick={descargar} disabled={ocupado} className="btn btn-primario">
          {ocupado ? (
            <>
              <Spinner /> Preparando…
            </>
          ) : (
            "Descargar paquete"
          )}
        </button>
      </div>
      {mensaje && <p className={`text-sm ${mensaje.ok ? "text-emerald-700" : "text-rose-600"}`}>{mensaje.texto}</p>}
    </section>
  );
}

function SubirResultados({ mediciones }: { mediciones: { id: number; nombre: string }[] }) {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [destino, setDestino] = useState<Record<string, string>>({});
  const [nuevaNombre, setNuevaNombre] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [progreso, setProgreso] = useState("");
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  const ocupado = progreso !== "";

  const leer = async (archivos: FileList | null) => {
    setError("");
    setResumen(null);
    if (!archivos?.length) return;
    const vistos = new Set<string>();
    const porGrupo = new Map<string, Grupo>();
    const todosNombres: Record<string, string> = {};
    try {
      for (const archivo of Array.from(archivos)) {
        let datos: ArchivoResultados;
        try {
          datos = JSON.parse(await archivo.text());
        } catch {
          throw new Error(`${archivo.name} no es un archivo de resultados de TypeLake.`);
        }
        if (datos?.tipo !== "typelake-resultados" || !Array.isArray(datos.intentos)) throw new Error(`${archivo.name} no es un archivo de resultados de TypeLake.`);
        Object.assign(todosNombres, datos.nombres ?? {});
        for (const i of datos.intentos) {
          if (vistos.has(i.origen_id)) continue;
          vistos.add(i.origen_id);
          const dia = diaLima(i.creado_en);
          const g = porGrupo.get(dia) ?? { dia, intentos: [], alumnos: 0, equipos: new Set<string>() };
          g.intentos.push(i);
          g.equipos.add(datos.equipo);
          porGrupo.set(dia, g);
        }
      }
    } catch (e) {
      setGrupos([]);
      return setError(mensajeError(e));
    }
    const lista = [...porGrupo.values()].sort((a, b) => b.dia.localeCompare(a.dia));
    for (const g of lista) g.alumnos = new Set(g.intentos.map((i) => i.alumno_id)).size;
    setNombres(todosNombres);
    setGrupos(lista);
    setDestino(Object.fromEntries(lista.map((g) => [g.dia, PRACTICA])));
  };

  const total = useMemo(() => grupos.reduce((s, g) => s + g.intentos.length, 0), [grupos]);

  const subir = async () => {
    setError("");
    // Validar los destinos antes de subir nada
    for (const g of grupos) {
      const clave = g.dia;
      if (destino[clave] === NUEVA && !nuevaNombre[clave]?.trim()) return setError(`Escribe el nombre de la nueva medición del ${fechaLarga(g.dia)}.`);
    }
    const acumulado: ResumenImportacion = { validos: 0, sospechosos: 0, duplicados: 0, rechazados: 0, detalles: [] };
    try {
      let hechos = 0;
      for (const g of grupos) {
        const clave = g.dia;
        let medicionId: number | null = null;
        if (destino[clave] === NUEVA) {
          setProgreso("Creando la medición…");
          medicionId = await prepararMedicionHistorica(nuevaNombre[clave].trim(), g.dia);
        } else if (destino[clave] !== PRACTICA) medicionId = Number(destino[clave]);

        for (let i = 0; i < g.intentos.length; i += TANDA) {
          setProgreso(`Subiendo ${Math.min(hechos + i + TANDA, total)} de ${total}…`);
          const r = await importarIntentosSinInternet(g.intentos.slice(i, i + TANDA), medicionId);
          if (r.error !== null) throw new Error(r.error);
          acumulado.validos += r.resumen.validos;
          acumulado.sospechosos += r.resumen.sospechosos;
          acumulado.duplicados += r.resumen.duplicados;
          acumulado.rechazados += r.resumen.rechazados;
          acumulado.detalles.push(...r.resumen.detalles);
        }
        hechos += g.intentos.length;
      }
      setResumen(acumulado);
      setGrupos([]);
    } catch (e) {
      setError(mensajeError(e));
      if (acumulado.validos + acumulado.sospechosos + acumulado.duplicados) setResumen(acumulado);
    } finally {
      setProgreso("");
    }
  };

  return (
    <section className="tarjeta p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">2. Subir resultados de las PCs</h2>
        <p className="text-sm text-slate-500 mt-1">
          Elige uno o varios archivos <code>.{EXT_RESULTADOS}</code>. Subir dos veces el mismo archivo no duplica nada. Pasan por el mismo antitrampas que
          en línea.
        </p>
      </div>
      <input
        type="file"
        multiple
        accept={`.${EXT_RESULTADOS}`}
        disabled={ocupado}
        onChange={(e) => leer(e.target.files)}
        className="block text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-lago-50 file:px-4 file:py-2 file:font-semibold file:text-lago-700"
      />

      {grupos.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {total} intento(s). Elige para cada día si cuenta como <b>práctica</b> o como una <b>medición</b>:
          </p>
          {grupos.map((g) => {
            const clave = g.dia;
            const ejemplo = [...new Set(g.intentos.map((i) => nombres[i.alumno_id]).filter(Boolean))].slice(0, 4).join(", ");
            return (
              <div key={clave} className="rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
                <div className="mr-auto">
                  <div className="font-medium text-slate-900 first-letter:uppercase">{fechaLarga(g.dia)}</div>
                  <div className="text-xs text-slate-500">
                    {g.intentos.length} intento(s) de {g.alumnos} alumno(s) · {g.equipos.size} PC(s){ejemplo ? ` · ${ejemplo}${g.alumnos > 4 ? "…" : ""}` : ""}
                  </div>
                </div>
                <select value={destino[clave]} onChange={(e) => setDestino((d) => ({ ...d, [clave]: e.target.value }))} className="campo w-auto" disabled={ocupado}>
                  <option value={PRACTICA}>Práctica</option>
                  <optgroup label="Medición">
                    {mediciones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                    <option value={NUEVA}>Nueva medición…</option>
                  </optgroup>
                </select>
                {destino[clave] === NUEVA && (
                  <input
                    value={nuevaNombre[clave] ?? ""}
                    onChange={(e) => setNuevaNombre((n) => ({ ...n, [clave]: e.target.value }))}
                    placeholder="Nombre de la medición"
                    className="campo w-56"
                    disabled={ocupado}
                  />
                )}
              </div>
            );
          })}
          <button onClick={subir} disabled={ocupado} className="btn btn-primario">
            {ocupado ? (
              <>
                <Spinner /> {progreso}
              </>
            ) : (
              `Subir ${total} intento(s)`
            )}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {resumen && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 space-y-1">
          <p>
            ✓ <b>{resumen.validos}</b> válidos · <b>{resumen.sospechosos}</b> en revisión · <b>{resumen.duplicados}</b> ya estaban subidos
            {resumen.rechazados > 0 && (
              <>
                {" "}
                · <b className="text-rose-600">{resumen.rechazados} rechazados</b>
              </>
            )}
          </p>
          {resumen.sospechosos > 0 && <p className="text-amber-700">Los que quedaron en revisión los ves en Revisión.</p>}
          {resumen.detalles.slice(0, 5).map((d, i) => (
            <p key={i} className="text-rose-600">
              {d}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
