import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Google redirige aquí después de iniciar sesión.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codigo = searchParams.get("code");
  const siguiente = searchParams.get("siguiente") ?? "/";
  const destino = siguiente.startsWith("/") ? siguiente : "/";

  // Si la base de datos rechazó el registro (correo no autorizado), Supabase manda un error.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Esta cuenta de Google no está autorizada como administrador.")}`);
  }

  if (codigo) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("No se pudo iniciar sesión. Inténtalo de nuevo.")}`);
}
