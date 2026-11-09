import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";

const MAX_ALUMNOS = 60;

function hace(fecha: string): string {
  const seg = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 1000));
  if (seg < 60) return "hace un momento";
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export default async function PaginaRecientes() {
  // El layout de /admin ya exige ser admin
  const db = await crearClienteServidor();
  const { data: intentos } = await db.from("intentos").select("alumno_id, creado_en").order("creado_en", { ascending: false }).limit(1000);

  // Un alumno por fila, con la hora de su intento más reciente
  const ultimo = new Map<string, string>();
  for (const i of intentos ?? []) if (!ultimo.has(i.alumno_id)) ultimo.set(i.alumno_id, i.creado_en);
  const ids = [...ultimo.keys()].slice(0, MAX_ALUMNOS);

  const { data: perfiles } = ids.length
    ? await db.from("perfiles").select("id, nombres, apellidos").in("id", ids)
    : { data: [] as { id: string; nombres: string; apellidos: string }[] };
  const nombre = new Map((perfiles ?? []).map((p) => [p.id as string, `${p.apellidos}, ${p.nombres}`]));

  return (
    <div className="space-y-6 animate-aparecer">
      <div>
        <h1 className="titulo-pagina">Intentos recientes</h1>
        <p className="subtitulo">Alumnos que hicieron una prueba hace poco, del más reciente al más antiguo. Entra a cada uno para ver sus intentos.</p>
      </div>

      <section className="tarjeta p-2 sm:p-3">
        {ids.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Todavía no hay intentos.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ids.map((id) => (
              <li key={id}>
                <Link
                  href={`/admin/alumnos/${id}`}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900 mr-auto">{nombre.get(id) ?? "Alumno"}</span>
                  <span className="text-xs text-slate-400 tabular-nums">{hace(ultimo.get(id)!)}</span>
                  <span className="text-lago-600 transition group-hover:translate-x-1">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
