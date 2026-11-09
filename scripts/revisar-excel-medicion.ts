// Muestra cómo leería el importador un Excel de mediciones (sin subir nada).
// Uso: node --experimental-strip-types scripts/revisar-excel-medicion.ts "ruta\al\archivo.xlsx"
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { leerLibroMediciones } from "../src/lib/leerMedicionExcel.ts";

const ruta = process.argv[2];
if (!ruta) throw new Error("Indica la ruta del Excel");
const hojas = leerLibroMediciones(XLSX.read(readFileSync(ruta)));

for (const h of hojas) {
  const completos = h.alumnos.filter((a) => !a.incompleto);
  console.log(`\nHoja "${h.hoja}" → ${h.gradoSugerido}: ${h.alumnos.length} alumnos (${h.alumnos.length - completos.length} con nombre incompleto)`);
  for (const g of h.grupos) {
    const conNota = completos.filter((a) => g.columnas.some((c) => a.valores[c] !== null));
    const notas = conNota.flatMap((a) => g.columnas.map((c) => a.valores[c]).filter((v): v is number => v !== null));
    console.log(
      `  ${g.nombre}: ${conNota.length} con nota, ${notas.length} intentos` +
        (notas.length ? `, min ${Math.min(...notas)}, máx ${Math.max(...notas)}` : ""),
    );
  }
  const ej = completos[0];
  if (ej) console.log(`  ejemplo: "${ej.original}" → apellidos "${ej.apellidos}", nombres "${ej.nombres}"`);
}
