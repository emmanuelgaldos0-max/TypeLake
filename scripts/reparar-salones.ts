// Reparación única: la primera importación puso a todos los alumnos en un solo salón
// (el nombre del grado perdía los números al compararse). Este script lee el mismo Excel,
// crea los salones correctos y mueve a cada alumno (y sus intentos) a su salón.
// Uso:  node --env-file=.env.local --experimental-strip-types scripts/reparar-salones.ts "archivo.xlsx"          (simulación)
//       node --env-file=.env.local --experimental-strip-types scripts/reparar-salones.ts "archivo.xlsx" --aplicar
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { leerLibroMediciones } from "../src/lib/leerMedicionExcel.ts";

const [ruta, bandera] = process.argv.slice(2);
const aplicar = bandera === "--aplicar";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const claveGrado = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ordenDeGrado = (n: string) => (/secundaria/i.test(n) ? 20 : /primaria/i.test(n) ? 10 : 0) + Number(n.match(/\d+/)?.[0] ?? 0);

const hojas = leerLibroMediciones(XLSX.read(readFileSync(ruta)));
const { data: cfg } = await db.from("configuracion").select("anio_escolar").single();
const { data: grados } = await db.from("grados").select("id, nombre");
const { data: salones } = await db.from("salones").select("id, grado_id, seccion").eq("anio", cfg!.anio_escolar);
const { data: perfiles } = await db.from("perfiles").select("id, nombres, apellidos, salon_id").eq("rol", "alumno");

const porNombre = new Map<string, { id: string; salon_id: number }[]>();
for (const p of perfiles ?? []) {
  const k = `${normalizar(p.nombres)}|${normalizar(p.apellidos)}`;
  porNombre.set(k, [...(porNombre.get(k) ?? []), p]);
}

async function salonPara(grado: string) {
  let g = (grados ?? []).find((x) => claveGrado(x.nombre) === claveGrado(grado));
  if (!g) {
    if (!aplicar) return { id: -1, nuevo: true };
    const { data, error } = await db.from("grados").insert({ nombre: grado, orden: ordenDeGrado(grado) }).select("id, nombre").single();
    if (error) throw error;
    grados!.push(data);
    g = data;
  }
  let s = (salones ?? []).find((x) => x.grado_id === g!.id && x.seccion === "A");
  if (!s) {
    if (!aplicar) return { id: -1, nuevo: true };
    const { data, error } = await db.from("salones").insert({ grado_id: g.id, seccion: "A", anio: cfg!.anio_escolar }).select("id, grado_id, seccion").single();
    if (error) throw error;
    salones!.push(data);
    s = data;
  }
  return { id: s.id as number, nuevo: false };
}

let movidos = 0;
const problemas: string[] = [];
for (const h of hojas) {
  const salon = await salonPara(h.gradoSugerido);
  let enHoja = 0;
  for (const a of h.alumnos.filter((x) => !x.incompleto)) {
    const coincidencias = porNombre.get(`${normalizar(a.nombres)}|${normalizar(a.apellidos)}`) ?? [];
    if (coincidencias.length !== 1) {
      problemas.push(`${h.hoja}: "${a.original}" → ${coincidencias.length} cuentas encontradas`);
      continue;
    }
    const p = coincidencias[0];
    enHoja++;
    if (p.salon_id === salon.id) continue;
    if (aplicar) {
      const r1 = await db.from("perfiles").update({ salon_id: salon.id }).eq("id", p.id);
      const r2 = await db.from("intentos").update({ salon_id: salon.id }).eq("alumno_id", p.id);
      if (r1.error || r2.error) throw r1.error ?? r2.error;
    }
    movidos++;
  }
  console.log(`${h.hoja} → ${h.gradoSugerido} A${salon.nuevo ? " (se creará)" : ` (salón ${salon.id})`}: ${enHoja} alumnos`);
}

console.log(`\n${aplicar ? "✔ Movidos" : "Se moverían"}: ${movidos} alumnos`);
if (problemas.length) console.log("⚠ Sin emparejar:\n  " + problemas.join("\n  "));
if (!aplicar) console.log("\n(Simulación: no se cambió nada. Añade --aplicar para ejecutar.)");
