"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarSubidaMeme, prepararSubidaMeme } from "@/app/memes/acciones";
import SelectorCriterio from "@/components/memes/SelectorCriterio";
import Spinner from "@/components/ui/Spinner";
import { mensajeError } from "@/lib/errores";
import { MAX_BYTES, MAX_MB, TIPOS, type CriterioMeme } from "@/lib/memes";
import { crearClienteNavegador } from "@/lib/supabase/client";

/** Subida de un meme. Admin: queda aprobado y puede usar rangos de PPM. Alumno: queda pendiente. */
export default function SubirMeme({ esAdmin }: { esAdmin: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [criterio, setCriterio] = useState<CriterioMeme>({ criterio: "record", categoria: "nuevo_record" });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");

  const elegir = (f: File | undefined) => {
    setError("");
    setListo("");
    if (vista) URL.revokeObjectURL(vista);
    if (!f) return (setArchivo(null), setVista(null));
    if (!TIPOS.includes(f.type)) return setError("Solo se aceptan imágenes PNG, JPG, WEBP o GIF.");
    if (f.size > MAX_BYTES) return setError(`La imagen debe pesar como máximo ${MAX_MB} MB.`);
    setArchivo(f);
    setVista(URL.createObjectURL(f));
  };

  const subir = async () => {
    if (!archivo) return;
    setCargando(true);
    setError("");
    try {
      const permiso = await prepararSubidaMeme(archivo.type, archivo.size);
      if (permiso.error !== null) return setError(permiso.error);
      const { error: errSubida } = await crearClienteNavegador()
        .storage.from("memes")
        .uploadToSignedUrl(permiso.ruta, permiso.token, archivo, { contentType: archivo.type });
      if (errSubida) return setError(`No se pudo subir la imagen: ${errSubida.message}`);
      const fallo = await confirmarSubidaMeme(permiso.ruta, criterio);
      if (fallo) return setError(fallo);
      elegir(undefined); // limpia el archivo elegido (y los mensajes)
      setListo(esAdmin ? "Meme agregado ✓ Ya puede aparecer en los resultados." : "¡Enviado! Aparecerá cuando tu profesor lo apruebe.");
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={entrada}
        type="file"
        accept={TIPOS.join(",")}
        onChange={(e) => elegir(e.target.files?.[0])}
        disabled={cargando}
        className="block text-sm file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-lago-50 file:text-lago-700 hover:file:bg-lago-100"
      />
      {vista && (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local
        <img src={vista} alt="Vista previa del meme" className="max-h-48 rounded-xl border border-slate-200" />
      )}
      {archivo && (
        <>
          <div>
            <span className="etiqueta">¿Cuándo debe aparecer?</span>
            <SelectorCriterio valor={criterio} onCambio={setCriterio} permitirPpm={esAdmin} />
          </div>
          <button onClick={subir} disabled={cargando} className="btn btn-primario">
            {cargando ? (
              <>
                <Spinner /> Subiendo…
              </>
            ) : esAdmin ? (
              "Agregar meme"
            ) : (
              "Enviar para aprobación"
            )}
          </button>
        </>
      )}
      {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
      {listo && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{listo}</p>}
    </div>
  );
}
