/** Mini gráfica de tendencia (últimos resultados). */
export default function Sparkline({ valores, ancho = 84, alto = 24 }: { valores: number[]; ancho?: number; alto?: number }) {
  if (valores.length < 2) return <span className="text-xs text-slate-300">—</span>;
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const rango = max - min || 1;
  const x = (i: number) => 2 + (i / (valores.length - 1)) * (ancho - 4);
  const y = (v: number) => alto - 3 - ((v - min) / rango) * (alto - 6);
  const d = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const sube = valores[valores.length - 1] >= valores[0];
  const color = sube ? "#1baf7a" : "#e34948";
  return (
    <svg width={ancho} height={alto} aria-label={`Tendencia: de ${valores[0]} a ${valores[valores.length - 1]} ppm`}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(valores.length - 1)} cy={y(valores[valores.length - 1])} r={2.5} fill={color} />
    </svg>
  );
}
