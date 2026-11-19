import { useCallback, useEffect, useState, type FormEvent } from "react";
import Logo from "@/components/Logo";
import PruebaMecanografia, { type AvisoGuardado, type ServicioMemes } from "@/components/PruebaMecanografia";
import Spinner from "@/components/ui/Spinner";
import type { Resultado } from "@/lib/metricas";

const api = window.typelake;

const SERVICIO_MEMES: ServicioMemes = {
  elegir: (ppm, referencia) => api.elegirMeme(ppm, referencia),
  cambiarPreferencia: (activos) => api.cambiarMemes(activos),
};

export default function App() {
  const [estado, setEstado] = useState<EstadoApp | null>(null);
  const [profesor, setProfesor] = useState(false);

  const refrescar = useCallback(() => api.estado().then(setEstado), []);
  useEffect(() => {
    refrescar();
  }, [refrescar]);

  if (!estado) {
    return (
      <div className="flex-1 grid place-items-center">
        <Spinner className="h-8 w-8 text-lago-600" />
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <Logo />
          <span className="chip bg-slate-100 text-slate-500">Sin internet</span>
          {(estado.alumno || estado.invitado) && (
            <div className="ml-auto flex items-center gap-3">
              {estado.alumno ? (
                <span className="text-sm text-slate-600">
                  <b className="text-slate-900">
                    {estado.alumno.nombres} {estado.alumno.apellidos}
                  </b>{" "}
                  · {estado.alumno.salon}
                </span>
              ) : (
                <span className="text-sm text-slate-600">
                  <b className="text-slate-900">Sin cuenta</b> · no se guarda nada
                </span>
              )}
              <button
                className="btn btn-secundario"
                onClick={async () => {
                  await api.salir();
                  refrescar();
                }}
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {estado.invitado ? (
          <PracticaInvitado />
        ) : !estado.hayPaquete ? (
          <SinPaquete alEntrar={refrescar} />
        ) : estado.alumno ? (
          <Practica nombre={estado.alumno.nombres.split(" ")[0]} memes={estado.alumno.memes} />
        ) : (
          <Ingreso alEntrar={refrescar} />
        )}
      </main>

      <footer className="py-4 px-6 flex items-center text-xs text-slate-400">
        <span>TypeLake · Concurso de Mecanografía · Tus resultados se guardan en esta PC</span>
        <button className="ml-auto hover:text-slate-600" onClick={() => setProfesor(true)}>
          Profesor
        </button>
      </footer>

      {profesor && (
        <PanelProfesor
          estado={estado}
          cerrar={() => {
            api.profesor.salir();
            setProfesor(false);
            refrescar();
          }}
          refrescar={refrescar}
        />
      )}
    </>
  );
}

function SinPaquete({ alEntrar }: { alEntrar: () => void }) {
  return (
    <div className="flex-1 grid place-items-center px-4">
      <div className="tarjeta p-8 max-w-md text-center animate-aparecer">
        <h1 className="text-2xl font-extrabold text-slate-900">Falta la lista de alumnos</h1>
        <p className="text-slate-600 mt-2">
          El profesor debe cargar el paquete de TypeLake en esta PC con el botón <b>Profesor</b> (abajo a la derecha).
        </p>
        <BotonInvitado alEntrar={alEntrar} />
      </div>
    </div>
  );
}

function BotonInvitado({ alEntrar }: { alEntrar: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-secundario w-full mt-4"
      onClick={async () => {
        await api.entrarInvitado();
        alEntrar();
      }}
    >
      Practicar sin cuenta
    </button>
  );
}

const SERVICIO_MEMES_INVITADO: ServicioMemes = {
  elegir: (ppm, referencia) => api.elegirMeme(ppm, referencia),
  cambiarPreferencia: (activos) => api.cambiarMemes(activos),
};

function PracticaInvitado() {
  return (
    <div className="flex-1 px-4 pt-8 pb-10 animate-aparecer">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          ¿Qué tan rápido <span className="text-lago-600">escribes</span>?
        </h1>
        <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 inline-flex px-3 py-1.5 rounded-full">
          Estás practicando sin cuenta: tus resultados no se guardan. Al salir se borra todo.
        </p>
      </div>
      {/* "alumno" + activos:false para que la preferencia de memes no quede guardada en la PC */}
      <PruebaMecanografia memes={{ cuenta: "alumno", activos: false, bloqueados: false }} servicioMemes={SERVICIO_MEMES_INVITADO} />
    </div>
  );
}

function Ingreso({ alEntrar }: { alEntrar: () => void }) {
  const [usuario, setUsuario] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    const r = await api.entrar(usuario, codigo);
    setCargando(false);
    if (!r.ok) return setError(r.error);
    alEntrar();
  };

  return (
    <div className="flex-1 grid place-items-center px-4 py-10">
      <form onSubmit={enviar} className="tarjeta p-8 w-full max-w-sm space-y-4 animate-aparecer">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-slate-900">¡Bienvenido a TypeLake!</h1>
          <p className="text-sm text-slate-500 mt-1">Ingresa con tu usuario y el código de tu salón.</p>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Usuario
          <input autoFocus value={usuario} onChange={(e) => setUsuario(e.target.value)} className="campo mt-1" autoComplete="off" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Código del salón
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            className="campo mt-1 font-mono tracking-widest uppercase"
            autoComplete="off"
            maxLength={8}
          />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn btn-primario w-full" disabled={cargando || !usuario || !codigo}>
          {cargando ? <Spinner /> : "Entrar"}
        </button>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />o<span className="h-px flex-1 bg-slate-200" />
        </div>
        <BotonInvitado alEntrar={alEntrar} />
      </form>
    </div>
  );
}

function Practica({ nombre, memes }: { nombre: string; memes: { activos: boolean; bloqueados: boolean } }) {
  const guardar = useCallback(async (r: Resultado): Promise<AvisoGuardado> => {
    const g = await api.guardar(r);
    return g.ok ? { tipo: "ok", texto: "Resultado guardado en esta PC ✓" } : { tipo: "error", texto: g.error };
  }, []);
  const obtenerRecord = useCallback(() => api.record(), []);

  return (
    <div className="flex-1 px-4 pt-8 pb-10 animate-aparecer">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          ¡Hola, <span className="text-lago-600">{nombre}</span>!
        </h1>
        <p className="text-slate-600 mt-3 text-lg">Escribe el texto lo más rápido y preciso que puedas durante 1 minuto.</p>
      </div>
      <PruebaMecanografia guardar={guardar} obtenerRecord={obtenerRecord} memes={{ cuenta: "alumno", ...memes }} servicioMemes={SERVICIO_MEMES} />
    </div>
  );
}

function PanelProfesor({ estado, cerrar, refrescar }: { estado: EstadoApp; cerrar: () => void; refrescar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [pin, setPin] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [recientes, setRecientes] = useState<{ nombre: string; ppm: number; fecha: string; exportado: boolean }[]>([]);

  const cargarRecientes = useCallback(() => api.profesor.recientes().then(setRecientes), []);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    const r = await api.profesor.entrar(pin);
    if (!r.ok) return setMensaje({ ok: false, texto: r.error });
    setMensaje(null);
    setAbierto(true);
    refrescar(); // los contadores cambian con cada prueba guardada
    cargarRecientes();
  };

  const accion = async (fn: () => Promise<Resp<Record<string, unknown>>>, exito: (r: Record<string, unknown>) => string) => {
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await fn();
      if (r.ok) setMensaje({ ok: true, texto: exito(r) });
      else if (r.error) setMensaje({ ok: false, texto: r.error });
    } finally {
      setOcupado(false);
      refrescar();
      cargarRecientes();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 grid place-items-center px-4" onClick={cerrar}>
      <div className="tarjeta p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-aparecer" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900 mr-auto">Profesor</h2>
          <button className="btn-enlace text-slate-500" onClick={cerrar}>
            Cerrar
          </button>
        </div>

        {!abierto ? (
          <form onSubmit={entrar} className="space-y-3">
            <p className="text-sm text-slate-600">
              {estado.hayPaquete ? "Ingresa tu PIN de profesor." : "Esta PC aún no tiene paquete: entra sin PIN para cargar el primero."}
            </p>
            {estado.hayPaquete && <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} className="campo" placeholder="PIN" />}
            {mensaje && <p className={`text-sm ${mensaje.ok ? "text-emerald-700" : "text-rose-600"}`}>{mensaje.texto}</p>}
            <button className="btn btn-primario">Entrar</button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Dato titulo="Sin sacar todavía" valor={estado.pendientes} />
              <Dato titulo="Guardados en esta PC" valor={estado.total} />
              <Dato titulo="Alumnos en el paquete" valor={estado.alumnos} />
              <Dato titulo="Paquete del" valor={estado.paqueteFecha ? new Date(estado.paqueteFecha).toLocaleDateString("es-PE") : "—"} />
            </div>

            <div className="flex flex-col gap-2">
              <button
                className="btn btn-exito"
                disabled={ocupado || estado.pendientes === 0}
                onClick={() => accion(() => api.profesor.exportar(true), (r) => `Se guardaron ${r.cantidad} resultado(s) en ${r.archivo}. Súbelos en la página: Admin → Sin internet.`)}
              >
                Guardar resultados nuevos en USB ({estado.pendientes})
              </button>
              <button
                className="btn btn-secundario"
                disabled={ocupado || estado.total === 0}
                onClick={() => accion(() => api.profesor.exportar(false), (r) => `Se guardaron ${r.cantidad} resultado(s) en ${r.archivo}.`)}
              >
                Guardar todos otra vez ({estado.total})
              </button>
              <button
                className="btn btn-secundario"
                disabled={ocupado}
                onClick={() => accion(() => api.profesor.cargarPaquete(), (r) => `Paquete cargado: ${r.alumnos} alumnos.`)}
              >
                Cargar paquete (lista de alumnos y memes)
              </button>
              <button
                className="btn-enlace text-rose-600 self-start mt-1"
                disabled={ocupado || estado.total === estado.pendientes}
                onClick={() => {
                  if (confirm("¿Borrar de esta PC los resultados que ya guardaste en USB? Asegúrate de haberlos subido a la página.")) {
                    accion(() => api.profesor.borrarExportados(), (r) => `Se borraron ${r.cantidad} resultado(s) ya guardados.`);
                  }
                }}
              >
                Borrar de esta PC los que ya saqué
              </button>
            </div>
            {mensaje && <p className={`text-sm break-words ${mensaje.ok ? "text-emerald-700" : "text-rose-600"}`}>{mensaje.texto}</p>}

            {recientes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Últimos resultados en esta PC</h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {recientes.map((r, i) => (
                    <li key={i} className="py-1.5 flex items-center gap-2">
                      <span className="mr-auto text-slate-800">{r.nombre}</span>
                      <span className="tabular-nums text-slate-600">{Math.round(r.ppm)} ppm</span>
                      <span className="text-xs text-slate-400 w-28 text-right">{new Date(r.fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</span>
                      <span className={`chip ${r.exportado ? "" : "bg-amber-50 text-amber-700"}`}>{r.exportado ? "Sacado" : "Nuevo"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-400">
              PC: {estado.equipo} · Datos en {estado.carpeta}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{titulo}</div>
      <div className="text-lg font-bold text-slate-900 tabular-nums">{valor}</div>
    </div>
  );
}
