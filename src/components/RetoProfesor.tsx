import type { RecordProfesor } from "@/lib/profesor";

/** Récord del profesor mostrado como reto (solo si el admin lo activó). */
export default function RetoProfesor({ record, className = "" }: { record: RecordProfesor; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm text-violet-800 ${className}`}>
      <span aria-hidden="true">🧑‍🏫</span>
      <span>
        Récord del profesor{record.nombre ? ` ${record.nombre}` : ""}: <b className="tabular-nums">{Math.round(record.ppm)} ppm</b>. ¿Lo puedes superar?
      </span>
    </div>
  );
}
