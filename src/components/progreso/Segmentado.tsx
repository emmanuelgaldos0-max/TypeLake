"use client";

/** Grupo de botones para elegir una opción (filtros en una sola fila). */
export default function Segmentado<T extends string | number>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex rounded-lg bg-slate-100 p-0.5 text-sm">
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          role="radio"
          aria-checked={o.valor === valor}
          onClick={() => onCambio(o.valor)}
          className={`px-3 py-1 rounded-md transition ${o.valor === valor ? "bg-white text-slate-800 shadow-sm font-medium" : "text-slate-500 hover:text-slate-800"}`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}
