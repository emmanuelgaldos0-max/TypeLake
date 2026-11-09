"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NIVELES, type Nivel } from "@/data/textos";
import { generarTexto } from "@/lib/generarTexto";
import { calcularPpm, contarCorrectos, variacionRitmo, type Resultado } from "@/lib/metricas";

type Estado = "listo" | "escribiendo" | "terminado";

const DURACION_SEG = 60;
const ALTO_LINEA_REM = 2.6;

interface Props {
  duracionSeg?: number;
  onTerminar?: (r: Resultado, nivel: Nivel) => void;
}

export default function PruebaMecanografia({ duracionSeg = DURACION_SEG, onTerminar }: Props) {
  const [nivel, setNivel] = useState<Nivel>(1);
  const [objetivo, setObjetivo] = useState("");
  const [escrito, setEscrito] = useState("");
  const [estado, setEstado] = useState<Estado>("listo");
  const [restante, setRestante] = useState(duracionSeg);
  const [enfocado, setEnfocado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  const textoRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  // Refs para leer valores actuales dentro de temporizadores y eventos.
  const escritoRef = useRef("");
  const objetivoRef = useRef("");
  const estadoRef = useRef<Estado>("listo");
  const inicioRef = useRef(0);
  const stats = useRef({
    pulsaciones: 0,
    errores: 0,
    erroresPorTecla: {} as Record<string, number>,
    tiempos: [] as number[],
    salidasPestana: 0,
    insercionesMasivas: 0,
    pegadosBloqueados: 0,
  });

  const cambiarEstado = (e: Estado) => {
    estadoRef.current = e;
    setEstado(e);
  };

  const reiniciar = useCallback(
    (nuevoNivel: Nivel = nivel) => {
      const texto = generarTexto(nuevoNivel);
      objetivoRef.current = texto;
      escritoRef.current = "";
      stats.current = {
        pulsaciones: 0,
        errores: 0,
        erroresPorTecla: {},
        tiempos: [],
        salidasPestana: 0,
        insercionesMasivas: 0,
        pegadosBloqueados: 0,
      };
      setObjetivo(texto);
      setEscrito("");
      setRestante(duracionSeg);
      setResultado(null);
      cambiarEstado("listo");
      if (areaRef.current) areaRef.current.value = "";
      requestAnimationFrame(() => areaRef.current?.focus());
    },
    [nivel, duracionSeg],
  );

  // El texto se genera en el navegador para que siempre sea distinto.
  useEffect(() => {
    reiniciar(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const terminar = useCallback(() => {
    if (estadoRef.current !== "escribiendo") return;
    cambiarEstado("terminado");
    const s = stats.current;
    const final = escritoRef.current;
    const { correctos, incorrectos } = contarCorrectos(final, objetivoRef.current);
    const r: Resultado = {
      ppm: calcularPpm(correctos, duracionSeg),
      ppmBruta: calcularPpm(final.length, duracionSeg),
      precision: s.pulsaciones ? Math.round(((s.pulsaciones - s.errores) / s.pulsaciones) * 1000) / 10 : 0,
      correctos,
      incorrectos,
      pulsaciones: s.pulsaciones,
      errores: s.errores,
      erroresPorTecla: { ...s.erroresPorTecla },
      duracionSeg,
      senales: {
        variacionRitmo: variacionRitmo(s.tiempos),
        salidasPestana: s.salidasPestana,
        insercionesMasivas: s.insercionesMasivas,
        pegadosBloqueados: s.pegadosBloqueados,
      },
    };
    setResultado(r);
    onTerminar?.(r, nivel);
  }, [duracionSeg, nivel, onTerminar]);

  // Temporizador
  useEffect(() => {
    if (estado !== "escribiendo") return;
    const id = setInterval(() => {
      const transcurrido = (performance.now() - inicioRef.current) / 1000;
      const quedan = Math.max(0, duracionSeg - transcurrido);
      setRestante(quedan);
      if (quedan <= 0) terminar();
    }, 100);
    return () => clearInterval(id);
  }, [estado, duracionSeg, terminar]);

  // Detecta si el alumno sale de la pestaña durante la prueba.
  useEffect(() => {
    const alSalir = () => {
      if (estadoRef.current === "escribiendo" && document.visibilityState === "hidden") stats.current.salidasPestana++;
    };
    document.addEventListener("visibilitychange", alSalir);
    return () => document.removeEventListener("visibilitychange", alSalir);
  }, []);

  const procesar = (valor: string, tipo?: string) => {
    const area = areaRef.current;
    if (!area) return;
    const previo = escritoRef.current;

    if (estadoRef.current === "terminado" || tipo === "insertFromPaste" || tipo === "insertFromDrop") {
      if (tipo === "insertFromPaste" || tipo === "insertFromDrop") stats.current.pegadosBloqueados++;
      area.value = previo;
      return;
    }

    const obj = objetivoRef.current;
    let nuevo = valor.replace(/[\r\n\t]/g, "").slice(0, obj.length);

    if (nuevo.length > previo.length) {
      if (estadoRef.current === "listo") {
        inicioRef.current = performance.now();
        cambiarEstado("escribiendo");
      }
      // Si el texto no continúa lo anterior (cursor movido, etc.), lo ignoramos.
      if (!nuevo.startsWith(previo)) nuevo = previo;
      const agregados = nuevo.length - previo.length;
      if (agregados > 2) stats.current.insercionesMasivas++;
      const ahora = performance.now();
      for (let i = previo.length; i < nuevo.length; i++) {
        stats.current.pulsaciones++;
        stats.current.tiempos.push(ahora);
        if (nuevo[i] !== obj[i]) {
          stats.current.errores++;
          const tecla = obj[i];
          stats.current.erroresPorTecla[tecla] = (stats.current.erroresPorTecla[tecla] ?? 0) + 1;
        }
      }
    }

    // Si se acerca al final, agregamos más texto.
    if (obj.length - nuevo.length < 250) {
      const extra = generarTexto(nivel, 800);
      objetivoRef.current = obj + " " + extra;
      setObjetivo(objetivoRef.current);
    }

    area.value = nuevo;
    escritoRef.current = nuevo;
    setEscrito(nuevo);
  };

  const alEscribir = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const nativo = e.nativeEvent as InputEvent;
    if (nativo.isComposing) return; // las tildes con tecla muerta pueden llegar como composición
    procesar(e.currentTarget.value, nativo.inputType);
  };

  const alTecla = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const bloqueadas = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Enter", "Tab"];
    if (bloqueadas.includes(e.key)) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && ["a", "z", "y", "v"].includes(e.key.toLowerCase())) e.preventDefault();
    if (e.key === "Escape") {
      e.preventDefault();
      reiniciar();
    }
  };

  // Mantener el cursor siempre al final.
  const alSeleccionar = () => {
    const a = areaRef.current;
    if (a && (a.selectionStart !== a.value.length || a.selectionEnd !== a.value.length)) {
      a.selectionStart = a.selectionEnd = a.value.length;
    }
  };

  // Desplaza el texto para que la línea actual quede siempre a la vista.
  useLayoutEffect(() => {
    const cursor = cursorRef.current;
    const texto = textoRef.current;
    if (!cursor || !texto) return;
    const altoLinea = cursor.offsetHeight || 40;
    const top = cursor.offsetTop;
    const desplazamiento = Math.max(0, top - altoLinea);
    texto.style.transform = `translateY(-${desplazamiento}px)`;
  }, [escrito, objetivo]);

  // Palabras (cada una con su espacio final) para que el texto no se corte a mitad de palabra.
  const palabras = useMemo(() => {
    const lista: { inicio: number; texto: string }[] = [];
    const regex = /\S+\s?|\s/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(objetivo))) lista.push({ inicio: m.index, texto: m[0] });
    return lista;
  }, [objetivo]);

  const transcurrido = duracionSeg - restante;
  const { correctos } = useMemo(() => contarCorrectos(escrito, objetivo), [escrito, objetivo]);
  const ppmVivo = estado === "escribiendo" && transcurrido > 2 ? calcularPpm(correctos, transcurrido) : 0;
  const precisionViva =
    stats.current.pulsaciones > 0
      ? Math.round(((stats.current.pulsaciones - stats.current.errores) / stats.current.pulsaciones) * 100)
      : 100;

  const elegirNivel = (n: Nivel) => {
    setNivel(n);
    reiniciar(n);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Selector de nivel */}
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {(Object.keys(NIVELES) as unknown as Nivel[]).map((k) => {
          const n = Number(k) as Nivel;
          const activo = n === nivel;
          return (
            <button
              key={n}
              onClick={() => elegirNivel(n)}
              disabled={estado === "escribiendo"}
              className={`px-4 py-2 rounded-xl border text-left transition disabled:opacity-50 ${
                activo ? "bg-sky-600 border-sky-600 text-white shadow" : "bg-white border-slate-200 text-slate-700 hover:border-sky-400"
              }`}
            >
              <div className="font-semibold text-sm">{NIVELES[n].nombre}</div>
              <div className={`text-xs ${activo ? "text-sky-100" : "text-slate-500"}`}>{NIVELES[n].descripcion}</div>
            </button>
          );
        })}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Indicador etiqueta="Tiempo" valor={`${Math.ceil(restante)} s`} destacado={estado === "escribiendo" && restante <= 10} />
        <Indicador etiqueta="Palabras por minuto" valor={estado === "terminado" && resultado ? resultado.ppm : ppmVivo} />
        <Indicador etiqueta="Precisión" valor={`${estado === "terminado" && resultado ? resultado.precision : precisionViva}%`} />
      </div>

      {/* Barra de tiempo */}
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-sky-500 transition-[width] duration-100 ease-linear" style={{ width: `${(restante / duracionSeg) * 100}%` }} />
      </div>

      {estado !== "terminado" ? (
        <div
          ref={cajaRef}
          onClick={() => areaRef.current?.focus()}
          className={`relative bg-white rounded-2xl border-2 px-6 py-5 cursor-text transition ${
            enfocado ? "border-sky-400 shadow-lg shadow-sky-100" : "border-slate-200"
          }`}
        >
          <textarea
            ref={areaRef}
            onInput={alEscribir}
            onCompositionEnd={(e) => procesar(e.currentTarget.value)}
            onKeyDown={alTecla}
            onSelect={alSeleccionar}
            onPaste={(e) => {
              e.preventDefault();
              stats.current.pegadosBloqueados++;
            }}
            onDrop={(e) => e.preventDefault()}
            onFocus={() => setEnfocado(true)}
            onBlur={() => setEnfocado(false)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Escribe aquí el texto"
            className="absolute inset-0 w-full h-full opacity-0 resize-none cursor-text"
          />
          <div className="overflow-hidden select-none" style={{ height: `${ALTO_LINEA_REM * 3}rem` }}>
            <div
              ref={textoRef}
              className="text-[1.6rem] text-slate-400 transition-transform duration-150"
              style={{ lineHeight: `${ALTO_LINEA_REM}rem` }}
            >
              {palabras.map((p) => (
                <span key={p.inicio} className="inline-block whitespace-pre">
                  {Array.from(p.texto).map((ch, j) => {
                    const i = p.inicio + j;
                    const esCursor = i === escrito.length;
                    let clase = "";
                    if (i < escrito.length) {
                      clase = escrito[i] === ch ? "text-slate-800" : "bg-rose-200 text-rose-700 rounded-sm";
                    }
                    if (esCursor) clase += enfocado ? " cursor-letra" : " border-b-2 border-slate-300";
                    return (
                      <span key={i} ref={esCursor ? cursorRef : undefined} className={clase}>
                        {ch}
                      </span>
                    );
                  })}
                </span>
              ))}
            </div>
          </div>
          {!enfocado && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-2xl backdrop-blur-[1px]">
              <span className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">Haz clic aquí para empezar</span>
            </div>
          )}
        </div>
      ) : (
        resultado && <PanelResultado r={resultado} onOtraVez={() => reiniciar()} />
      )}

      <p className="text-center text-sm text-slate-500 mt-4">
        {estado === "listo" && "El tiempo empieza cuando escribes la primera letra. "}
        {estado !== "terminado" && (
          <>
            Pulsa <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Esc</kbd> para cambiar de texto.
          </>
        )}
      </p>
    </div>
  );
}

function Indicador({ etiqueta, valor, destacado }: { etiqueta: string; valor: string | number; destacado?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 text-center border ${destacado ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
      <div className={`text-3xl font-bold tabular-nums ${destacado ? "text-rose-600" : "text-slate-800"}`}>{valor}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500 mt-1">{etiqueta}</div>
    </div>
  );
}

function nombreTecla(t: string) {
  if (t === " ") return "espacio";
  return t;
}

function PanelResultado({ r, onOtraVez }: { r: Resultado; onOtraVez: () => void }) {
  const peores = Object.entries(r.erroresPorTecla)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  let mensaje = "¡Buen comienzo! Sigue practicando todos los días.";
  if (r.ppm >= 25) mensaje = "¡Muy bien! Vas por buen camino.";
  if (r.ppm >= 40) mensaje = "¡Excelente velocidad!";
  if (r.ppm >= 60) mensaje = "¡Increíble! Escribes como un profesional.";
  if (r.precision < 90) mensaje += " Intenta ir un poco más despacio para cometer menos errores.";

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 text-center">
      <div className="text-sm uppercase tracking-wide text-slate-500">Tu resultado</div>
      <div className="text-7xl font-extrabold text-sky-600 my-2 tabular-nums">{r.ppm}</div>
      <div className="text-slate-600 mb-6">palabras por minuto</div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Dato etiqueta="Precisión" valor={`${r.precision}%`} />
        <Dato etiqueta="Caracteres correctos" valor={r.correctos} />
        <Dato etiqueta="Errores cometidos" valor={r.errores} />
        <Dato etiqueta="Velocidad bruta" valor={`${r.ppmBruta} ppm`} />
      </div>

      <p className="text-lg text-slate-700 mb-6">{mensaje}</p>

      {peores.length > 0 && (
        <div className="mb-6">
          <div className="text-sm text-slate-500 mb-2">Teclas en las que más te equivocaste</div>
          <div className="flex flex-wrap justify-center gap-2">
            {peores.map(([tecla, n]) => (
              <span key={tecla} className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-mono">
                {nombreTecla(tecla)} <span className="text-rose-400 text-sm">×{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onOtraVez}
        autoFocus
        className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow transition"
      >
        Intentar con otro texto
      </button>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <div className="text-2xl font-bold text-slate-800 tabular-nums">{valor}</div>
      <div className="text-xs text-slate-500">{etiqueta}</div>
    </div>
  );
}
