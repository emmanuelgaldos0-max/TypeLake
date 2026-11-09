import { FRAGMENTOS, type Nivel } from "@/data/textos";

function barajar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Arma un texto nuevo combinando fragmentos al azar del nivel indicado,
 * hasta tener al menos `minCaracteres`. Así cada prueba es distinta.
 */
export function generarTexto(nivel: Nivel, minCaracteres = 1200, evitarInicio?: string): string {
  const disponibles = FRAGMENTOS.filter((f) => f.nivel === nivel).map((f) => f.texto);
  const partes: string[] = [];
  let largo = 0;
  let ultimo = evitarInicio;

  while (largo < minCaracteres) {
    let tanda = barajar(disponibles);
    // Evita que el mismo fragmento quede dos veces seguidas al rebarajar.
    if (tanda[0] === ultimo && tanda.length > 1) tanda = [...tanda.slice(1), tanda[0]];
    for (const t of tanda) {
      partes.push(t);
      largo += t.length + 1;
      ultimo = t;
      if (largo >= minCaracteres) break;
    }
  }
  return partes.join(" ").replace(/\s+/g, " ").trim();
}
