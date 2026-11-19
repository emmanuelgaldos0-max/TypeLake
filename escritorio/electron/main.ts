// Proceso principal de TypeLake sin internet: ventana, datos en disco e IPC.
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { BrowserWindow, Menu, app, dialog, ipcMain, shell } from "electron";
import { categoriaDe } from "../../src/lib/memes";
import { EXT_PAQUETE, EXT_RESULTADOS, VERSION_FORMATO, type AlumnoPaquete, type ArchivoResultados, type IntentoSinInternet, type Paquete } from "../../src/lib/sinInternet";
import { descifrarPaquete, firmarIntento, normalizarCodigo, pinCorrecto } from "../../src/lib/sinInternetCripto";

// ─── Carpeta de datos ────────────────────────────────────────────────────────
// C:\ProgramData\TypeLake (compartida por todas las cuentas de Windows de la PC);
// si no se puede escribir ahí, la carpeta del usuario.
function carpetaDatos(): string {
  // Solo para pruebas en desarrollo
  if (!app.isPackaged && process.env.TYPELAKE_DATOS) {
    mkdirSync(process.env.TYPELAKE_DATOS, { recursive: true });
    return process.env.TYPELAKE_DATOS;
  }
  const candidatas = [join(process.env.PROGRAMDATA ?? "C:\\ProgramData", "TypeLake"), join(app.getPath("userData"), "datos")];
  for (const c of candidatas) {
    try {
      mkdirSync(c, { recursive: true });
      const prueba = join(c, ".prueba");
      writeFileSync(prueba, "ok");
      return c;
    } catch {
      // probar la siguiente
    }
  }
  throw new Error("No hay dónde guardar los datos de TypeLake.");
}

let DATOS = "";
const ruta = (archivo: string) => join(DATOS, archivo);

function escribirSeguro(archivo: string, contenido: string) {
  const tmp = `${ruta(archivo)}.tmp`;
  writeFileSync(tmp, contenido, "utf8");
  renameSync(tmp, ruta(archivo));
}

interface IntentoGuardado extends IntentoSinInternet {
  exportado: boolean;
}
interface Almacen {
  intentos: IntentoGuardado[];
  /** Preferencia de memes que cada alumno cambió en esta PC. */
  memes: Record<string, boolean>;
}

let paquete: Paquete | null = null;
let almacen: Almacen = { intentos: [], memes: {} };

function leerAlmacen() {
  try {
    almacen = JSON.parse(readFileSync(ruta("resultados.json"), "utf8"));
    almacen.intentos ??= [];
    almacen.memes ??= {};
  } catch {
    almacen = { intentos: [], memes: {} };
  }
}
const guardarAlmacen = () => escribirSeguro("resultados.json", JSON.stringify(almacen));

function validarPaquete(texto: string): Paquete {
  const p = descifrarPaquete<Paquete>(texto);
  if (p.tipo !== "typelake-paquete" || !Array.isArray(p.alumnos)) throw new Error("El archivo no es un paquete de TypeLake.");
  if (p.version > VERSION_FORMATO) throw new Error("Este paquete es de una versión más nueva de TypeLake. Instala la última versión.");
  if (p.version < VERSION_FORMATO || !Array.isArray(p.salones)) throw new Error("Este paquete es antiguo. Descarga uno nuevo en la página: Admin → Sin internet.");
  return p;
}

/** Carga el paquete guardado o, si el que viene en el instalador es más nuevo, ese. */
function cargarPaquete() {
  let guardado: Paquete | null = null;
  let texto = "";
  try {
    texto = readFileSync(ruta("paquete.tlpaquete"), "utf8");
    guardado = validarPaquete(texto);
  } catch {
    guardado = null;
  }
  const incluido = join(process.resourcesPath, "paquete");
  try {
    const archivo = existsSync(incluido) ? readdirSync(incluido).find((f) => f.endsWith(`.${EXT_PAQUETE}`)) : undefined;
    if (archivo) {
      const textoIncluido = readFileSync(join(incluido, archivo), "utf8");
      const p = validarPaquete(textoIncluido);
      if (!guardado || p.creado_en > guardado.creado_en) {
        guardado = p;
        escribirSeguro("paquete.tlpaquete", textoIncluido);
      }
    }
  } catch {
    // sin paquete incluido
  }
  paquete = guardado;
}

// ─── Sesiones ────────────────────────────────────────────────────────────────
let alumno: AlumnoPaquete | null = null;
/** Practicando sin cuenta: nada se guarda y todo se olvida al salir. */
let invitado: { memes: boolean } | null = null;
let profesorHasta = 0; // el panel del profesor queda abierto 10 minutos tras el PIN
const profesorActivo = () => Date.now() < profesorHasta;

const nombreCompleto = (a: AlumnoPaquete) => `${a.nombres} ${a.apellidos}`;

function memesDe(a: AlumnoPaquete) {
  return { activos: almacen.memes[a.id] ?? a.memesActivos, bloqueados: a.memesBloqueados };
}

function record(a: AlumnoPaquete): number | null {
  const locales = almacen.intentos.filter((i) => i.alumno_id === a.id).map((i) => i.ppm);
  const todos = [...locales, ...(a.mejor === null ? [] : [a.mejor])];
  return todos.length ? Math.max(...todos) : null;
}

function resumen() {
  return {
    hayPaquete: !!paquete,
    paqueteFecha: paquete?.creado_en ?? null,
    alumnos: paquete?.alumnos.length ?? 0,
    memes: paquete?.memes.length ?? 0,
    total: almacen.intentos.length,
    pendientes: almacen.intentos.filter((i) => !i.exportado).length,
    equipo: hostname(),
    carpeta: DATOS,
  };
}

// ─── IPC ─────────────────────────────────────────────────────────────────────
type Resp<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function registrarIpc() {
  ipcMain.handle("estado", () => ({
    ...resumen(),
    alumno: alumno && { nombres: alumno.nombres, apellidos: alumno.apellidos, salon: alumno.salon, memes: memesDe(alumno) },
    invitado: !!invitado,
  }));

  // Ingreso con usuario + código del salón (sin contraseña)
  let fallidos = 0;
  ipcMain.handle("entrar", async (_e, usuario: string, codigo: string): Promise<Resp> => {
    if (!paquete) return { ok: false, error: "Esta PC todavía no tiene la lista de alumnos." };
    // Pausa creciente tras varios intentos fallidos seguidos, para que no se puedan adivinar códigos
    if (fallidos >= 5) await new Promise((r) => setTimeout(r, Math.min(fallidos - 4, 10) * 1000));
    const u = String(usuario ?? "").trim().toLowerCase();
    const a = paquete.alumnos.find((x) => x.usuario.toLowerCase() === u);
    const salon = a ? paquete.salones.find((s) => s.id === a.salonId) : undefined;
    if (!a || !salon || normalizarCodigo(codigo) !== salon.codigo) {
      fallidos++;
      return { ok: false, error: "Usuario o código del salón incorrectos." };
    }
    fallidos = 0;
    alumno = a;
    invitado = null;
    return { ok: true };
  });

  ipcMain.handle("entrarInvitado", () => {
    alumno = null;
    invitado = { memes: false };
  });

  ipcMain.handle("salir", () => {
    alumno = null;
    invitado = null;
  });

  ipcMain.handle("record", () => (alumno ? record(alumno) : null));

  ipcMain.handle("guardar", (_e, r: Record<string, unknown>): Resp<{ ppm: number }> => {
    if (!alumno || !paquete) return { ok: false, error: "Vuelve a iniciar sesión." };
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
    const senalesEntrada = (r.senales ?? {}) as Record<string, unknown>;
    const senales: Record<string, unknown> = {};
    for (const k of ["variacionRitmo", "salidasPestana", "insercionesMasivas", "pegadosBloqueados"]) {
      const v = senalesEntrada[k];
      senales[k] = typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    const teclas: Record<string, number> = {};
    for (const [k, v] of Object.entries((r.erroresPorTecla ?? {}) as Record<string, unknown>)) if (k.length <= 3) teclas[k] = n(v);
    const duracion = n(r.duracionSeg) || 60;
    const base = {
      origen_id: randomUUID(),
      alumno_id: alumno.id,
      creado_en: new Date().toISOString(),
      duracion_seg: duracion,
      correctos: n(r.correctos),
      incorrectos: n(r.incorrectos),
      pulsaciones: n(r.pulsaciones),
      errores: n(r.errores),
      errores_por_tecla: teclas,
      senales,
    };
    const ppm = Math.round((base.correctos / 5 / (duracion / 60)) * 10) / 10;
    almacen.intentos.push({ ...base, paquete_id: paquete.id, ppm, firma: firmarIntento(paquete.clave_firma, base), exportado: false });
    guardarAlmacen();
    return { ok: true, ppm };
  });

  ipcMain.handle("elegirMeme", (_e, ppm: number, referencia: number | null) => {
    if (!paquete) return null;
    if (alumno) {
      const m = memesDe(alumno);
      if (m.bloqueados || !m.activos) return null;
    } else if (!invitado?.memes) return null;
    const categoria = categoriaDe(ppm, referencia);
    const candidatos = paquete.memes.filter((x) =>
      x.criterio === "record" ? x.categoria === categoria : (x.ppm_min === null || ppm >= x.ppm_min) && (x.ppm_max === null || ppm < x.ppm_max),
    );
    if (!candidatos.length) return null;
    return { url: candidatos[Math.floor(Math.random() * candidatos.length)].datos };
  });

  ipcMain.handle("cambiarMemes", (_e, activos: boolean) => {
    if (invitado) invitado.memes = !!activos; // solo mientras dure la sesión
    if (!alumno) return;
    almacen.memes[alumno.id] = !!activos;
    guardarAlmacen();
  });

  // ── Profesor ──
  ipcMain.handle("profesor:entrar", (_e, pin: string): Resp => {
    if (!paquete) {
      // Sin paquete todavía: se puede entrar sin PIN, solo para cargar el primero
      profesorHasta = Date.now() + 10 * 60 * 1000;
      return { ok: true };
    }
    if (!pinCorrecto(String(pin ?? ""), paquete.pin)) return { ok: false, error: "PIN incorrecto." };
    profesorHasta = Date.now() + 10 * 60 * 1000;
    return { ok: true };
  });

  ipcMain.handle("profesor:salir", () => {
    profesorHasta = 0;
  });

  ipcMain.handle("profesor:cargarPaquete", async (): Promise<Resp<{ alumnos: number }>> => {
    if (!profesorActivo()) return { ok: false, error: "Vuelve a ingresar tu PIN." };
    const r = await dialog.showOpenDialog(ventana!, {
      title: "Elige el paquete de TypeLake",
      filters: [{ name: "Paquete de TypeLake", extensions: [EXT_PAQUETE] }],
      properties: ["openFile"],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, error: "" };
    try {
      const texto = readFileSync(r.filePaths[0], "utf8");
      const p = validarPaquete(texto);
      escribirSeguro("paquete.tlpaquete", texto);
      paquete = p;
      alumno = null;
      invitado = null;
      return { ok: true, alumnos: p.alumnos.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el paquete." };
    }
  });

  ipcMain.handle("profesor:exportar", async (_e, soloPendientes: boolean): Promise<Resp<{ cantidad: number; archivo: string }>> => {
    if (!profesorActivo()) return { ok: false, error: "Vuelve a ingresar tu PIN." };
    const lista = almacen.intentos.filter((i) => !soloPendientes || !i.exportado);
    if (!lista.length) return { ok: false, error: "No hay resultados para guardar." };
    const fecha = new Date().toISOString().slice(0, 10);
    const equipo = hostname();
    const r = await dialog.showSaveDialog(ventana!, {
      title: "Guardar resultados (elige tu USB)",
      defaultPath: `TypeLake-resultados-${equipo}-${fecha}.${EXT_RESULTADOS}`,
      filters: [{ name: "Resultados de TypeLake", extensions: [EXT_RESULTADOS] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, error: "" };
    const nombres: Record<string, string> = {};
    for (const a of paquete?.alumnos ?? []) if (lista.some((i) => i.alumno_id === a.id)) nombres[a.id] = `${a.apellidos}, ${a.nombres}`;
    const archivo: ArchivoResultados = {
      tipo: "typelake-resultados",
      version: VERSION_FORMATO,
      equipo,
      exportado_en: new Date().toISOString(),
      nombres,
      intentos: lista.map(({ exportado: _exportado, ...i }) => i),
    };
    try {
      writeFileSync(r.filePath, JSON.stringify(archivo), "utf8");
    } catch (e) {
      return { ok: false, error: `No se pudo guardar: ${e instanceof Error ? e.message : e}` };
    }
    const ids = new Set(lista.map((i) => i.origen_id));
    for (const i of almacen.intentos) if (ids.has(i.origen_id)) i.exportado = true;
    guardarAlmacen();
    return { ok: true, cantidad: lista.length, archivo: r.filePath };
  });

  ipcMain.handle("profesor:borrarExportados", (): Resp<{ cantidad: number }> => {
    if (!profesorActivo()) return { ok: false, error: "Vuelve a ingresar tu PIN." };
    const antes = almacen.intentos.length;
    almacen.intentos = almacen.intentos.filter((i) => !i.exportado);
    guardarAlmacen();
    return { ok: true, cantidad: antes - almacen.intentos.length };
  });

  ipcMain.handle("profesor:recientes", () => {
    if (!profesorActivo()) return [];
    const nombre = new Map((paquete?.alumnos ?? []).map((a) => [a.id, nombreCompleto(a)]));
    return almacen.intentos
      .slice(-30)
      .reverse()
      .map((i) => ({ nombre: nombre.get(i.alumno_id) ?? "Alumno", ppm: i.ppm, fecha: i.creado_en, exportado: i.exportado }));
  });
}

// ─── Ventana ─────────────────────────────────────────────────────────────────
let ventana: BrowserWindow | null = null;

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: "TypeLake",
    backgroundColor: "#f6f8fb",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      spellcheck: false,
    },
  });
  ventana.maximize();
  ventana.once("ready-to-show", () => ventana?.show());
  // La prueba pide confirmar antes de salir; en la app, cerrar la ventana siempre cierra.
  ventana.webContents.on("will-prevent-unload", (e) => e.preventDefault());
  // Nada de navegar a otras páginas ni abrir ventanas nuevas
  ventana.webContents.on("will-navigate", (e) => e.preventDefault());
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  // Sin zoom con Ctrl + rueda ni recarga con F5 / Ctrl+R (perdería la sesión)
  ventana.webContents.setVisualZoomLevelLimits(1, 1);
  ventana.webContents.on("before-input-event", (e, input) => {
    const k = input.key.toLowerCase();
    if (k === "f5" || ((input.control || input.meta) && (k === "r" || k === "=" || k === "-" || k === "+" || k === "0"))) e.preventDefault();
  });
  ventana.loadFile(join(__dirname, "renderer", "index.html"));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    DATOS = carpetaDatos();
    leerAlmacen();
    cargarPaquete();
    registrarIpc();
    crearVentana();
  });
  app.on("window-all-closed", () => app.quit());
}
