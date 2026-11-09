// Genera supabase/seed.sql (admin inicial + banco de textos) y la sección de textos
// de la migración 5.
// Uso: node --experimental-strip-types scripts/generar-seed.ts
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { FRAGMENTOS } from "../src/data/textos.ts";

const ADMIN_INICIAL = "emmanuelgaldos0@gmail.com";

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;

const insertTextos = `insert into public.textos (tema, contenido) values
${FRAGMENTOS.map((f) => `  (${sql(f.tema)}, ${sql(f.texto)})`).join(",\n")};
`;

writeFileSync(
  new URL("../supabase/seed.sql", import.meta.url),
  `-- Datos iniciales de TypeLake (generado por scripts/generar-seed.ts).
-- Ejecutar en Supabase → SQL Editor DESPUÉS de las migraciones.

-- Administrador inicial (entra con Google). Agrega más correos aquí o desde el panel.
-- El banco de textos se carga en la migración 5.
insert into public.admins_permitidos (email) values (${sql(ADMIN_INICIAL)})
on conflict do nothing;
`,
  "utf8",
);

// Migración 5 = parte de esquema + textos corregidos
const parte = new URL("../supabase/migrations/_parte_05_esquema.sql", import.meta.url);
try {
  const esquema = readFileSync(parte, "utf8");
  writeFileSync(new URL("../supabase/migrations/20261109000005_sin_niveles_textos_corregidos.sql", import.meta.url), esquema + insertTextos, "utf8");
  rmSync(parte);
} catch {
  // la migración 5 ya fue generada
}

console.log(`seed.sql generado con ${FRAGMENTOS.length} textos`);
