import AdministrarMemes, { type MemeAdmin } from "@/components/memes/AdministrarMemes";
import SubirMeme from "@/components/memes/SubirMeme";
import { criterioDeFila, type FilaMeme } from "@/lib/memes";
import { enlacesMemes, limpiarMemesHuerfanos } from "@/lib/memesServidor";
import { crearClienteAdmin } from "@/lib/supabase/server";

export default async function PaginaMemes() {
  // El layout de /admin ya exige ser admin
  const db = crearClienteAdmin();
  // Borra imágenes subidas que nunca se confirmaron como meme (abandonadas hace más de 30 min)
  const huerfanosBorrados = await limpiarMemesHuerfanos().catch(() => 0);
  const { data, error } = await db.from("memes").select("*").order("creado_en", { ascending: false });
  const filas = (data ?? []) as FilaMeme[];
  const autores = [...new Set(filas.map((m) => m.subido_por).filter((x): x is string => !!x))];
  const [enlaces, { data: perfiles }] = await Promise.all([
    enlacesMemes(filas.map((m) => m.ruta)),
    autores.length ? db.from("perfiles").select("id, rol, nombres, apellidos, usuario").in("id", autores) : Promise.resolve({ data: [] }),
  ]);
  const autor = new Map((perfiles ?? []).map((p) => [p.id as string, p]));

  const memes: MemeAdmin[] = filas.map((m) => {
    const p = m.subido_por ? autor.get(m.subido_por) : undefined;
    return {
      id: m.id,
      url: enlaces[m.ruta] ?? null,
      estado: m.estado,
      criterio: criterioDeFila(m),
      autor: !p ? "—" : p.rol === "admin" ? "Profesor" : `${p.apellidos}, ${p.nombres} (${p.usuario})`,
      creadoEn: m.creado_en,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="titulo-pagina">Memes</h1>
        <p className="subtitulo">
          Aparecen al terminar cada prueba según el resultado. Los que suben los alumnos esperan tu aprobación; aprobados, les salen a todos.
        </p>
      </div>
      {huerfanosBorrados > 0 && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          Se borraron {huerfanosBorrados} imagen(es) que se subieron pero nunca se confirmaron como meme.
        </p>
      )}
      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          Falta aplicar la migración 12 (memes) en Supabase: {error.message}
        </p>
      )}
      <section className="tarjeta p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Agregar un meme</h2>
        <SubirMeme esAdmin />
      </section>
      <AdministrarMemes memes={memes} />
    </div>
  );
}
