"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import Spinner from "@/components/ui/Spinner";
import { crearClienteNavegador } from "@/lib/supabase/client";

const DOMINIO_ALUMNOS = "alumnos.typelake.local";

function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
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
    if (error) {
      setCargando(false);
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  const entrarAdmin = async () => {
    setCargandoGoogle(true);
    const supabase = crearClienteNavegador();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?siguiente=/admin` },
    });
  };

  return (
    <div className="w-full max-w-md animate-aparecer">
      <div className="tarjeta overflow-hidden">
        <div className="bg-gradient-to-br from-lago-600 to-lago-800 px-8 pt-8 pb-10 text-white relative">
          <div className="absolute right-6 top-6 grid grid-cols-3 gap-1 opacity-25" aria-hidden="true">
            {"QWERTYASD".split("").map((t) => (
              <span key={t} className="grid h-6 w-6 place-items-center rounded border border-white/60 text-[10px] font-bold">
                {t}
              </span>
            ))}
          </div>
          <div className="inline-block rounded-2xl bg-white p-2 shadow-lg">
            <Logo compacto />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">¡Bienvenido a TypeLake!</h1>
          <p className="text-lago-100 text-sm mt-1">Ingresa con el usuario y la contraseña que te dio tu profesor.</p>
        </div>

        <form onSubmit={entrarAlumno} className="px-8 py-7 space-y-4">
          <div>
            <label className="etiqueta" htmlFor="usuario">
              Usuario
            </label>
            <input
              id="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              placeholder="ej. jperezg"
              required
              className="campo py-2.5"
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="clave">
              Contraseña
            </label>
            <input
              id="clave"
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="current-password"
              required
              className="campo py-2.5"
            />
          </div>
          {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
          <button disabled={cargando} className="btn btn-primario w-full py-3 text-base">
            {cargando ? (
              <>
                <Spinner /> Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>

      <div className="text-center mt-6">
        <button onClick={entrarAdmin} disabled={cargandoGoogle} className="btn btn-secundario">
          {cargandoGoogle ? (
            <Spinner />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
          )}
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
