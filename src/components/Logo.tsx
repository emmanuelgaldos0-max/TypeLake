/** Logo de TypeLake: dos teclas y el nombre. */
export default function Logo({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative inline-flex">
        <span className="tecla h-9 w-9 text-lago-700 text-lg">T</span>
        <span className="tecla absolute -right-2 -bottom-1.5 h-5 w-5 text-[10px] text-acento-500 border-acento-500/40">L</span>
      </span>
      {!compacto && (
        <span className="ml-1 text-xl font-extrabold tracking-tight text-slate-900">
          Type<span className="text-lago-600">Lake</span>
        </span>
      )}
    </span>
  );
}
