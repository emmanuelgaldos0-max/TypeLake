export interface Resultado {
  ppm: number; // palabras por minuto netas (solo caracteres correctos, 5 caracteres = 1 palabra)
  ppmBruta: number; // contando todo lo escrito
  precision: number; // % de pulsaciones correctas (incluye errores corregidos)
  correctos: number;
  incorrectos: number; // caracteres que quedaron mal al final
  pulsaciones: number;
  errores: number; // errores cometidos en total, aunque se hayan corregido
  erroresPorTecla: Record<string, number>;
  duracionSeg: number;
  // Señales para el sistema antitrampas (fase 3)
  senales: {
    variacionRitmo: number | null; // coeficiente de variación entre pulsaciones; muy bajo = ritmo robótico
    salidasPestana: number;
    insercionesMasivas: number; // varios caracteres entrando de golpe (autocompletar, scripts)
    pegadosBloqueados: number;
  };
}

export function contarCorrectos(escrito: string, objetivo: string) {
  let correctos = 0;
  for (let i = 0; i < escrito.length; i++) if (escrito[i] === objetivo[i]) correctos++;
  return { correctos, incorrectos: escrito.length - correctos };
}

export function calcularPpm(caracteres: number, segundos: number) {
  if (segundos <= 0) return 0;
  return Math.round(caracteres / 5 / (segundos / 60));
}

export function variacionRitmo(tiempos: number[]): number | null {
  if (tiempos.length < 30) return null;
  const intervalos: number[] = [];
  for (let i = 1; i < tiempos.length; i++) intervalos.push(tiempos[i] - tiempos[i - 1]);
  const media = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
  if (media === 0) return 0;
  const varianza = intervalos.reduce((a, b) => a + (b - media) ** 2, 0) / intervalos.length;
  return Math.round((Math.sqrt(varianza) / media) * 100) / 100;
}
