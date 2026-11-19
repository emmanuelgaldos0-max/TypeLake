// Funciones que expone electron/preload.ts
type Resp<T = object> = ({ ok: true } & T) | { ok: false; error: string };

interface EstadoApp {
  hayPaquete: boolean;
  paqueteFecha: string | null;
  alumnos: number;
  memes: number;
  total: number;
  pendientes: number;
  equipo: string;
  carpeta: string;
  alumno: { nombres: string; apellidos: string; salon: string; memes: { activos: boolean; bloqueados: boolean } } | null;
  invitado: boolean;
}

interface Window {
  typelake: {
    estado(): Promise<EstadoApp>;
    entrar(usuario: string, codigo: string): Promise<Resp>;
    entrarInvitado(): Promise<void>;
    salir(): Promise<void>;
    record(): Promise<number | null>;
    guardar(r: unknown): Promise<Resp<{ ppm: number }>>;
    elegirMeme(ppm: number, referencia: number | null): Promise<{ url: string } | null>;
    cambiarMemes(activos: boolean): Promise<void>;
    profesor: {
      entrar(pin: string): Promise<Resp>;
      salir(): Promise<void>;
      cargarPaquete(): Promise<Resp<{ alumnos: number }>>;
      exportar(soloPendientes: boolean): Promise<Resp<{ cantidad: number; archivo: string }>>;
      borrarExportados(): Promise<Resp<{ cantidad: number }>>;
      recientes(): Promise<{ nombre: string; ppm: number; fecha: string; exportado: boolean }[]>;
    };
  };
}
