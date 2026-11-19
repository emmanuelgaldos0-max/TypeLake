// Cifrado y firmas del modo sin internet. Solo Node (servidor y proceso principal de Electron).
import { createCipheriv, createDecipheriv, createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { textoAFirmar, type IntentoSinInternet } from "./sinInternet";

// El paquete va cifrado para que su contenido (contraseñas cifradas, PIN) no se pueda
// leer ni editar abriendo el archivo. La clave viaja dentro de la app.
const CLAVE_PAQUETE = createHash("sha256").update("TypeLake · paquete sin internet · v1").digest();

export function cifrarPaquete(datos: unknown): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", CLAVE_PAQUETE, iv);
  const cuerpo = Buffer.concat([cifrador.update(JSON.stringify(datos), "utf8"), cifrador.final()]);
  return JSON.stringify({ typelake: "paquete", v: 1, iv: iv.toString("base64"), tag: cifrador.getAuthTag().toString("base64"), datos: cuerpo.toString("base64") });
}

export function descifrarPaquete<T>(texto: string): T {
  const sobre = JSON.parse(texto) as { typelake?: string; iv: string; tag: string; datos: string };
  if (sobre.typelake !== "paquete") throw new Error("El archivo no es un paquete de TypeLake.");
  const descifrador = createDecipheriv("aes-256-gcm", CLAVE_PAQUETE, Buffer.from(sobre.iv, "base64"));
  descifrador.setAuthTag(Buffer.from(sobre.tag, "base64"));
  const plano = Buffer.concat([descifrador.update(Buffer.from(sobre.datos, "base64")), descifrador.final()]);
  return JSON.parse(plano.toString("utf8")) as T;
}

/** Clave de firma de un paquete. Solo el servidor puede derivarla (usa su clave secreta). */
export function claveFirmaPaquete(secreto: string, paqueteId: string): string {
  return createHmac("sha256", secreto).update(`typelake-firma:${paqueteId}`).digest("hex");
}

export function firmarIntento(claveHex: string, i: Omit<IntentoSinInternet, "firma" | "ppm" | "paquete_id">): string {
  return createHmac("sha256", Buffer.from(claveHex, "hex")).update(textoAFirmar(i)).digest("hex");
}

export function firmaValida(claveHex: string, i: IntentoSinInternet): boolean {
  const esperada = Buffer.from(firmarIntento(claveHex, i), "hex");
  const recibida = Buffer.from(String(i.firma ?? ""), "hex");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

// Sin letras que se confunden (0/O, 1/I/L)
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Código de un salón para ingresar en la app sin internet. Se deriva de la clave secreta
 * del servidor: siempre es el mismo para ese salón y nadie puede adivinarlo sin la clave.
 */
export function codigoSalon(secreto: string, salonId: number): string {
  const bytes = createHmac("sha256", secreto).update(`typelake-salon:${salonId}`).digest();
  return Array.from(bytes.subarray(0, 5), (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join("");
}

/** Compara códigos sin importar mayúsculas, espacios ni guiones. */
export const normalizarCodigo = (c: string) => String(c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function hashPin(pin: string, sal: string): string {
  return pbkdf2Sync(pin, sal, 100_000, 32, "sha256").toString("hex");
}

export function nuevoPin(pin: string) {
  const sal = randomBytes(16).toString("hex");
  return { sal, hash: hashPin(pin, sal) };
}

export function pinCorrecto(pin: string, guardado: { sal: string; hash: string }): boolean {
  const a = Buffer.from(hashPin(pin, guardado.sal), "hex");
  const b = Buffer.from(guardado.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
