import type { Metadata } from "next";
import DashboardResultados from "@/components/admin/DashboardResultados";
import RetoProfesor from "@/components/RetoProfesor";
import TableroRestringido, { type DatosTableroRestringido } from "@/components/TableroRestringido";
import { cargarDashboard, type DatosDashboard } from "@/lib/cargarDashboard";
import { aplicarFormula, describirFormula, mejoresPorAlumno } from "@/lib/estadisticas";
import { recordProfesorVisible } from "@/lib/profesor";
import { crearClienteAdmin, obtenerSesion } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tablero · TypeLake" };

/**
 * Tablero público (sin iniciar sesión), por ejemplo para proyectarlo en clase.
 * Solo lectura: los datos se preparan en el servidor con nombres según la
 * configuración de privacidad, sin usuarios ni ids reales, y solo con las
 * fórmulas marcadas como visibles para alumnos.
 *
 * Si el admin desactivó "ver datos de otros salones", quien no es admin solo recibe
 * los promedios por salón, el puntaje más alto del colegio y (si es alumno) su salón.
 */
export default async function Tablero() {
  const db = crearClienteAdmin();
  const [sesion, { data: cfg }] = await Promise.all([obtenerSesion(), db.from("configuracion").select("*").single()]);
  const verOtrosSalones = (cfg as { ver_otros_salones?: boolean } | null)?.ver_otros_salones !== false;
  const [datos, reto] = await Promise.all([cargarDashboard(db, "publico"), recordProfesorVisible()]);

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
      {reto && (
        <div className="mb-4 flex justify-center">
          <RetoProfesor record={reto} />
        </div>
      )}
      {verOtrosSalones || sesion?.perfil.rol === "admin" ? (
        <DashboardResultados {...datos} modo="publico" />
      ) : (
        <TableroRestringido {...restringir(datos, sesion?.perfil.rol === "alumno" ? sesion.perfil.salon_id : null)} />
      )}
    </main>
  );
}

/** Reduce los datos a lo que se puede mostrar sin ver nombres ni puntajes de otros salones. */
function restringir(datos: DatosDashboard, miSalonId: number | null): DatosTableroRestringido {
  const { salones, alumnos, intentos, sinNota, mediciones, formulas } = datos;
  const mejores = mejoresPorAlumno(intentos);
  const salon = salones.find((s) => s.id === miSalonId);
  return {
    formulas: formulas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      descripcion: describirFormula(f, mediciones.find((m) => m.id === f.medicion_id)?.nombre),
      salones: aplicarFormula(f, salones, alumnos, intentos, sinNota).map((r) => ({
        id: r.salon.id,
        nombre: r.salon.nombre,
        promedio: r.promedio,
        conPuntaje: r.conPuntaje,
        alumnos: r.alumnos,
      })),
    })),
    mejorColegio: mejores.size ? Math.max(...mejores.values()) : null,
    miSalon: salon
      ? {
          id: salon.id,
          nombre: salon.nombre,
          alumnos: alumnos.filter((a) => a.salonId === salon.id).map((a) => ({ nombre: a.nombre, mejor: mejores.get(a.id) ?? null })),
        }
      : null,
  };
}
