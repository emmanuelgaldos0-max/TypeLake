"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { generarTexto } from "@/lib/generarTexto";
import { calcularPpm, contarCorrectos, variacionRitmo, type Resultado } from "@/lib/metricas";

type Estado = "listo" | "escribiendo" | "terminado";

const DURACION_SEG = 60;
const ALTO_LINEA_REM = 2.6;
const CLAVE_SESION = "typelake_mejor_sesion";

export interface AvisoGuardado {
  tipo: "ok" | "aviso" | "error" | "cargando";
  texto: string;
}

interface Props {
  duracionSeg?: number;
  /** Si se pasa, el resultado se guarda al terminar y se muestra el aviso devuelto. */
  guardar?: (r: Resultado) => Promise<AvisoGuardado>;
  /** Récord registrado del alumno (null si aún no tiene). Si no se pasa, no se muestra. */
  obtenerRecord?: () => Promise<number | null>;
}

interface Comparacion {
  recordPrevio: number | null | undefined; // undefined = sin cuenta
  mejorSesionPrevio: number | null;
}

function leerMejorSesion(): number | null {
  try {
    const v = sessionStorage.getItem(CLAVE_SESION);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function guardarMejorSesion(v: number) {
  try {
    sessionStorage.setItem(CLAVE_SESION, String(v));
  } catch {
    // sin almacenamiento disponible: solo se pierde el dato de la sesión
  }
}

export default function PruebaMecanografia({ duracionSeg = DURACION_SEG, guardar, obtenerRecord }: Props) {
  const [aviso, setAviso] = useState<AvisoGuardado | null>(null);
  const [letraErrada, setLetraErrada] = useState(false);
  const [sacudir, setSacudir] = useState(0); // cambia en cada error para reiniciar la animación
  const [objetivo, setObjetivo] = useState("");
  const [escrito, setEscrito] = useState("");
  const [estado, setEstado] = useState<Estado>("listo");
  const [restante, setRestante] = useState(duracionSeg);
  const [enfocado, setEnfocado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [comparacion, setComparacion] = useState<Comparacion | null>(null);

  const recordRef = useRef<number | null | undefined>(undefined);
  const mejorSesionRef = useRef<number | null>(null);

  const areaRef = useRef<HTMLTextAreaElement>(null);
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

  const reiniciar = useCallback(() => {
    const texto = generarTexto();
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
    setComparacion(null);
    setAviso(null);
    setLetraErrada(false);
    cambiarEstado("listo");
    if (areaRef.current) areaRef.current.value = "";
    requestAnimationFrame(() => areaRef.current?.focus());
  }, [duracionSeg]);

  // El texto se genera en el navegador para que siempre sea distinto.
  useEffect(() => {
    reiniciar();
    mejorSesionRef.current = leerMejorSesion();
    obtenerRecord?.()
      .then((r) => (recordRef.current = r))
      .catch(() => {});
  }, [reiniciar, obtenerRecord]);

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

    // Comparar con las marcas ANTERIORES a este intento.
    setComparacion({
      recordPrevio: obtenerRecord ? recordRef.current : undefined,
      mejorSesionPrevio: mejorSesionRef.current,
    });
    if (mejorSesionRef.current === null || r.ppm > mejorSesionRef.current) {
      mejorSesionRef.current = r.ppm;
      guardarMejorSesion(r.ppm);
    }

    if (guardar) {
      setAviso({ tipo: "cargando", texto: "Guardando resultado..." });
      guardar(r)
        .then((a) => {
          setAviso(a);
          // Solo un intento válido puede convertirse en récord.
          if (a.tipo === "ok" && (recordRef.current == null || r.ppm > recordRef.current)) recordRef.current = r.ppm;
        })
        .catch(() => setAviso({ tipo: "error", texto: "No se pudo guardar el resultado." }));
    }
  }, [duracionSeg, guardar, obtenerRecord]);

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
      // Solo se aceptan letras correctas: con un error el cursor no avanza.
      let aceptado = previo;
      for (let i = previo.length; i < nuevo.length; i++) {
        stats.current.pulsaciones++;
        stats.current.tiempos.push(ahora);
        if (nuevo[i] === obj[aceptado.length]) {
          aceptado += nuevo[i];
          setLetraErrada(false);
        } else {
          stats.current.errores++;
          const tecla = obj[aceptado.length];
          stats.current.erroresPorTecla[tecla] = (stats.current.erroresPorTecla[tecla] ?? 0) + 1;
          setLetraErrada(true);
          setSacudir((n) => n + 1);
          break;
        }
      }
      nuevo = aceptado;
    }

    // Si se acerca al final, agregamos más texto.
    if (obj.length - nuevo.length < 250) {
      objetivoRef.current = obj + " " + generarTexto(800);
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
    const desplazamiento = Math.max(0, cursor.offsetTop - altoLinea);
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

  if (estado === "terminado" && resultado) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <PanelResultado r={resultado} comparacion={comparacion} aviso={aviso} onOtraVez={reiniciar} />
      </div>
    );
  }

  const urgente = estado === "escribiendo" && restante <= 10;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Solo el tiempo: la velocidad y la precisión se revelan al final */}
      <div className="flex justify-center mb-4">
        <div className={`rounded-xl px-8 py-3 text-center border ${urgente ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
          <div className={`text-4xl font-bold tabular-nums ${urgente ? "text-rose-600" : "text-slate-800"}`}>{Math.ceil(restante)} s</div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mt-1">Tiempo</div>
        </div>
      </div>

      {/* Barra de tiempo */}
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-sky-500 transition-[width] duration-100 ease-linear" style={{ width: `${(restante / duracionSeg) * 100}%` }} />
      </div>

      <div
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
          <div ref={textoRef} className="text-[1.6rem] text-slate-400 transition-transform duration-150" style={{ lineHeight: `${ALTO_LINEA_REM}rem` }}>
            {palabras.map((p) => (
              <span key={p.inicio} className="inline-block whitespace-pre">
                {Array.from(p.texto).map((ch, j) => {
                  const i = p.inicio + j;
                  const esCursor = i === escrito.length;
                  let clase = i < escrito.length ? "text-slate-800" : "";
                  if (esCursor) {
                    if (letraErrada) clase = "letra-errada";
                    else clase = enfocado ? "cursor-letra" : "border-b-2 border-slate-300";
                  }
                  return (
                    <span key={esCursor ? `c${i}-${sacudir}` : i} ref={esCursor ? cursorRef : undefined} className={clase}>
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

      <p className="text-center text-sm text-slate-500 mt-4">
        {estado === "listo" && "El tiempo empieza cuando escribes la primera letra. Si te equivocas, escribe la letra correcta para avanzar. "}
        Pulsa <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Esc</kbd> para cambiar de texto.
      </p>
    </div>
  );
}

/** Cuenta desde 0 hasta `final` con desaceleración suave. */
function useContador(final: number, ms = 1400, retraso = 0) {
  const [valor, setValor] = useState(0);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    let raf = 0;
    let inicio = 0;
    const paso = (t: number) => {
      if (!inicio) inicio = t;
      const p = Math.min(1, Math.max(0, (t - inicio - retraso) / ms));
      setValor(final * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(paso);
      else setListo(true);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [final, ms, retraso]);
  return { valor, listo };
}

function nombreTecla(t: string) {
  return t === " " ? "espacio" : t;
}

const ESTILO_AVISO: Record<AvisoGuardado["tipo"], string> = {
  ok: "bg-emerald-50 border-emerald-200 text-emerald-700",
  aviso: "bg-amber-50 border-amber-200 text-amber-800",
  error: "bg-rose-50 border-rose-200 text-rose-700",
  cargando: "bg-slate-50 border-slate-200 text-slate-500",
};

function PanelResultado({
  r,
  comparacion,
  aviso,
  onOtraVez,
}: {
  r: Resultado;
  comparacion: Comparacion | null;
  aviso: AvisoGuardado | null;
  onOtraVez: () => void;
}) {
  const ppm = useContador(r.ppm);
  const precision = useContador(r.precision, 1400, 250);
  const revelado = ppm.listo && precision.listo;

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
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Tu resultado</div>

      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto mb-6">
        <div>
          <div className="text-7xl font-extrabold text-sky-600 tabular-nums">{Math.round(ppm.valor)}</div>
          <div className="text-slate-600">palabras por minuto</div>
        </div>
        <div>
          <div className="text-7xl font-extrabold text-emerald-600 tabular-nums">
            {precision.valor.toFixed(Number.isInteger(r.precision) ? 0 : 1)}
            <span className="text-4xl">%</span>
          </div>
          <div className="text-slate-600">precisión</div>
        </div>
      </div>

      <div className={`transition-all duration-500 ${revelado ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
        {comparacion && <Comparativa ppm={r.ppm} c={comparacion} />}

        <div className="grid grid-cols-3 gap-3 mb-6 max-w-xl mx-auto">
          <Dato etiqueta="Caracteres correctos" valor={r.correctos} />
          <Dato etiqueta="Errores cometidos" valor={r.errores} />
          <Dato etiqueta="Teclas pulsadas" valor={r.pulsaciones} />
        </div>

        <p className="text-lg text-slate-700 mb-6">{mensaje}</p>

        {aviso && <p className={`text-sm border rounded-lg px-4 py-2 mb-6 inline-block ${ESTILO_AVISO[aviso.tipo]}`}>{aviso.texto}</p>}

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
      </div>

      <button onClick={onOtraVez} autoFocus className="px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl shadow transition">
        Intentar con otro texto
      </button>
    </div>
  );
}

function Comparativa({ ppm, c }: { ppm: number; c: Comparacion }) {
  const record = c.recordPrevio == null ? null : Math.round(c.recordPrevio);
  const sesion = c.mejorSesionPrevio;

  const destacado = "bg-amber-50 border-amber-300 text-amber-800";
  const neutro = "bg-slate-50 border-slate-200 text-slate-700";

  let titular: { texto: string; estilo: string } | null = null;
  if (c.recordPrevio !== undefined) {
    if (record === null) titular = { texto: "🎉 ¡Tu primer resultado registrado!", estilo: "bg-sky-50 border-sky-200 text-sky-800" };
    else if (ppm > record) titular = { texto: `🏆 ¡Nuevo récord personal! Superaste tu marca de ${record} ppm por ${ppm - record}.`, estilo: destacado };
    else if (ppm === record) titular = { texto: `¡Igualaste tu récord personal de ${record} ppm!`, estilo: "bg-sky-50 border-sky-200 text-sky-800" };
    else titular = { texto: `Tu récord es ${record} ppm: te faltaron ${record - ppm} para alcanzarlo.`, estilo: neutro };
  } else if (sesion !== null) {
    titular =
      ppm > sesion
        ? { texto: `🏆 ¡Tu mejor resultado de esta sesión! Mejoraste ${ppm - sesion} ppm.`, estilo: destacado }
        : { texto: `Tu mejor marca de esta sesión es ${sesion} ppm.`, estilo: neutro };
  }

  if (!titular) return null;
  return <p className={`inline-block border rounded-xl px-4 py-2 font-medium mb-6 ${titular.estilo}`}>{titular.texto}</p>;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3">
      <div className="text-2xl font-bold text-slate-800 tabular-nums">{valor}</div>
      <div className="text-xs text-slate-500">{etiqueta}</div>
    </div>
  );
}
