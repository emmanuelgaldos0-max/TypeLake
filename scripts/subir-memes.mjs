// Sube una carpeta de memes a TypeLake como aprobados (subidos por el administrador).
//
// La carpeta debe tener las imágenes y un memes.json con el criterio de cada una:
//   [{ "archivo": "record-stonks.jpg", "criterio": "record", "categoria": "nuevo_record" },
//    { "archivo": "ppm-60.png", "criterio": "ppm", "ppmMin": 60, "ppmMax": null }]
//
// Uso:  node --env-file=.env.local scripts/subir-memes.mjs <carpeta>
// Se puede repetir sin duplicar: los archivos ya subidos se saltan.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const carpeta = process.argv[2];
if (!carpeta) throw new Error("Uso: node --env-file=.env.local scripts/subir-memes.mjs <carpeta>");
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: clave } = process.env;
if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");

const db = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
const TIPO = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

// Límite del bucket a 5 MB (igual que la migración 13), por si aún no se aplicó
const { error: errBucket } = await db.storage.updateBucket("memes", {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: Object.values(TIPO).filter((v, i, a) => a.indexOf(v) === i),
});
if (errBucket) throw new Error(`Bucket "memes": ${errBucket.message} (¿aplicaste la migración 12?)`);

const { data: admin, error: errAdmin } = await db.from("perfiles").select("id").eq("rol", "admin").order("creado_en").limit(1).single();
if (errAdmin) throw new Error(`No encontré un administrador: ${errAdmin.message}`);

const lista = JSON.parse(readFileSync(join(carpeta, "memes.json"), "utf8"));
let subidos = 0, saltados = 0;
for (const m of lista) {
  const ext = m.archivo.split(".").pop().toLowerCase();
  const ruta = `${admin.id}/inicial/${m.archivo}`;
  const { data: existe } = await db.from("memes").select("id").eq("ruta", ruta).maybeSingle();
  if (existe) {
    saltados++;
    continue;
  }
  const { error: errSubida } = await db.storage
    .from("memes")
    .upload(ruta, readFileSync(join(carpeta, m.archivo)), { contentType: TIPO[ext], upsert: true });
  if (errSubida) throw new Error(`${m.archivo}: ${errSubida.message}`);
  const fila =
    m.criterio === "record"
      ? { criterio: "record", categoria: m.categoria, ppm_min: null, ppm_max: null }
      : { criterio: "ppm", categoria: null, ppm_min: m.ppmMin ?? null, ppm_max: m.ppmMax ?? null };
  const { error } = await db.from("memes").insert({ ruta, ...fila, estado: "aprobado", subido_por: admin.id });
  if (error) throw new Error(`${m.archivo}: ${error.message}`);
  subidos++;
  console.log("✓", m.archivo);
}
console.log(`\nListo: ${subidos} subidos, ${saltados} ya estaban.`);
