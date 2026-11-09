// Crea o borra un alumno temporal para probar en el navegador.
// Uso: node --env-file=.env.local scripts/alumno-temporal.mjs crear|borrar
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const EMAIL = "zztemporal@alumnos.typelake.local";
const GRADO = "ZZ Prueba temporal";

if (process.argv[2] === "crear") {
  const { data: cfg } = await db.from("configuracion").select("anio_escolar").single();
  const { data: g } = await db.from("grados").insert({ nombre: GRADO, orden: 99 }).select("id").single();
  const { data: s } = await db.from("salones").insert({ grado_id: g.id, seccion: "Z", anio: cfg.anio_escolar }).select("id").single();
  const clave = "temporal" + Math.floor(Math.random() * 1e6);
  const { error } = await db.auth.admin.createUser({
    email: EMAIL, password: clave, email_confirm: true,
    app_metadata: { rol: "alumno", usuario: "zztemporal", nombres: "Alumno", apellidos: "Temporal", salon_id: s.id },
  });
  console.log(error ? "✘ " + error.message : `usuario: zztemporal\nclave: ${clave}`);
} else {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const u = data.users.find((x) => x.email === EMAIL);
  if (u) await db.auth.admin.deleteUser(u.id);
  const { data: g } = await db.from("grados").select("id").eq("nombre", GRADO).maybeSingle();
  if (g) {
    await db.from("salones").delete().eq("grado_id", g.id);
    await db.from("grados").delete().eq("id", g.id);
  }
  console.log("✔ alumno temporal eliminado");
}
