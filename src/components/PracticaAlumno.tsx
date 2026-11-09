"use client";

import { useCallback } from "react";
import PruebaMecanografia, { type AvisoGuardado } from "@/components/PruebaMecanografia";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { Resultado } from "@/lib/metricas";

const MOTIVOS: Record<string, string> = {
  salto_brusco: "fue mucho más rápido que tus resultados habituales",
  velocidad_imposible: "la velocidad es demasiado alta",
  ritmo_robotico: "el ritmo de escritura fue demasiado uniforme",
  insercion_masiva: "entró texto de golpe",
  datos_inconsistentes: "los datos no cuadran",
  salio_de_la_pestana: "saliste de la pestaña durante la medición",
};

export default function PracticaAlumno({ guardar }: { guardar: boolean }) {
  const registrar = useCallback(async (r: Resultado): Promise<AvisoGuardado> => {
    const supabase = crearClienteNavegador();
    const { data, error } = await supabase.rpc("registrar_intento", {
      p: {
        duracion_seg: r.duracionSeg,
        correctos: r.correctos,
        incorrectos: r.incorrectos,
        pulsaciones: r.pulsaciones,
        errores: r.errores,
        errores_por_tecla: r.erroresPorTecla,
        senales: r.senales,
      },
    });
    if (error) return { tipo: "error", texto: `No se pudo guardar: ${error.message}` };
    if (data.estado === "valido") return { tipo: "ok", texto: "Resultado guardado ✓" };
    const motivos = (data.motivos as string[]).map((m) => MOTIVOS[m] ?? m).join(", ");
    return { tipo: "aviso", texto: `Resultado guardado, pero quedó en revisión porque ${motivos}.` };
  }, []);

  // Mejor PPM válido registrado del alumno (RLS: solo ve sus propios intentos).
  const obtenerRecord = useCallback(async (): Promise<number | null> => {
    const supabase = crearClienteNavegador();
    const { data } = await supabase
      .from("intentos")
      .select("ppm")
      .in("estado", ["valido", "aprobado"])
      .order("ppm", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? Number(data.ppm) : null;
  }, []);

  return <PruebaMecanografia guardar={guardar ? registrar : undefined} obtenerRecord={guardar ? obtenerRecord : undefined} />;
}
