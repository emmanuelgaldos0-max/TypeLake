// Descarga de la página los datos actuales (alumnos, contraseñas cifradas, récords y memes)
// y los deja en paquete/ para que viajen dentro del instalador.
// El PIN del profesor se lee de pin-profesor.txt; si no existe, se crea uno al azar.
import { randomInt } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { armarPaquete } from "../src/lib/armarPaquete";
import { EXT_PAQUETE } from "../src/lib/sinInternet";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secreto = process.env.SUPABASE_SECRET_KEY;
if (!url || !secreto) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (están en ../.env.local).");

const ARCHIVO_PIN = "pin-profesor.txt";
let pin = existsSync(ARCHIVO_PIN) ? readFileSync(ARCHIVO_PIN, "utf8").replace(/\D/g, "") : "";
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
console.log(`Paquete incluido en el instalador: ${r.alumnos} alumnos (${r.conRecord} con récord) y ${r.memes} memes.`);
