/**
 * Convierte un error en un mensaje entendible. El caso más común es que la
 * página quedó abierta mientras se publicaba una versión nueva de TypeLake.
 */
export function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/server action|failed-to-find-server-action|older or newer deployment/i.test(m)) {
    return "TypeLake se actualizó mientras tenías esta página abierta. Recárgala con Ctrl + Shift + R y vuelve a intentarlo.";
  }
  if (/failed to fetch|network/i.test(m)) return "No hay conexión con el servidor. Revisa tu internet y vuelve a intentarlo.";
  return m;
}
