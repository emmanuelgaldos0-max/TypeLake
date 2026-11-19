// Descarga de la página los datos actuales (alumnos, códigos de salón, récords y memes)
// y los deja en paquete/ para que viajen dentro del instalador. Además deja en instalador/
// un Excel con los usuarios y el código de cada salón para entregar en clase.
// El PIN del profesor se lee de pin-profesor.txt; si no existe, se crea uno al azar.
import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { armarPaquete } from "../src/lib/armarPaquete";
import { EXT_PAQUETE } from "../src/lib/sinInternet";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secreto = process.env.SUPABASE_SECRET_KEY;
if (!url || !secreto) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (están en ../.env.local).");

const ARCHIVO_PIN = "pin-profesor.txt";
let pin = existsSync(ARCHIVO_PIN) ? (readFileSync(ARCHIVO_PIN, "utf8").split(/\r?\n/)[0] ?? "").replace(/\D/g, "") : "";
if (!/^\d{4,8}$/.test(pin)) {
  pin = String(randomInt(100000, 1000000));
  writeFileSync(ARCHIVO_PIN, `${pin}\r\n\r\nPIN del profesor para la app TypeLake sin internet.\r\nCámbialo aquí (4 a 8 números) y vuelve a generar el instalador si quieres otro.\r\n`);
  console.log(`PIN nuevo del profesor: ${pin} (guardado en escritorio/${ARCHIVO_PIN})`);
}

const db = createClient(url, secreto, { auth: { persistSession: false } });
const r = await armarPaquete(db, secreto, pin);

mkdirSync("paquete", { recursive: true });
for (const f of readdirSync("paquete")) if (f.endsWith(`.${EXT_PAQUETE}`)) rmSync(`paquete/${f}`);
writeFileSync(`paquete/TypeLake.${EXT_PAQUETE}`, r.contenido);
console.log(`Paquete incluido en el instalador: ${r.alumnos} alumnos (${r.conRecord} con récord), ${r.lista.length} salones y ${r.memes} memes.`);

// ── Excel de usuarios y códigos ──
const salones = [...r.lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
const libro = XLSX.utils.book_new();
const resumen = XLSX.utils.aoa_to_sheet([
  ["TypeLake sin internet · Ingreso: usuario + código del salón"],
  [],
  ["Salón", "Código del salón", "Alumnos"],
  ...salones.map((s) => [s.nombre, s.codigo, s.alumnos.length]),
  [],
  ["PIN del profesor", pin],
]);
resumen["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 10 }];
XLSX.utils.book_append_sheet(libro, resumen, "Códigos de salón");
for (const s of salones) {
  const hoja = XLSX.utils.aoa_to_sheet([
    [`${s.nombre} · Código del salón: ${s.codigo}`],
    [],
    ["Apellidos", "Nombres", "Usuario", "Código del salón"],
    ...s.alumnos.map((a) => [a.apellidos, a.nombres, a.usuario, s.codigo]),
  ]);
  hoja["!cols"] = [{ wch: 28 }, { wch: 28 }, { wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(libro, hoja, s.nombre.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Salón");
}
mkdirSync("instalador", { recursive: true });
const ARCHIVO_LISTA = "instalador/TypeLake-usuarios-y-codigos.xlsx";
writeFileSync(ARCHIVO_LISTA, XLSX.write(libro, { type: "buffer", bookType: "xlsx" }));
console.log(`Lista de usuarios y códigos: escritorio/${ARCHIVO_LISTA}`);
for (const s of salones) console.log(`  ${s.nombre.padEnd(14)} ${s.codigo}  (${s.alumnos.length} alumnos)`);
