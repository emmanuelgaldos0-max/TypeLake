// Crea o borra datos de demostración (salones "ZZ Demo") para probar los dashboards.
// Uso: node --env-file=.env.local scripts/datos-demo.mjs crear|borrar
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const GRADO = "ZZ Demo";
const DOMINIO = "alumnos.typelake.local";

async function borrar() {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((x) => x.email?.startsWith("zzdemo"))) await db.auth.admin.deleteUser(u.id);
  const { data: g } = await db.from("grados").select("id").eq("nombre", GRADO).maybeSingle();
  if (g) {
    await db.from("salones").delete().eq("grado_id", g.id);
    await db.from("grados").delete().eq("id", g.id);
  }
  console.log("✔ datos demo eliminados");
}

async function crear() {
  await borrar();
  const { data: cfg } = await db.from("configuracion").select("anio_escolar").single();
  const { data: g } = await db.from("grados").insert({ nombre: GRADO, orden: 98 }).select("id").single();
  const { data: salones } = await db.from("salones").insert([
    { grado_id: g.id, seccion: "A", anio: cfg.anio_escolar },
    { grado_id: g.id, seccion: "B", anio: cfg.anio_escolar },
  ]).select("id, seccion");

  const alumnos = [
    ["Lucía", "Quispe Mamani", "A", 22], ["Mateo", "Pérez García", "A", 35], ["Valeria", "Rojas Díaz", "A", 28], ["Diego", "Torres Vega", "A", 18],
    ["Camila", "Flores Ríos", "B", 40], ["Santiago", "Huamán Cruz", "B", 25], ["Sofía", "Chávez León", "B", 31], ["Thiago", "Mendoza Soto", "B", 15],
  ];
  let claveDemo = "";
  for (const [i, [nombres, apellidos, sec, base]] of alumnos.entries()) {
    const salon = salones.find((s) => s.seccion === sec);
    const usuario = `zzdemo${i + 1}`;
    const clave = "demo" + Math.floor(Math.random() * 1e6);
    if (i === 0) claveDemo = clave;
    const { data: u, error } = await db.auth.admin.createUser({
      email: `${usuario}@${DOMINIO}`, password: clave, email_confirm: true,
      app_metadata: { rol: "alumno", usuario, nombres, apellidos, salon_id: salon.id },
    });
    if (error) throw new Error(error.message);
    // 12 intentos con mejora gradual y algo de ruido
    const filas = Array.from({ length: 12 }, (_, k) => {
      const ppm = Math.max(5, Math.round(base + k * 1.2 + (Math.random() * 6 - 3)));
      const correctos = ppm * 5;
      const errores = Math.floor(Math.random() * 8);
      return {
        alumno_id: u.user.id, salon_id: salon.id, modo: "practica", duracion_seg: 60,
        ppm, ppm_bruta: ppm, precision_pct: Math.round(((correctos) / (correctos + errores)) * 1000) / 10,
        correctos, incorrectos: 0, pulsaciones: correctos + errores, errores,
        errores_por_tecla: { "á": Math.floor(Math.random() * 3), ñ: Math.floor(Math.random() * 2), ",": Math.floor(Math.random() * 2), "¿": Math.floor(Math.random() * 2) },
        estado: "valido", creado_en: new Date(Date.now() - (12 - k) * 86400000).toISOString(),
      };
    });
    const { error: e2 } = await db.from("intentos").insert(filas);
    if (e2) throw new Error(e2.message);
  }
  console.log(`✔ 8 alumnos demo con 12 intentos cada uno\nusuario: zzdemo1\nclave: ${claveDemo}`);
}

// Fórmula de práctica visible (migración 6)
const { data: f } = await db.from("formulas_promedio").select("id").eq("nombre", "Promedio de práctica").maybeSingle();
if (!f) {
  await db.from("formulas_promedio").insert({ nombre: "Promedio de práctica", tipo: "general", fuente: "todo", sin_intentos: "ignorar", visible_alumnos: true });
  console.log("✔ fórmula 'Promedio de práctica' creada");
}

if (process.argv[2] === "crear") await crear();
else await borrar();
