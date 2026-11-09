import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function PanelAdmin() {
  const db = await crearClienteServidor();
  const contar = (tabla: string) => db.from(tabla).select("*", { count: "exact", head: true });

  const resultados = await Promise.all([
    contar("perfiles").eq("rol", "alumno").eq("activo", true),
    contar("salones"),
    contar("intentos"),
    contar("intentos").eq("estado", "sospechoso"),
  ]);
  const [alumnos, salones, intentos, sospechosos] = resultados.map((r) => r.count ?? 0);

  const tarjetas = [
    { titulo: "Alumnos activos", valor: alumnos, href: "/admin/alumnos" },
    { titulo: "Salones", valor: salones, href: "/admin/alumnos" },
    { titulo: "Intentos registrados", valor: intentos },
    { titulo: "Intentos en revisión", valor: sospechosos, alerta: sospechosos > 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Panel de administración</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {tarjetas.map((t) => {
          const contenido = (
            <div className={`rounded-2xl border p-5 bg-white ${t.alerta ? "border-amber-300" : "border-slate-200"} ${t.href ? "hover:border-sky-400 transition" : ""}`}>
              <div className={`text-3xl font-bold tabular-nums ${t.alerta ? "text-amber-600" : "text-slate-800"}`}>{t.valor}</div>
              <div className="text-sm text-slate-500 mt-1">{t.titulo}</div>
            </div>
          );
          return t.href ? <Link key={t.titulo} href={t.href}>{contenido}</Link> : <div key={t.titulo}>{contenido}</div>;
        })}
      </div>
      <p className="text-slate-500 text-sm">
        Próximamente: dashboards por alumno, salón y grado; mediciones; fórmulas de promedio; revisión de intentos y exportación a Excel.
      </p>
    </div>
  );
}
