/** Esqueleto que se muestra mientras carga una página. */
export default function CargandoPagina({ tarjetas = 4, bloques = 2, sinMarco = false }: { tarjetas?: number; bloques?: number; sinMarco?: boolean }) {
  return (
    <main className={`${sinMarco ? "" : "flex-1 max-w-6xl w-full mx-auto px-4 py-8"} space-y-6`} aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="esqueleto h-8 w-64" />
        <div className="esqueleto h-4 w-96 max-w-full" />
      </div>
      {tarjetas > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: tarjetas }, (_, i) => (
            <div key={i} className="tarjeta p-5 space-y-3">
              <div className="esqueleto h-4 w-24" />
              <div className="esqueleto h-8 w-16" />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: bloques }, (_, i) => (
        <div key={i} className="tarjeta p-6 space-y-3">
          <div className="esqueleto h-5 w-48" />
          <div className="esqueleto h-40 w-full" />
        </div>
      ))}
    </main>
  );
}
