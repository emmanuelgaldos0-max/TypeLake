import Link from "next/link";
import { crearClienteServidor, obtenerSesion } from "@/lib/supabase/server";

const ICONOS = {
  alumnos: "M16 11a4 4 0 1 0-8 0M4 20a8 8 0 0 1 16 0",
  salones: "M3 21V8l9-5 9 5v13M9 21v-6h6v6",
  intentos: "M4 19V5M4 19h16M8 15l3-4 3 2 5-6",
  revision: "M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};

function Icono({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default async function PanelAdmin() {
  const db = await crearClienteServidor();
  const sesion = await obtenerSesion();
  const contar = (tabla: string) => db.from(tabla).select("*", { count: "exact", head: true });

  const resultados = await Promise.all([
    contar("perfiles").eq("rol", "alumno").eq("activo", true),
    contar("salones"),
    contar("intentos"),
    contar("intentos").eq("estado", "sospechoso"),
  ]);
  const [alumnos, salones, intentos, sospechosos] = resultados.map((r) => r.count ?? 0);

  const tarjetas = [
    { titulo: "Alumnos activos", valor: alumnos, href: "/admin/alumnos", icono: ICONOS.alumnos, color: "bg-lago-50 text-lago-600" },
    { titulo: "Salones", valor: salones, href: "/admin/alumnos", icono: ICONOS.salones, color: "bg-violet-50 text-violet-600" },
    { titulo: "Intentos registrados", valor: intentos, href: "/admin/mediciones", icono: ICONOS.intentos, color: "bg-emerald-50 text-emerald-600" },
    {
      titulo: "Intentos en revisión",
      valor: sospechosos,
      icono: ICONOS.revision,
      color: sospechosos > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500",
    },
  ];

  const accesos = [
    { href: "/admin/alumnos", titulo: "Alumnos y credenciales", texto: "Importa alumnos, descarga usuarios y contraseñas, restablece claves." },
    { href: "/admin/mediciones", titulo: "Mediciones", texto: "Importa los resultados de las mediciones tomadas en el colegio." },
    { href: "/", titulo: "Probar la prueba", texto: "Haz una prueba de 1 minuto como la verán los alumnos." },
  ];

  return (
    <div className="space-y-8 animate-aparecer">
      <div>
        <h1 className="titulo-pagina">Hola, {sesion?.perfil.nombres.split(" ")[0] ?? "admin"} 👋</h1>
        <p className="subtitulo">Este es el resumen del concurso de mecanografía.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tarjetas.map((t) => {
          const contenido = (
            <div className={`tarjeta p-5 h-full transition ${t.href ? "hover:-translate-y-0.5 hover:shadow-lg" : ""}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${t.color}`}>
                <Icono d={t.icono} className="h-5 w-5" />
              </span>
              <div className="mt-4 text-3xl font-extrabold tabular-nums text-slate-900">{t.valor}</div>
              <div className="text-sm text-slate-500 mt-0.5">{t.titulo}</div>
            </div>
          );
          return t.href ? (
            <Link key={t.titulo} href={t.href}>
              {contenido}
            </Link>
          ) : (
            <div key={t.titulo}>{contenido}</div>
          );
        })}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Accesos rápidos</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {accesos.map((a) => (
            <Link key={a.href + a.titulo} href={a.href} className="tarjeta p-5 group transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{a.titulo}</span>
                <span className="text-lago-600 transition group-hover:translate-x-1">→</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{a.texto}</p>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-400">
        Próximamente: dashboards por alumno, salón y grado; mediciones en vivo con código; fórmulas de promedio; revisión de intentos y exportación a Excel.
      </p>
    </div>
  );
}
