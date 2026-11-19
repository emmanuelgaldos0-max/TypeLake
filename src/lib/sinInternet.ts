// Formato de los archivos que viajan entre la página y la app de escritorio sin internet.
// Lo usan el servidor (Next) y el proceso principal de la app (Electron). Sin dependencias.
//
//  Paquete (página → PC):  alumnos, códigos de salón, récords, memes aprobados y el
//                          PIN del profesor. Va cifrado. En la PC el alumno entra con
//                          su usuario y el código de su salón (sin contraseña).
//  Resultados (PC → página): intentos hechos sin internet, cada uno firmado con la clave
//                          del paquete para que no se puedan inventar o editar a mano.

export const VERSION_FORMATO = 2;
export const EXT_PAQUETE = "tlpaquete";
export const EXT_RESULTADOS = "tlresultados";

export interface AlumnoPaquete {
  id: string;
  usuario: string;
  nombres: string;
  apellidos: string;
  salon: string;
  salonId: number | null;
  /** Mejor PPM válido en línea al generar el paquete. */
  mejor: number | null;
  memesActivos: boolean;
  memesBloqueados: boolean;
}

export interface MemePaquete {
  /** Imagen como data URL. */
  datos: string;
  criterio: "record" | "ppm";
  categoria: "nuevo_record" | "cerca" | "peor" | null;
  ppm_min: number | null;
  ppm_max: number | null;
}

export interface Paquete {
  tipo: "typelake-paquete";
  version: number;
  id: string;
  creado_en: string;
  /** Clave (hex) con la que la PC firma cada intento. El servidor la vuelve a derivar del id. */
  clave_firma: string;
  pin: { sal: string; hash: string };
  /** Código de cada salón para ingresar en la PC (usuario + código). */
  salones: { id: number; nombre: string; codigo: string }[];
  alumnos: AlumnoPaquete[];
  memes: MemePaquete[];
}

export interface IntentoSinInternet {
  origen_id: string;
  /** Paquete con cuya clave se firmó (el servidor deriva la clave de este id). */
  paquete_id: string;
  alumno_id: string;
  creado_en: string;
  duracion_seg: number;
  correctos: number;
  incorrectos: number;
  pulsaciones: number;
  errores: number;
  errores_por_tecla: Record<string, number>;
  senales: Record<string, unknown>;
  /** Solo para mostrar; el servidor recalcula las PPM. */
  ppm: number;
  firma: string;
}

export interface ArchivoResultados {
  tipo: "typelake-resultados";
  version: number;
  equipo: string;
  exportado_en: string;
  /** Nombre de cada alumno, solo para mostrar en la vista previa al importar. */
  nombres: Record<string, string>;
  intentos: IntentoSinInternet[];
}

/** Texto que se firma de cada intento (todos los datos que cuentan). */
export function textoAFirmar(i: Omit<IntentoSinInternet, "firma" | "ppm" | "paquete_id">): string {
  const teclas = Object.keys(i.errores_por_tecla)
    .sort()
    .map((k) => `${k}:${i.errores_por_tecla[k]}`)
    .join(",");
  const senales = Object.keys(i.senales)
    .sort()
    .map((k) => `${k}:${String(i.senales[k])}`)
    .join(",");
  return [i.origen_id, i.alumno_id, i.creado_en, i.duracion_seg, i.correctos, i.incorrectos, i.pulsaciones, i.errores, teclas, senales].join("|");
}
