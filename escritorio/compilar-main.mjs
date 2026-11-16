// Compila el proceso principal y el preload de Electron (TypeScript → un solo archivo cada uno).
import { build } from "esbuild";

const comun = { bundle: true, platform: "node", target: "node22", format: "cjs", external: ["electron"], logLevel: "info" };

await build({ ...comun, entryPoints: ["electron/main.ts"], outfile: "dist/main.js" });
await build({ ...comun, entryPoints: ["electron/preload.ts"], outfile: "dist/preload.js" });
