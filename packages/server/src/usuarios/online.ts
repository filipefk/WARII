// Usuários online (ids com algum socket aberto, vindos do tempo real): humanos, por nome.
import type { UsuarioResumoDto } from "@warii/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { usuarios } from "../db/schema.js";

export async function listarOnline(online: string[]): Promise<UsuarioResumoDto[]> {
  if (online.length === 0) return [];
  return db
    .select({ id: usuarios.id, nome: usuarios.nome, avatar: usuarios.avatarVersao })
    .from(usuarios)
    .where(and(inArray(usuarios.id, online), eq(usuarios.robo, false)))
    .orderBy(asc(usuarios.nome));
}
