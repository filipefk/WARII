// Fotos dos avatares: gravar, remover e ler. A imagem chega como data URL já reduzida pelo front;
// aqui só se confere o tamanho e o tipo pelos primeiros bytes (o prefixo da data URL não basta).
// Cada troca incrementa `usuarios.avatar_versao`, que vai na URL (?v=) e invalida o cache.
import { TAMANHO_MAXIMO_AVATAR, type TipoAvatar } from "@warii/shared";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { avatares, usuarios } from "../db/schema.js";

// Corpo das rotas que recebem a foto (a data URL em base64 é ~4/3 da imagem).
export const LIMITE_CORPO_AVATAR = 80 * 1024;

export class ErroDeAvatar extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDeAvatar";
  }
}

function tipoPelosBytes(imagem: Buffer): TipoAvatar | undefined {
  if (imagem.length >= 3 && imagem[0] === 0xff && imagem[1] === 0xd8 && imagem[2] === 0xff) {
    return "image/jpeg";
  }
  if (imagem.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (
    imagem.subarray(0, 4).toString("latin1") === "RIFF" &&
    imagem.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

// A data URL já passou pelo formato de DefinirAvatarEntrada.
export function decodificarAvatar(dataUrl: string): { tipo: TipoAvatar; imagem: Buffer } {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const imagem = Buffer.from(base64, "base64");
  if (imagem.length === 0) throw new ErroDeAvatar("IMAGEM_INVALIDA", "imagem inválida");
  if (imagem.length > TAMANHO_MAXIMO_AVATAR) {
    throw new ErroDeAvatar("IMAGEM_GRANDE", "imagem grande demais");
  }
  const tipo = tipoPelosBytes(imagem);
  if (!tipo) throw new ErroDeAvatar("IMAGEM_INVALIDA", "use uma imagem JPEG, PNG ou WebP");
  return { tipo, imagem };
}

// Grava a foto e devolve a nova versão (undefined se o usuário não existe).
export async function gravarAvatar(
  usuarioId: string,
  tipo: TipoAvatar,
  imagem: Buffer,
): Promise<number | undefined> {
  return db.transaction(async (tx) => {
    const [linha] = await tx
      .update(usuarios)
      .set({
        avatarVersao: sql`coalesce(${usuarios.avatarVersao}, 0) + 1`,
        atualizadoEm: new Date(),
      })
      .where(eq(usuarios.id, usuarioId))
      .returning({ versao: usuarios.avatarVersao });
    if (!linha) return undefined;
    const agora = new Date();
    await tx
      .insert(avatares)
      .values({ usuarioId, tipo, imagem, atualizadoEm: agora })
      .onConflictDoUpdate({
        target: avatares.usuarioId,
        set: { tipo, imagem, atualizadoEm: agora },
      });
    return linha.versao ?? undefined;
  });
}

export async function removerAvatar(usuarioId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(avatares).where(eq(avatares.usuarioId, usuarioId));
    await tx
      .update(usuarios)
      .set({ avatarVersao: null, atualizadoEm: new Date() })
      .where(eq(usuarios.id, usuarioId));
  });
}

export async function lerAvatar(
  usuarioId: string,
): Promise<{ tipo: string; imagem: Buffer } | undefined> {
  const [linha] = await db
    .select({ tipo: avatares.tipo, imagem: avatares.imagem })
    .from(avatares)
    .where(eq(avatares.usuarioId, usuarioId));
  return linha;
}
