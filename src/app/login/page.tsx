"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

const DOMINIO_ALUMNOS = "alumnos.typelake.local";

function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(params.get("error") ?? "");

  const entrarAlumno = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    const supabase = crearClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email: `${usuario.trim().toLowerCase()}@${DOMINIO_ALUMNOS}`,
      password: clave,
    });
    setCargando(false);
    if (error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  const entrarAdmin = async () => {
    const supabase = crearClienteNavegador();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?siguiente=/admin` },
    });
  };

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={entrarAlumno} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Ingreso de alumnos</h1>
        <p className="text-sm text-slate-500 mb-5">Usa el usuario y la contraseña que te dio tu profesor.</p>

        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="usuario">Usuario</label>
        <input
          id="usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="off"
          required
          className="w-full mb-4 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="clave">Contraseña</label>
        <input
          id="clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full mb-4 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
        <button
          disabled={cargando}
          className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-semibold rounded-lg transition"
        >
          {cargando ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="text-center mt-6">
        <button onClick={entrarAdmin} className="text-sm text-slate-500 hover:text-slate-800 underline underline-offset-4">
          Soy administrador: entrar con Google
        </button>
      </div>
    </div>
  );
}

export default function PaginaLogin() {
  return (
    <main className="flex-1 grid place-items-center px-4 py-10">
      <Suspense>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
