import * as XLSX from "xlsx";

/**
 * Lee un Excel de mediciones con el formato del colegio:
 *  - una hoja por salón (1ro, 2do, …)
 *  - una fila de encabezado con "Nombres" y columnas "WPM 1", "WPM 2", …
 *  - encima, celdas (combinadas) con el nombre de cada medición: "PRIMERA MEDICIÓN", …
 *  - nombres como "APELLIDOS, NOMBRES"
 *  - celda vacía = no se le evaluó
 *  - celda con x, W, Justify u otra marca = se le intentó evaluar pero decidió no dar
 *    su evaluación: no es un puntaje, pero cuenta como evaluado
 *  - celda con FALTA, Ausente o similar = no vino: igual que vacía (no se le evaluó)
 */

export interface GrupoMedicion {
  clave: string; // texto normalizado para emparejar entre hojas
  nombre: string; // "Primera medición"
  columnas: number[];
}

export interface AlumnoHoja {
  apellidos: string;
  nombres: string;
  original: string; // como estaba escrito en el Excel
  incompleto: boolean; // sin apellidos: no se puede crear una cuenta confiable
  valores: Record<number, number | null>; // columna → PPM
  marcas: Record<number, string>; // columna → marca sin nota ("x", "Justify"…)
}

export interface HojaMedicion {
  hoja: string;
  gradoSugerido: string;
  grupos: GrupoMedicion[];
  alumnos: AlumnoHoja[];
}

/** Marcas que indican que el alumno no estuvo: no cuentan como evaluado. */
const esAusencia = (v: string) => /^(falt|ausen|no vino|no asisti|inasist)/.test(norm(v));

const esWpm = (v: unknown) => /^(wpm|ppm)/.test(norm(v));
const ENCABEZADOS_NOMBRE = ["nombres", "nombre", "apellidos y nombres", "nombres y apellidos", "alumno", "alumnos", "estudiante"];

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function frase(texto: string) {
  const t = texto.trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
  return t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
}

function propio(texto: string) {
  return texto
    .trim()
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .map((p, i) => (i > 0 && ["de", "del", "la", "las", "los", "y"].includes(p) ? p : p.charAt(0).toLocaleUpperCase("es") + p.slice(1)))
    .join(" ");
}

export function leerNota(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // Quita espacios y tildes/apóstrofos sueltos ("´6.6" → 6.6); acepta coma decimal
  const t = String(v ?? "").replace(/[\s´'`’]/g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

function separarNombre(completo: string): Pick<AlumnoHoja, "apellidos" | "nombres" | "incompleto"> {
  // Quita numeración al inicio: "1. Aldair", "12) Pérez…"
  const limpio = completo.replace(/^\s*\d+\s*[.)\-–]?\s*/, "").replace(/\s+/g, " ").trim();
  const coma = limpio.indexOf(",");
  if (coma >= 0) {
    const apellidos = propio(limpio.slice(0, coma));
    const nombres = propio(limpio.slice(coma + 1));
    return { apellidos, nombres, incompleto: !apellidos || !nombres };
  }
  // Sin coma: se asume "APELLIDO1 APELLIDO2 NOMBRES"; con menos de 3 palabras no se puede saber
  const partes = limpio.split(" ");
  if (partes.length < 3) return { apellidos: "", nombres: propio(limpio), incompleto: true };
  return { apellidos: propio(partes.slice(0, 2).join(" ")), nombres: propio(partes.slice(2).join(" ")), incompleto: false };
}

export function sugerirGrado(hoja: string) {
  const n = hoja.match(/\d+/)?.[0];
  return n ? `${n}° de secundaria` : hoja;
}

export function leerLibroMediciones(libro: XLSX.WorkBook): HojaMedicion[] {
  const hojas: HojaMedicion[] = [];

  for (const nombreHoja of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombreHoja], { header: 1, defval: "", raw: true });

    // 1. Fila con las columnas "WPM 1", "WPM 2"…
    let filaWpm = -1;
    for (let r = 0; r < Math.min(filas.length, 30) && filaWpm < 0; r++) {
      if ((filas[r] ?? []).some(esWpm)) filaWpm = r;
    }
    if (filaWpm < 0) continue;
    const enc = filas[filaWpm] ?? [];
    const primeraWpm = enc.findIndex(esWpm);

    // 2. Columna de nombres: el encabezado "Nombres" (en esa fila o en las de arriba)…
    let colNombre = -1;
    for (let r = filaWpm; r >= Math.max(0, filaWpm - 3) && colNombre < 0; r--) {
      colNombre = (filas[r] ?? []).findIndex((v, c) => c < primeraWpm && ENCABEZADOS_NOMBRE.includes(norm(v)));
    }
    // …o, si no hay encabezado, la columna con texto más cercana a la izquierda de los WPM
    if (colNombre < 0) {
      for (let c = primeraWpm - 1; c >= 0 && colNombre < 0; c--) {
        const conTexto = filas.slice(filaWpm + 1, filaWpm + 15).filter((f) => /[a-zA-ZÁÉÍÓÚÑáéíóúñ]/.test(String(f?.[c] ?? ""))).length;
        if (conTexto >= 3) colNombre = c;
      }
    }
    if (colNombre < 0) continue;

    // 3. Columnas de PPM y su medición (buscando a la izquierda en las filas de arriba)
    const grupos: GrupoMedicion[] = [];
    enc.forEach((v, c) => {
      if (c <= colNombre || !esWpm(v)) return;
      let etiqueta = "";
      for (let r = filaWpm - 1; r >= Math.max(0, filaWpm - 3) && !etiqueta; r--) {
        for (let k = c; k > colNombre; k--) {
          const t = String(filas[r]?.[k] ?? "").trim();
          if (t) {
            etiqueta = t;
            break;
          }
        }
      }
      etiqueta ||= "Medición";
      const clave = norm(etiqueta);
      let g = grupos.find((x) => x.clave === clave);
      if (!g) grupos.push((g = { clave, nombre: frase(etiqueta), columnas: [] }));
      g.columnas.push(c);
    });
    if (!grupos.length) continue;

    // 4. Alumnos (se detiene tras varias filas seguidas sin nombre)
    const alumnos: AlumnoHoja[] = [];
    let vacias = 0;
    for (let r = filaWpm + 1; r < filas.length && vacias < 5; r++) {
      const nombre = String(filas[r]?.[colNombre] ?? "").trim();
      if (!/[a-zA-ZÁÉÍÓÚÑáéíóúñ]/.test(nombre)) {
        vacias++;
        continue;
      }
      vacias = 0;
      const valores: Record<number, number | null> = {};
      const marcas: Record<number, string> = {};
      for (const g of grupos)
        for (const c of g.columnas) {
          valores[c] = leerNota(filas[r]?.[c]);
          const texto = String(filas[r]?.[c] ?? "").trim();
          if (valores[c] === null && texto && !esAusencia(texto)) marcas[c] = texto;
        }
      alumnos.push({ ...separarNombre(nombre), original: nombre, valores, marcas });
    }

    hojas.push({ hoja: nombreHoja, gradoSugerido: sugerirGrado(nombreHoja), grupos, alumnos });
  }
  return hojas;
}
