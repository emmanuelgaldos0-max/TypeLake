import Link from "next/link";
import PracticaAlumno from "@/components/PracticaAlumno";
import { obtenerSesion } from "@/lib/supabase/server";

export default async function Inicio() {
  const sesion = await obtenerSesion();
  const esAlumno = sesion?.perfil.rol === "alumno";
  const nombre = sesion?.perfil.nombres.split(" ")[0];

  return (
    <main className="flex-1 px-4 pt-10 pb-12 animate-aparecer">
      <div className="text-center mb-8 max-w-2xl mx-auto">
        <div className="flex justify-center gap-1.5 mb-5" aria-hidden="true">
          {["A", "S", "D", "F"].map((t, i) => (
            <span key={t} className={`tecla h-10 w-10 text-base ${i === 3 ? "text-lago-600" : ""}`}>
              {t}
            </span>
          ))}
          <span className="tecla h-10 w-24 text-xs text-slate-400">espacio</span>
          {["J", "K", "L", "Ñ"].map((t, i) => (
            <span key={t} className={`tecla h-10 w-10 text-base ${i === 0 ? "text-lago-600" : ""}`}>
              {t}
            </span>
          ))}
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
          {esAlumno ? (
            <>
              ¡Hola, <span className="text-lago-600">{nombre}</span>!
            </>
          ) : (
            <>
              ¿Qué tan rápido <span className="text-lago-600">escribes</span>?
            </>
          )}
        </h1>
        <p className="text-slate-600 mt-3 text-base sm:text-lg">Escribe el texto lo más rápido y preciso que puedas durante 1 minuto.</p>
        {!sesion && (
          <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 inline-flex items-center gap-2 px-3 py-1.5 rounded-full">
            Estás practicando sin cuenta: tus resultados no se guardarán.
            <Link href="/login" className="font-semibold underline underline-offset-2">
              Ingresa
            </Link>
          </p>
        )}
      </div>
      <PracticaAlumno guardar={esAlumno} />
    </main>
  );
}
