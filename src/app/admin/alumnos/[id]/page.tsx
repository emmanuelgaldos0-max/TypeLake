import Link from "next/link";
import { notFound } from "next/navigation";
import TablaIntentos, { type FilaIntento } from "@/components/admin/TablaIntentos";
import GraficoProgreso, { type PuntoProgreso } from "@/components/progreso/GraficoProgreso";
import { traerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function FichaAlumno({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await crearClienteServidor();

  const { data: perfil } = await db
    .from("perfiles")
    .select("id, usuario, nombres, apellidos, activo, creado_en, salones(seccion, grados(nombre))")
    .eq("id", id)
    .eq("rol", "alumno")
    .maybeSingle();
  if (!perfil) notFound();

  const [intentos, { data: mediciones }] = await Promise.all([
    traerTodo((d, h) =>
      db
        .from("intentos")
        .select("id, ppm, precision_pct, referencia_ppm, estado, motivos, medicion_id, creado_en, errores_por_tecla")
        .eq("alumno_id", id)
        .order("creado_en")
        .range(d, h),
    ),
    db.from("mediciones").select("id, nombre"),
  ]);
  const nombreMedicion = new Map((mediciones ?? []).map((m) => [m.id as number, m.nombre as string]));

  const salonRaw = perfil.salones as unknown as { seccion: string; grados: { nombre: string } | null } | null;
  const salon = salonRaw ? `${salonRaw.grados?.nombre ?? ""} ${salonRaw.seccion}` : "Sin salón";

  const validos = intentos.filter((i) => i.estado === "valido" || i.estado === "aprobado");
  const ppms = validos.map((i) => Number(i.ppm));
  const precisiones = validos.filter((i) => i.precision_pct !== null).map((i) => Number(i.precision_pct));
  const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const enRevision = intentos.filter((i) => i.estado === "sospechoso").length;
  const mejorMedicion = Math.max(0, ...validos.filter((i) => i.medicion_id !== null).map((i) => Number(i.ppm)));

  const conteo: Record<string, number> = {};
  for (const i of intentos.slice(-30)) for (const [t, n] of Object.entries((i.errores_por_tecla ?? {}) as Record<string, number>)) conteo[t] = (conteo[t] ?? 0) + n;
  const teclas = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const puntos: PuntoProgreso[] = validos.slice(-60).map((i) => ({
    fecha: i.creado_en,
    ppm: Math.round(Number(i.ppm)),
    precision: i.precision_pct === null ? null : Number(i.precision_pct),
    medicion: i.medicion_id !== null,
  }));

  const filas: FilaIntento[] = [...intentos].reverse().map((i) => ({
    id: i.id,
    fecha: i.creado_en,
    ppm: Number(i.ppm),
    precision: i.precision_pct === null ? null : Number(i.precision_pct),
    referencia: i.referencia_ppm === null ? null : Number(i.referencia_ppm),
    estado: i.estado,
    motivos: i.motivos ?? [],
    medicion: i.medicion_id === null ? null : (nombreMedicion.get(i.medicion_id) ?? "Medición"),
  }));

  return (
    <div className="space-y-6 animate-aparecer">
      <div>
        <Link href="/admin/resultados" className="btn-enlace -ml-2 mb-2">
          ← Volver a resultados
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lago-600 text-lg font-bold text-white">
            {perfil.nombres.charAt(0)}
            {perfil.apellidos.charAt(0)}
          </span>
          <div className="mr-auto">
            <h1 className="titulo-pagina">
              {perfil.apellidos}, {perfil.nombres}
            </h1>
            <p className="subtitulo">
              {salon} · usuario <span className="font-mono">{perfil.usuario}</span>
              {!perfil.activo && " · cuenta desactivada"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Tarjeta titulo="Récord" valor={ppms.length ? Math.round(Math.max(...ppms)) : "—"} unidad="ppm" />
        <Tarjeta titulo="Mejor en mediciones" valor={mejorMedicion || "—"} unidad="ppm" />
        <Tarjeta titulo="Promedio" valor={media(ppms)?.toFixed(1) ?? "—"} unidad="ppm" />
        <Tarjeta titulo="Precisión promedio" valor={media(precisiones)?.toFixed(1) ?? "—"} unidad="%" />
        <Tarjeta titulo="Intentos" valor={intentos.length} nota={enRevision ? `${enRevision} en revisión` : undefined} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="tarjeta p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Evolución</h2>
          <p className="text-sm text-slate-500 mb-4">Palabras por minuto en sus pruebas válidas.</p>
          {puntos.length >= 2 ? (
            <GraficoProgreso puntos={puntos} />
          ) : (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-8 text-center">Necesita al menos 2 pruebas válidas.</p>
          )}
        </section>
        <section className="tarjeta p-6">
          <h2 className="text-lg font-bold text-slate-900">Teclas difíciles</h2>
          <p className="text-sm text-slate-500 mb-4">Errores en sus últimas 30 pruebas.</p>
          {teclas.length ? (
            <div className="flex flex-wrap gap-2">
              {teclas.map(([t, n]) => (
                <span key={t} className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-mono">
                  {t === " " ? "espacio" : t} <span className="text-rose-400 text-sm">×{n}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin errores registrados.</p>
          )}
        </section>
      </div>

      <section className="tarjeta p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Todos sus intentos</h2>
        <p className="text-sm text-slate-500 mb-4">
          &quot;Habitual&quot; es su velocidad de referencia al momento del intento. Puedes aprobar o rechazar cualquier intento.
        </p>
        <TablaIntentos filas={filas} vacio="Este alumno todavía no tiene intentos." />
      </section>
    </div>
  );
}

function Tarjeta({ titulo, valor, unidad, nota }: { titulo: string; valor: string | number; unidad?: string; nota?: string }) {
  return (
    <div className="tarjeta p-5">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div className="mt-1 text-3xl font-extrabold text-slate-900">
        {valor}
        {unidad && valor !== "—" && <span className="ml-1 text-base font-medium text-slate-500">{unidad}</span>}
      </div>
      {nota && <div className="text-xs text-amber-700 mt-0.5">{nota}</div>}
    </div>
  );
}
