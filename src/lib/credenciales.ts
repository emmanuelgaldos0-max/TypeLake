import { randomInt } from "node:crypto";

const PALABRAS = [
  "sol", "luna", "rio", "mar", "gato", "puma", "llama", "condor", "palta", "mango",
  "lucuma", "cielo", "nube", "roca", "selva", "lago", "tigre", "oso", "loro", "pino",
  "fresa", "limon", "piedra", "monte", "playa", "barco", "tren", "cometa", "faro", "isla",
];

/** Contraseña fácil de dictar y escribir: palabra + 4 dígitos (ej. "puma4821"). */
export function generarClave() {
  return PALABRAS[randomInt(PALABRAS.length)] + String(randomInt(10000)).padStart(4, "0");
}

export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Clave para comparar nombres de grado: conserva los números ("1° de secundaria" ≠ "2° de secundaria"). */
export function claveGrado(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Usuario base: inicial del nombre + primer apellido + inicial del segundo (Juan Pérez García → jperezg). */
export function usuarioBase(nombres: string, apellidos: string) {
  const [n1 = ""] = nombres.trim().split(/\s+/);
  const [a1 = "", a2 = ""] = apellidos.trim().split(/\s+/);
  const base = normalizar(n1).slice(0, 1) + normalizar(a1) + normalizar(a2).slice(0, 1);
  return base || "alumno";
}

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y"]);

/** "QUISPE DE LA CRUZ" → "Quispe de la Cruz" */
export function nombrePropio(texto: string) {
  return texto
    .trim()
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase("es") + p.slice(1)))
    .join(" ");
}

/** Orden para listas: inicial 0x, primaria 1x, secundaria 2x. */
export function ordenDeGrado(nombre: string) {
  const n = Number(nombre.match(/\d+/)?.[0] ?? 0);
  if (/secundaria/i.test(nombre)) return 20 + n;
  if (/primaria/i.test(nombre)) return 10 + n;
  return n;
}

/**
 * Valor guardado en credenciales.clave cuando el alumno cambió su contraseña:
 * el admin ya no la conoce (y no se guarda la que eligió el alumno).
 */
export const CLAVE_CAMBIADA_POR_ALUMNO = "";
