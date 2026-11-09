// Prueba de punta a punta con un alumno temporal; borra todo al terminar.
// Uso: node --env-file=.env.local scripts/prueba-alumno.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const alumno = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const { data: cfg } = await admin.from("configuracion").select("anio_escolar").single();
const { data: grado } = await admin.from("grados").insert({ nombre: "ZZ Prueba temporal", orden: 99 }).select("id").single();
const { data: salon } = await admin.from("salones").insert({ grado_id: grado.id, seccion: "Z", anio: cfg.anio_escolar }).select("id").single();
let userId;

try {
  const email = "zzprueba@alumnos.typelake.local";
  const clave = "prueba" + Math.floor(Math.random() * 1e6);
  const { data: creado, error: e1 } = await admin.auth.admin.createUser({
    email, password: clave, email_confirm: true,
    app_metadata: { rol: "alumno", usuario: "zzprueba", nombres: "Alumno", apellidos: "De Prueba", salon_id: salon.id },
  });
  if (e1) throw new Error("crear usuario: " + e1.message);
  userId = creado.user.id;
  console.log("✔ Alumno creado");

  const { data: perfil } = await admin.from("perfiles").select("rol, usuario, salon_id").eq("id", userId).single();
  console.log("✔ Perfil creado por el trigger:", perfil);

  const { error: e2 } = await alumno.auth.signInWithPassword({ email, password: clave });
  if (e2) throw new Error("login: " + e2.message);
  console.log("✔ Inicio de sesión con usuario y contraseña");

  const { data: r, error: e3 } = await alumno.rpc("registrar_intento", {
    p: { nivel: 1, duracion_seg: 60, correctos: 150, incorrectos: 3, pulsaciones: 160, errores: 6, errores_por_tecla: { "á": 2 }, senales: { variacionRitmo: 0.6 } },
  });
  if (e3) throw new Error("registrar_intento: " + e3.message);
  console.log("✔ Intento registrado:", r);

  const { data: ranking, error: e4 } = await alumno.rpc("ranking_alumnos", { p_alcance: "salon" });
  console.log(e4 ? "✘ ranking: " + e4.message : "✔ Ranking del salón: " + JSON.stringify(ranking));

  const { count } = await alumno.from("perfiles").select("*", { count: "exact", head: true });
  console.log(`✔ RLS: el alumno ve ${count} perfil(es) (debe ser 1)`);

  const { error: e5 } = await alumno.auth.signUp({ email: "intruso" + Date.now() + "@example.com", password: "intruso123456" });
  console.log(e5 ? "✔ Registro libre bloqueado" : "✘ ¡Alguien pudo registrarse solo!");
} catch (e) {
  console.log("✘", e.message);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
  await admin.from("salones").delete().eq("id", salon.id);
  await admin.from("grados").delete().eq("id", grado.id);
  console.log("✔ Datos de prueba eliminados");
}
