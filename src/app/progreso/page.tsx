import Link from "next/link";
import { redirect } from "next/navigation";
import GraficoProgreso, { type PuntoProgreso } from "@/components/progreso/GraficoProgreso";
import RankingAlumnos from "@/components/progreso/RankingAlumnos";
import PromedioSalones from "@/components/progreso/PromedioSalones";
import RetoProfesor from "@/components/RetoProfesor";
import { recordProfesorVisible } from "@/lib/profesor";
import { crearClienteServidor, obtenerSesion } from "@/lib/supabase/server";

interface FilaIntento {
  ppm: number;
  precision_pct: number | null; // null en notas importadas de Excel
  creado_en: string;
  estado: string;
  modo: string;
  errores_por_tecla: Record<string, number>;
}

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export default async function PaginaProgreso() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol === "admin") redirect("/admin");

  const db = await crearClienteServidor();
  const [{ data }, { data: formulas }, { data: cfg }, reto] = await Promise.all([
    db
      .from("intentos")
      .select("ppm, precision_pct, creado_en, estado, modo, errores_por_tecla")
      .order("creado_en", { ascending: true })
      .limit(500),
    db.from("formulas_promedio").select("id, nombre").eq("visible_alumnos", true).order("id"),
    // select("*") para no fallar si la migración 10 aún no se aplicó
    db.from("configuracion").select("*").single(),
    recordProfesorVisible(),
  ]);
  const verOtrosSalones = (cfg as { ver_otros_salones?: boolean } | null)?.ver_otros_salones !== false;
  let mejorColegio: number | null = null;
  if (!verOtrosSalones) {
    const { data: m } = await db.rpc("mejor_puntaje_colegio");
    mejorColegio = m === null || m === undefined ? null : Number(m);
  }

  const intentos = ((data ?? []) as FilaIntento[]).map((i) => ({
    ...i,
    ppm: Number(i.ppm),
    precision_pct: i.precision_pct === null ? null : Number(i.precision_pct),
  }));
  const validos = intentos.filter((i) => i.estado === "valido" || i.estado === "aprobado");
  const ultimos10 = validos.slice(-10);
  const enRevision = intentos.filter((i) => i.estado === "sospechoso").length;

  const record = validos.length ? Math.max(...validos.map((i) => i.ppm)) : null;
  const promedioPpm = promedio(ultimos10.map((i) => i.ppm));
  const promedioPrecision = promedio(
    validos
      .filter((i) => i.precision_pct !== null)
      .slice(-10)
      .map((i) => i.precision_pct!),
  );

  // Teclas con más errores en los últimos 30 intentos
  const conteo: Record<string, number> = {};
  for (const i of intentos.slice(-30)) {
    for (const [tecla, n] of Object.entries(i.errores_por_tecla ?? {})) conteo[tecla] = (conteo[tecla] ?? 0) + n;
  }
  const teclas = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxTecla = teclas[0]?.[1] ?? 1;

  const puntos: PuntoProgreso[] = validos.slice(-60).map((i) => ({
    fecha: i.creado_en,
    ppm: Math.round(i.ppm),
    precision: i.precision_pct,
    medicion: i.modo === "medicion",
  }));

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Mi progreso</h1>
          <p className="text-slate-500 text-sm">Así vas mejorando, {sesion.perfil.nombres.split(" ")[0]}.</p>
          {reto && <RetoProfesor record={reto} className="mt-3" />}
        </div>
        <Link href="/" className="btn btn-primario">
          Practicar ahora
        </Link>
      </div>

      {/* Indicadores */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tarjeta titulo="Tu récord" valor={record === null ? "—" : Math.round(record)} unidad="ppm" />
        <Tarjeta titulo="Promedio (últimos 10)" valor={promedioPpm === null ? "—" : Math.round(promedioPpm)} unidad="ppm" />
        <Tarjeta titulo="Precisión promedio" valor={promedioPrecision === null ? "—" : promedioPrecision.toFixed(1)} unidad="%" />
        <Tarjeta titulo="Pruebas realizadas" valor={intentos.length} nota={enRevision ? `${enRevision} en revisión` : undefined} />
      </section>

      {/* Evolución */}
      <section className="tarjeta p-6 animate-aparecer">
        <h2 className="font-semibold text-slate-800">Tu velocidad prueba a prueba</h2>
        <p className="text-sm text-slate-500 mb-4">Palabras por minuto en tus últimas {puntos.length} pruebas válidas.</p>
        {puntos.length >= 2 ? (
          <GraficoProgreso puntos={puntos} />
        ) : (
          <Vacio texto="Haz al menos 2 pruebas para ver tu evolución." />
        )}
      </section>

      {/* Teclas */}
      <section className="tarjeta p-6 animate-aparecer">
        <h2 className="font-semibold text-slate-800">Teclas que más se te complican</h2>
        <p className="text-sm text-slate-500 mb-4">Errores acumulados en tus últimas 30 pruebas. Practica estas letras con calma.</p>
        {teclas.length ? (
          <ul className="space-y-2">
            {teclas.map(([tecla, n]) => (
              <li key={tecla} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 font-mono text-slate-800 text-right">{tecla === " " ? "espacio" : tecla}</span>
                <span className="flex-1 h-4 bg-slate-100 rounded-sm overflow-hidden">
                  <span className="block h-full rounded-r bg-[#2a78d6]" style={{ width: `${(n / maxTecla) * 100}%` }} />
                </span>
                <span className="w-10 tabular-nums text-slate-600">{n}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio texto="¡Aún no hay errores registrados!" />
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <RankingAlumnos verOtrosSalones={verOtrosSalones} mejorColegio={mejorColegio} />
        <PromedioSalones formulas={formulas ?? []} miSalon={sesion.perfil.salon_id} />
      </div>
    </main>
  );
}

function Tarjeta({ titulo, valor, unidad, nota }: { titulo: string; valor: string | number; unidad?: string; nota?: string }) {
  return (
    <div className="tarjeta p-5">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div className="mt-1 text-3xl font-bold text-slate-800">
        {valor}
        {unidad && valor !== "—" && <span className="text-base font-medium text-slate-500 ml-1">{unidad}</span>}
      </div>
      {nota && <div className="text-xs text-amber-700 mt-1">{nota}</div>}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-6 text-center">{texto}</p>;
}
