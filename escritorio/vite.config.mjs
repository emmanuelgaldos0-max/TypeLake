// Interfaz de la app de escritorio: reutiliza la prueba y los estilos de la página (../src).
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const aqui = (ruta) => fileURLToPath(new URL(ruta, import.meta.url));

export default defineConfig({
  root: aqui("./renderer"),
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": aqui("../src") },
    dedupe: ["react", "react-dom"],
  },
  css: { postcss: { plugins: [] } },
  build: {
    outDir: aqui("./dist/renderer"),
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
