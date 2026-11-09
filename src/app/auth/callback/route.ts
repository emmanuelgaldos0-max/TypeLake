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
    const detalle = searchParams.get("error_description") ?? searchParams.get("error") ?? "";
    console.error("[auth/callback] Supabase devolvió un error:", detalle);
    const mensaje = /database error|registro no permitido/i.test(detalle)
      ? "Esta cuenta de Google no está autorizada como administrador."
      : `No se pudo iniciar sesión con Google (${detalle}).`;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(mensaje)}`);
  }

  if (codigo) {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (error) console.error("[auth/callback] exchangeCodeForSession falló:", error.message);
    if (!error) {
      const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", data.user.id).maybeSingle();
      if (perfil) return NextResponse.redirect(`${origin}${perfil.rol === "admin" ? destino : "/"}`);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Esta cuenta no está autorizada.")}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("No se pudo iniciar sesión. Inténtalo de nuevo.")}`);
}
