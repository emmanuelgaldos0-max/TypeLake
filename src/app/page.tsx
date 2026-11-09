import Link from "next/link";
import PracticaAlumno from "@/components/PracticaAlumno";
import { obtenerSesion } from "@/lib/supabase/server";

export default async function Inicio() {
  const sesion = await obtenerSesion();
  const esAlumno = sesion?.perfil.rol === "alumno";

  return (
    <main className="flex-1 px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">
          {esAlumno ? `¡Hola, ${sesion!.perfil.nombres.split(" ")[0]}!` : "Prueba de velocidad"}
        </h1>
        <p className="text-slate-600 mt-2">Escribe el texto lo más rápido y preciso que puedas durante 1 minuto.</p>
        {!sesion && (
          <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 inline-block px-3 py-1.5 rounded-lg">
            Estás practicando sin cuenta: tus resultados no se guardarán.{" "}
            <Link href="/login" className="underline font-medium">Ingresa</Link> para registrarlos.
          </p>
        )}
      </div>
      <PracticaAlumno guardar={esAlumno} />
    </main>
  );
}
