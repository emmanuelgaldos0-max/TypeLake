// Tipos y reglas de los memes que se comparten entre servidor y navegador.

export type CategoriaRecord = "nuevo_record" | "cerca" | "peor";

export type CriterioMeme =
  | { criterio: "record"; categoria: CategoriaRecord }
  | { criterio: "ppm"; ppmMin: number | null; ppmMax: number | null };

export const CATEGORIAS: { valor: CategoriaRecord; texto: string }[] = [
  { valor: "nuevo_record", texto: "Batió su récord" },
  { valor: "cerca", texto: "Quedó cerca de su récord" },
  { valor: "peor", texto: "Le fue peor que su récord" },
];

/** "Cerca" = al menos el 90 % de su récord. */
export const UMBRAL_CERCA = 0.9;
export const MAX_MB = 5; // los GIF animados suelen pesar más de 2 MB
export const MAX_BYTES = MAX_MB * 1024 * 1024;
export const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_PENDIENTES_ALUMNO = 5;
/** Imágenes que un alumno puede subir por hora (confirmadas o no). */
export const MAX_SUBIDAS_HORA_ALUMNO = 6;
/** Subidas sin confirmar que un alumno puede tener a la vez. */
export const MAX_SIN_CONFIRMAR_ALUMNO = 2;

/** Categoría de un intento frente a la marca anterior (null = primer intento: cuenta como récord). */
export function categoriaDe(ppm: number, referencia: number | null): CategoriaRecord {
  if (referencia === null || ppm > referencia) return "nuevo_record";
  return ppm >= referencia * UMBRAL_CERCA ? "cerca" : "peor";
}

export function describirCriterio(c: CriterioMeme) {
  if (c.criterio === "record") return CATEGORIAS.find((x) => x.valor === c.categoria)?.texto ?? c.categoria;
  if (c.ppmMin !== null && c.ppmMax !== null) return `De ${c.ppmMin} a menos de ${c.ppmMax} ppm`;
  if (c.ppmMin !== null) return `${c.ppmMin} ppm o más`;
  return `Menos de ${c.ppmMax} ppm`;
}

/** Valida un criterio que viene del navegador. Devuelve un mensaje de error o null. */
export function validarCriterio(c: CriterioMeme): string | null {
  if (c.criterio === "record") return CATEGORIAS.some((x) => x.valor === c.categoria) ? null : "Elige para qué resultado es el meme.";
  if (c.criterio !== "ppm") return "Criterio no válido.";
  const ok = (n: number | null) => n === null || (Number.isFinite(n) && n >= 0 && n < 1000);
  if (!ok(c.ppmMin) || !ok(c.ppmMax)) return "Los PPM deben ser números entre 0 y 999.";
  if (c.ppmMin === null && c.ppmMax === null) return "Escribe al menos un límite de PPM.";
  if (c.ppmMin !== null && c.ppmMax !== null && c.ppmMin >= c.ppmMax) return "El mínimo debe ser menor que el máximo.";
  return null;
}

/** Columnas de la tabla memes para un criterio. */
export function columnasCriterio(c: CriterioMeme) {
  return c.criterio === "record"
    ? { criterio: "record", categoria: c.categoria, ppm_min: null, ppm_max: null }
    : { criterio: "ppm", categoria: null, ppm_min: c.ppmMin, ppm_max: c.ppmMax };
}

export interface FilaMeme {
  id: number;
  ruta: string;
  criterio: "record" | "ppm";
  categoria: CategoriaRecord | null;
  ppm_min: number | null;
  ppm_max: number | null;
  estado: "pendiente" | "aprobado";
  subido_por: string | null;
  creado_en: string;
}

export function criterioDeFila(f: Pick<FilaMeme, "criterio" | "categoria" | "ppm_min" | "ppm_max">): CriterioMeme {
  return f.criterio === "record"
    ? { criterio: "record", categoria: f.categoria ?? "nuevo_record" }
    : { criterio: "ppm", ppmMin: f.ppm_min === null ? null : Number(f.ppm_min), ppmMax: f.ppm_max === null ? null : Number(f.ppm_max) };
}
