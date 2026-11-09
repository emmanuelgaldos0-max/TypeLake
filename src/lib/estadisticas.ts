// Cálculos compartidos de los dashboards (se usan en el navegador para que los
// filtros y las fórmulas respondan al instante). Replican la lógica de la base
// de datos (función promedio_salones) para que los alumnos y el admin vean lo mismo.

export type TipoFormula = "general" | "mejores_peores" | "top" | "mediana";

export interface Formula {
  id: number;
  nombre: string;
  tipo: TipoFormula;
  mejores: number | null;
  peores: number | null;
  fuente: "mediciones" | "todo";
  medicion_id: number | null;
  sin_intentos: "ignorar" | "cero";
  visible_alumnos: boolean;
}

export interface AlumnoDash {
  id: string;
  nombre: string; // "Apellidos, Nombres"
  usuario: string;
  salonId: number | null;
  salon: string;
  grado: string;
  gradoOrden: number;
}

export interface IntentoDash {
  a: string; // alumno
  ppm: number;
  prec: number | null;
  med: number | null; // medición (null = práctica)
  t: string; // fecha ISO
}

export interface SalonDash {
  id: number;
  nombre: string;
  grado: string;
  gradoOrden: number;
}

export type Fuente = { tipo: "todo" } | { tipo: "practica" } | { tipo: "mediciones"; medicion: number | null };

export const filtrarFuente = (intentos: IntentoDash[], f: Fuente) =>
  intentos.filter((i) =>
    f.tipo === "todo" ? true : f.tipo === "practica" ? i.med === null : i.med !== null && (f.medicion === null || i.med === f.medicion),
  );

export const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function mediana(xs: number[]) {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Mejor PPM de cada alumno según los intentos dados. */
export function mejoresPorAlumno(intentos: IntentoDash[]) {
  const m = new Map<string, number>();
  for (const i of intentos) m.set(i.a, Math.max(m.get(i.a) ?? 0, i.ppm));
  return m;
}

export interface ResultadoSalon {
  salon: SalonDash;
  alumnos: number;
  conPuntaje: number;
  considerados: number;
  promedio: number | null;
  mejor: number | null;
  peor: number | null;
}

/** Aplica una fórmula a cada salón (1 puntaje por alumno: su mejor intento). */
export function aplicarFormula(f: Formula, salones: SalonDash[], alumnos: AlumnoDash[], intentos: IntentoDash[]): ResultadoSalon[] {
  const fuente: Fuente = f.fuente === "todo" ? { tipo: "todo" } : { tipo: "mediciones", medicion: f.medicion_id };
  const mejores = mejoresPorAlumno(filtrarFuente(intentos, fuente));

  return salones.map((s) => {
    const delSalon = alumnos.filter((a) => a.salonId === s.id);
    const puntajes = delSalon
      .map((a) => mejores.get(a.id) ?? (f.sin_intentos === "cero" ? 0 : null))
      .filter((v): v is number => v !== null);
    const conPuntaje = delSalon.filter((a) => mejores.has(a.id)).length;

    const desc = [...puntajes].sort((a, b) => b - a);
    let elegidos: number[];
    if (f.tipo === "top") elegidos = desc.slice(0, f.mejores ?? 10);
    else if (f.tipo === "mejores_peores") {
      const x = f.mejores ?? 0;
      const y = f.peores ?? 0;
      // Si X + Y supera al salón, se usan todos (sin repetir alumnos)
      elegidos = x + y >= desc.length ? desc : [...desc.slice(0, x), ...desc.slice(desc.length - y)];
    } else elegidos = desc;

    const valor = f.tipo === "mediana" ? mediana(elegidos) : promedio(elegidos);
    return {
      salon: s,
      alumnos: delSalon.length,
      conPuntaje,
      considerados: elegidos.length,
      promedio: valor === null ? null : Math.round(valor * 10) / 10,
      mejor: desc.length ? desc[0] : null,
      peor: desc.length ? desc[desc.length - 1] : null,
    };
  });
}

export function describirFormula(f: Pick<Formula, "tipo" | "mejores" | "peores" | "fuente" | "sin_intentos">, nombreMedicion?: string) {
  const metodo =
    f.tipo === "general"
      ? "Promedio de todos los alumnos"
      : f.tipo === "mediana"
        ? "Mediana del salón"
        : f.tipo === "top"
          ? `Promedio de los ${f.mejores ?? 10} mejores`
          : `Promedio de los ${f.mejores ?? 0} mejores + ${f.peores ?? 0} peores`;
  const datos = f.fuente === "todo" ? "práctica y mediciones" : nombreMedicion ? `solo "${nombreMedicion}"` : "solo mediciones";
  const faltan = f.sin_intentos === "cero" ? "sin nota cuenta como 0" : "sin nota no cuenta";
  return `${metodo} · ${datos} · ${faltan}`;
}

export const fechaCorta = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "America/Lima" });
export const fechaHora = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });
