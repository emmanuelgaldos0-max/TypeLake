// Prueba el lector de Excel de mediciones con un archivo que imita el formato del colegio.
// Uso: node --experimental-strip-types scripts/probar-lector-mediciones.ts
import * as XLSX from "xlsx";
import { leerLibroMediciones } from "../src/lib/leerMedicionExcel.ts";

const libro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([["nada aquí"]]), "Sheet6");

const filas: unknown[][] = [
  [],
  ["", "", "PRIMERA MEDICIÓN", "", "SEGUNDA MEDICIÓN", ""],
  ["", "Nombres", "WPM 1", "WPM 2", "WPM 1", "WPM 2"],
  [1, "ACHAHUE LLANLLAYA, GLORIA SUGEY", 2, 6, "", ""],
  [2, "CARCAUSTO ALMIRON, CRISTEL YASSURI", 8, 10.8, "", ""],
  [3, "CORREA MACHACA, LIONEL ALESSANDRO", "x", "x", "", ""],
  [4, "ESPINEL HUARCA, JOSUE LIONEL", "Justify", "Justify", "", ""],
  [5, "LUNA SARMIENTO, EMERSON SANTHIAGO", "W", "W", "", ""],
  [6, "NUÑEZ GUZMAN, NAYSHA SHARITH", 12, "", "", ""],
  [7, "QUISPE BELLIDO, YAMILA LEILANY", "", "", "", ""],
  [8, "DIAZ FERNANDEZ, JARED SANTIAGO", "13.4", "15,6", "", ""],
];
const hoja = XLSX.utils.aoa_to_sheet(filas);
hoja["!merges"] = [XLSX.utils.decode_range("C2:D2"), XLSX.utils.decode_range("E2:F2")];
XLSX.utils.book_append_sheet(libro, hoja, "1ro");

// Ida y vuelta por el formato binario, como un archivo real
const leido = XLSX.read(XLSX.write(libro, { type: "buffer", bookType: "xlsx" }));
const resultado = leerLibroMediciones(leido);

for (const h of resultado) {
  console.log(`Hoja "${h.hoja}" → grado sugerido "${h.gradoSugerido}"`);
  console.log("  mediciones:", h.grupos.map((g) => `${g.nombre} [cols ${g.columnas.join(",")}]`).join(" | "));
  const primera = h.grupos[0];
  for (const a of h.alumnos) {
    const notas = primera.columnas.map((c) => a.valores[c]);
    console.log(`  ${a.apellidos}, ${a.nombres}: ${JSON.stringify(notas)}`);
  }
}
console.log(resultado.length === 1 ? "✔ Sheet6 ignorada" : "✘ hojas inesperadas");
