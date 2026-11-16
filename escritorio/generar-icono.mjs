// Genera build/icon.png e build/icon.ico con el logo de TypeLake (dos teclas: T y L).
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect x="8" y="8" width="240" height="240" rx="56" fill="#1f63b8"/>
  <rect x="44" y="40" width="140" height="140" rx="30" fill="#ffffff"/>
  <rect x="44" y="164" width="140" height="16" rx="8" fill="#d8e8fb"/>
  <text x="114" y="142" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="104" fill="#184f95">T</text>
  <rect x="150" y="146" width="76" height="76" rx="18" fill="#ffffff" stroke="#eb6834" stroke-width="6"/>
  <text x="188" y="202" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="54" fill="#eb6834">L</text>
</svg>`;

mkdirSync("build", { recursive: true });
const png = (tam) => new Resvg(svg, { fitTo: { mode: "width", value: tam }, font: { loadSystemFonts: true } }).render().asPng();
writeFileSync("build/icon.png", png(512));
writeFileSync("build/icon.ico", await pngToIco([png(256), png(64), png(48), png(32), png(16)]));
console.log("Íconos generados en build/");
