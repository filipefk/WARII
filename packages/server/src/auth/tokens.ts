// Tokens opacos (cookie de sessão e links de senha). O valor só existe no cliente; o banco guarda
// o HMAC-SHA256 dele com SESSION_SECRET, então quem ler o banco não consegue montar um token válido.
import { createHmac, randomBytes } from "node:crypto";
import { config } from "../config.js";

const TAMANHO_TOKEN = 32;

export function gerarToken(): string {
  return randomBytes(TAMANHO_TOKEN).toString("base64url");
}

export function hashDoToken(token: string): Buffer {
  return createHmac("sha256", config.SESSION_SECRET).update(token).digest();
}

// Formato de gerarToken(): 32 bytes em base64url sem preenchimento = 43 caracteres.
export function formatoDeTokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
