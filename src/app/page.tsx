import PruebaMecanografia from "@/components/PruebaMecanografia";

export default function Inicio() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white grid place-items-center font-bold">T</div>
            <span className="text-xl font-bold text-slate-800">TypeLake</span>
          </div>
          <span className="text-sm text-slate-500">Concurso de Mecanografía</span>
        </div>
      </header>

      <section className="flex-1 px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800">Prueba de velocidad</h1>
          <p className="text-slate-600 mt-2">Escribe el texto lo más rápido y preciso que puedas durante 1 minuto.</p>
        </div>
        <PruebaMecanografia />
      </section>
    </main>
  );
}
