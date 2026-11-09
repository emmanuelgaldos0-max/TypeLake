import { redirect } from "next/navigation";
import FormularioClave from "@/components/FormularioClave";
import MemesAlumno, { type MiMeme } from "@/components/memes/MemesAlumno";
import { criterioDeFila, type FilaMeme } from "@/lib/memes";
import { enlacesMemes, preferenciaMemes } from "@/lib/memesServidor";
import { crearClienteAdmin, obtenerSesion } from "@/lib/supabase/server";

export default async function PaginaCuenta() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol === "admin") redirect("/admin");
  const { perfil } = sesion;

  const [pref, { data: filas }] = await Promise.all([
    preferenciaMemes(sesion.user.id),
    crearClienteAdmin().from("memes").select("*").eq("subido_por", sesion.user.id).order("creado_en", { ascending: false }),
  ]);
  const propios = (filas ?? []) as FilaMeme[];
  const enlaces = await enlacesMemes(propios.map((m) => m.ruta));
  const mios: MiMeme[] = propios.map((m) => ({ id: m.id, url: enlaces[m.ruta] ?? null, estado: m.estado, criterio: criterioDeFila(m) }));

  return (
    <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="titulo-pagina">Mi cuenta</h1>
        <p className="subtitulo">
          {perfil.nombres} {perfil.apellidos} · usuario <b className="font-mono">{perfil.usuario}</b>
        </p>
      </div>
      <MemesAlumno activos={pref.activos} bloqueados={pref.bloqueados} mios={mios} />
      <FormularioClave />
    </main>
  );
}
