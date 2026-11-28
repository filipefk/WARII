// Contrato das rotas /api/auth: schemas zod (validados no servidor) e tipos (usados no front).
import { z } from "zod";
import type { VersaoAvatar } from "./avatar.js";

export const SENHA_MAX = 128;
export const NOME_MIN = 2;
export const NOME_MAX = 24;

export const esquemaEmail = z
  .string()
  .trim()
  .max(254, "e-mail longo demais")
  .pipe(z.email({ error: "e-mail inválido" }));

export const esquemaSenha = z
  .string()
  .min(1, "a senha não pode ser vazia")
  .max(SENHA_MAX, `a senha deve ter no máximo ${SENHA_MAX} caracteres`);

export const esquemaNome = z
  .string()
  .trim()
  .min(NOME_MIN, `o nome deve ter pelo menos ${NOME_MIN} caracteres`)
  .max(NOME_MAX, `o nome deve ter no máximo ${NOME_MAX} caracteres`);

// Token dos links de ativação/redefinição: 32 bytes em base64url.
export const esquemaTokenSenha = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "link inválido ou expirado");

// No login a senha não passa pela política (contas antigas podem ter outra); só um limite de tamanho.
export const LoginEntrada = z.object({
  email: esquemaEmail,
  senha: z.string().min(1, "informe a senha").max(SENHA_MAX),
});
export type LoginEntrada = z.infer<typeof LoginEntrada>;

export const DefinirSenhaEntrada = z.object({
  token: esquemaTokenSenha,
  senha: esquemaSenha,
});
export type DefinirSenhaEntrada = z.infer<typeof DefinirSenhaEntrada>;

export const TrocarSenhaEntrada = z.object({
  senhaAtual: z.string().min(1, "informe a senha atual").max(SENHA_MAX),
  novaSenha: esquemaSenha,
});
export type TrocarSenhaEntrada = z.infer<typeof TrocarSenhaEntrada>;

export interface UsuarioDto {
  id: string;
  email: string;
  nome: string;
  // Vê as telas de administração (usuários e partidas).
  admin: boolean;
  avatar: VersaoAvatar;
}

// Corpo de toda resposta de erro da API.
export interface ErroApi {
  codigo: string;
  mensagem: string;
}
