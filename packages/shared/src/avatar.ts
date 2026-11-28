// Avatar dos usuários: foto pequena e redonda ao lado do nome. O front reduz a imagem (quadrada,
// LADO_AVATAR px) antes de enviar; sem avatar, o front desenha um padrão com um motivo de guerra.
// A versão (`avatar` nos DTOs, nula sem foto) entra na URL, que fica em cache para sempre.
import { z } from "zod";

export const LADO_AVATAR = 128;
// Maior imagem aceita depois de decodificada (bytes).
export const TAMANHO_MAXIMO_AVATAR = 48 * 1024;
export const TIPOS_AVATAR = ["image/webp", "image/jpeg", "image/png"] as const;
export type TipoAvatar = (typeof TIPOS_AVATAR)[number];

// Versão da foto do usuário; nula enquanto não houver uma.
export type VersaoAvatar = number | null;

// Corpo de PUT /api/auth/avatar e PUT /api/admin/usuarios/:id/avatar: a imagem como data URL.
export const DefinirAvatarEntrada = z.strictObject({
  imagem: z
    .string()
    .max(Math.ceil((TAMANHO_MAXIMO_AVATAR * 4) / 3) + 64, "imagem grande demais")
    .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/, "imagem inválida"),
});
export type DefinirAvatarEntrada = z.infer<typeof DefinirAvatarEntrada>;

export function urlDoAvatar(usuarioId: string, versao: number): string {
  return `/api/usuarios/${usuarioId}/avatar?v=${versao}`;
}
