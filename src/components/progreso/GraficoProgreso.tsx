"use client";

import { useEffect, useRef, useState } from "react";

export interface PuntoProgreso {
  fecha: string;
  ppm: number;
  precision: number;
  medicion: boolean;
}

const ALTO = 240;
const M = { arriba: 16, derecha: 16, abajo: 28, izquierda: 40 };
const COLOR = "#2a78d6";

const formatoFecha = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function GraficoProgreso({ puntos }: { puntos: PuntoProgreso[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [activo, setActivo] = useState<number | null>(null);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setAncho(Math.max(280, e.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Eje Y con números redondos (paso de 5, 10, 20, 25 o 50)
  const tope = Math.max(10, Math.max(...puntos.map((p) => p.ppm)) * 1.15);
  const paso = [5, 10, 20, 25, 50].find((s) => tope / s <= 5) ?? 50;
  const maxY = Math.ceil(tope / paso) * paso;
  const ticks = Array.from({ length: maxY / paso + 1 }, (_, i) => i * paso);
  const anchoUtil = ancho - M.izquierda - M.derecha;
  const altoUtil = ALTO - M.arriba - M.abajo;
  const x = (i: number) => M.izquierda + (puntos.length === 1 ? anchoUtil / 2 : (i / (puntos.length - 1)) * anchoUtil);
  const y = (v: number) => M.arriba + altoUtil - (v / maxY) * altoUtil;

  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.ppm).toFixed(1)}`).join(" ");
  const iMax = puntos.reduce((m, p, i) => (p.ppm > puntos[m].ppm ? i : m), 0);
  const ultimo = puntos.length - 1;

  const alMover = (e: React.PointerEvent<SVGRectElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - caja.left;
    const i = Math.round(((px - 0) / caja.width) * (puntos.length - 1));
    setActivo(Math.min(puntos.length - 1, Math.max(0, i)));
  };

  // Cada cuántos intentos poner etiqueta en el eje X
  const pasoX = Math.max(1, Math.ceil(puntos.length / Math.floor(anchoUtil / 50)));
  const p = activo !== null ? puntos[activo] : null;

  return (
    <div ref={contenedor} className="relative">
      <svg width={ancho} height={ALTO} role="img" aria-label="Gráfica de palabras por minuto en cada prueba">
        {/* Cuadrícula y eje Y */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.izquierda} x2={ancho - M.derecha} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#c3c2b7" : "#e1e0d9"} strokeWidth={1} />
            <text x={M.izquierda - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#898781" className="tabular-nums">
              {t}
            </text>
          </g>
        ))}
        {/* Eje X: número de prueba */}
        {puntos.map((_, i) =>
          i % pasoX === 0 || i === ultimo ? (
            <text key={i} x={x(i)} y={ALTO - 8} textAnchor="middle" fontSize={11} fill="#898781" className="tabular-nums">
              {i + 1}
            </text>
          ) : null,
        )}

        {/* Línea */}
        <path d={linea} fill="none" stroke={COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Marcadores: mediciones con anillo; récord y última con etiqueta */}
        {puntos.map((pt, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(pt.ppm)}
            r={i === activo ? 6 : pt.medicion ? 5 : 4}
            fill={pt.medicion ? "#fcfcfb" : COLOR}
            stroke={pt.medicion ? COLOR : "#fcfcfb"}
            strokeWidth={2}
          />
        ))}
        {[iMax, ultimo]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text key={`e${i}`} x={x(i)} y={y(puntos[i].ppm) - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0b0b0b">
              {puntos[i].ppm}
              {i === iMax ? " 🏆" : ""}
            </text>
          ))}

        {/* Cruce del cursor */}
        {p && activo !== null && (
          <line x1={x(activo)} x2={x(activo)} y1={M.arriba} y2={M.arriba + altoUtil} stroke="#c3c2b7" strokeDasharray="3 3" />
        )}

        {/* Zona de interacción (más grande que los puntos) */}
        <rect
          x={M.izquierda}
          y={M.arriba}
          width={anchoUtil}
          height={altoUtil}
          fill="transparent"
          onPointerMove={alMover}
          onPointerLeave={() => setActivo(null)}
        />
      </svg>

      {p && activo !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(x(activo) - 70, 0), ancho - 150),
            top: Math.max(0, y(p.ppm) - 78),
            width: 140,
          }}
        >
          <div className="text-slate-500">
            Prueba {activo + 1}
            {p.medicion && " · medición"}
          </div>
          <div className="text-slate-500">{formatoFecha.format(new Date(p.fecha))}</div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{p.ppm} ppm</div>
          <div className="text-slate-600">{p.precision}% de precisión</div>
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2a78d6]" /> Práctica
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#2a78d6] bg-white" /> Medición en el colegio
        </span>
      </div>
    </div>
  );
}
