// Genera supabase/seed.sql con el banco de textos y el administrador inicial.
// Uso: node --experimental-strip-types scripts/generar-seed.ts
import { writeFileSync } from "node:fs";
import { FRAGMENTOS } from "../src/data/textos.ts";

const ADMIN_INICIAL = "emmanuelgaldos0@gmail.com";

const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;

const filas = FRAGMENTOS.map((f) => `  (${f.nivel}, ${sql(f.tema)}, ${sql(f.texto)})`).join(",\n");

const contenido = `-- Datos iniciales de TypeLake (generado por scripts/generar-seed.ts).
-- Ejecutar en Supabase → SQL Editor DESPUÉS de la migración del esquema.

-- Administrador inicial (entra con Google). Agrega más correos aquí o desde el panel.
insert into public.admins_permitidos (email) values (${sql(ADMIN_INICIAL)})
on conflict do nothing;

-- Banco de textos (${FRAGMENTOS.length} fragmentos)
insert into public.textos (nivel, tema, contenido) values
${filas};
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), contenido, "utf8");
console.log(`seed.sql generado con ${FRAGMENTOS.length} textos`);
