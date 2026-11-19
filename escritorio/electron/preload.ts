// Puente seguro entre la interfaz y el proceso principal: solo estas funciones.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("typelake", {
  estado: () => ipcRenderer.invoke("estado"),
  entrar: (usuario: string, codigo: string) => ipcRenderer.invoke("entrar", usuario, codigo),
  entrarInvitado: () => ipcRenderer.invoke("entrarInvitado"),
  salir: () => ipcRenderer.invoke("salir"),
  record: () => ipcRenderer.invoke("record"),
  guardar: (r: unknown) => ipcRenderer.invoke("guardar", r),
  elegirMeme: (ppm: number, referencia: number | null) => ipcRenderer.invoke("elegirMeme", ppm, referencia),
  cambiarMemes: (activos: boolean) => ipcRenderer.invoke("cambiarMemes", activos),
  profesor: {
    entrar: (pin: string) => ipcRenderer.invoke("profesor:entrar", pin),
    salir: () => ipcRenderer.invoke("profesor:salir"),
    cargarPaquete: () => ipcRenderer.invoke("profesor:cargarPaquete"),
    exportar: (soloPendientes: boolean) => ipcRenderer.invoke("profesor:exportar", soloPendientes),
    borrarExportados: () => ipcRenderer.invoke("profesor:borrarExportados"),
    recientes: () => ipcRenderer.invoke("profesor:recientes"),
  },
});
