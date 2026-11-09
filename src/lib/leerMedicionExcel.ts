import * as XLSX from "xlsx";

/**
 * Lee un Excel de mediciones con el formato del colegio:
 *  - una hoja por salón (1ro, 2do, …)
 *  - una fila de encabezado con "Nombres" y columnas "WPM 1", "WPM 2", …
 *  - encima, celdas (combinadas) con el nombre de cada medición: "PRIMERA MEDICIÓN", …
 *  - nombres como "APELLIDOS, NOMBRES"
 *  - celdas con x, W, Justify o vacías = sin nota
 */

export interface GrupoMedicion {
  clave: string; // texto normalizado para emparejar entre hojas
  nombre: string; // "Primera medición"
  columnas: number[];
}

export interface AlumnoHoja {
  apellidos: string;
  nombres: string;
  valores: Record<number, number | null>; // columna → PPM
}

export interface HojaMedicion {
  hoja: string;
  gradoSugerido: string;
  grupos: GrupoMedicion[];
  alumnos: AlumnoHoja[];
}

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
  const t = String(v ?? "").trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

function separarNombre(completo: string) {
  const limpio = completo.replace(/\s+/g, " ").trim();
  const coma = limpio.indexOf(",");
  if (coma >= 0) return { apellidos: propio(limpio.slice(0, coma)), nombres: propio(limpio.slice(coma + 1)) };
  // Sin coma: se asume "APELLIDO1 APELLIDO2 NOMBRES"
  const partes = limpio.split(" ");
  return { apellidos: propio(partes.slice(0, 2).join(" ")), nombres: propio(partes.slice(2).join(" ")) };
}

export function sugerirGrado(hoja: string) {
  const n = hoja.match(/\d+/)?.[0];
  return n ? `${n}° de secundaria` : hoja;
}

export function leerLibroMediciones(libro: XLSX.WorkBook): HojaMedicion[] {
  const hojas: HojaMedicion[] = [];

  for (const nombreHoja of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombreHoja], { header: 1, defval: "", raw: true });

    // 1. Fila de encabezado: la que tiene "Nombres"
    let filaEnc = -1;
    let colNombre = -1;
    for (let r = 0; r < Math.min(filas.length, 30) && filaEnc < 0; r++) {
      const c = (filas[r] ?? []).findIndex((v) => ["nombres", "nombre", "apellidos y nombres", "nombres y apellidos"].includes(norm(v)));
      if (c >= 0) {
        filaEnc = r;
        colNombre = c;
      }
    }
    if (filaEnc < 0) continue;

    // 2. Columnas de PPM y su medición (buscando a la izquierda en las filas de arriba)
    const enc = filas[filaEnc] ?? [];
    const grupos: GrupoMedicion[] = [];
    enc.forEach((v, c) => {
      if (c <= colNombre || !/^(wpm|ppm)/.test(norm(v))) return;
      let etiqueta = "";
      for (let r = filaEnc - 1; r >= Math.max(0, filaEnc - 3) && !etiqueta; r--) {
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

    // 3. Alumnos (se detiene tras varias filas seguidas sin nombre)
    const alumnos: AlumnoHoja[] = [];
    let vacias = 0;
    for (let r = filaEnc + 1; r < filas.length && vacias < 5; r++) {
      const nombre = String(filas[r]?.[colNombre] ?? "").trim();
      if (!/[a-zA-ZÁÉÍÓÚÑáéíóúñ]/.test(nombre)) {
        vacias++;
        continue;
      }
      vacias = 0;
      const valores: Record<number, number | null> = {};
      for (const g of grupos) for (const c of g.columnas) valores[c] = leerNota(filas[r]?.[c]);
      alumnos.push({ ...separarNombre(nombre), valores });
    }

    hojas.push({ hoja: nombreHoja, gradoSugerido: sugerirGrado(nombreHoja), grupos, alumnos });
  }
  return hojas;
}
