// Comprueba que .env.local está bien configurado (no muestra las claves).
// Uso: node --env-file=.env.local scripts/verificar-conexion.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publica = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secreta = process.env.SUPABASE_SECRET_KEY;

for (const [nombre, valor] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publica, SUPABASE_SECRET_KEY: secreta })) {
  console.log(`${valor ? "✔" : "✘"} ${nombre} ${valor ? "presente" : "FALTA"}`);
}
if (!url || !publica || !secreta) process.exit(1);
if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)) console.log("⚠ La URL no tiene el formato https://xxxx.supabase.co");

const anon = createClient(url, publica);
const { count, error } = await anon.from("textos").select("*", { count: "exact", head: true });
console.log(error ? `✘ Clave pública: ${error.message}` : `✔ Clave pública funciona (${count} textos visibles)`);

const admin = createClient(url, secreta, { auth: { persistSession: false } });
const r1 = await admin.from("admins_permitidos").select("email");
console.log(r1.error ? `✘ Clave secreta: ${r1.error.message}` : `✔ Clave secreta funciona (${r1.data.length} admin(s) autorizados)`);
const r2 = await admin.auth.admin.listUsers({ perPage: 1 });
console.log(r2.error ? `✘ Auth admin: ${r2.error.message}` : "✔ Puede administrar usuarios");
