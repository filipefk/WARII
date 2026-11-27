// Log simples por jogador (tabela log_usuarios), visto pelo administrador em /admin/log: entradas
// (cada sessão criada), partidas criadas e partidas jogadas (ao iniciar, com os adversários).
// As linhas são gravadas na mesma transação da operação que as gera.
import type { LogUsuarioDto } from "@warii/shared";
import { desc, eq, inArray } from "drizzle-orm";
import { db, type Executor } from "./db/index.js";
import { logUsuarios, usuarios } from "./db/schema.js";

// Linhas devolvidas ao administrador por usuário (as mais recentes).
export const LIMITE_LOG_USUARIO = 300;

export async function registrarLogin(
  usuarioId: string,
  ip: string | undefined,
  executor: Executor = db,
): Promise<void> {
  await executor.insert(logUsuarios).values({ usuarioId, tipo: "login", ip: ip ?? null });
}

export async function registrarPartidaCriada(
  usuarioId: string,
  partida: { id: string; nome: string },
  executor: Executor = db,
): Promise<void> {
  await executor.insert(logUsuarios).values({
    usuarioId,
    tipo: "partida_criada",
    partidaId: partida.id,
    partidaNome: partida.nome,
  });
}

// Uma linha por jogador humano da partida, com os demais da mesa como adversários.
export async function registrarPartidaIniciada(
  partida: { id: string; nome: string },
  jogadoresIds: string[],
  executor: Executor = db,
): Promise<void> {
  if (jogadoresIds.length === 0) return;
  const encontrados = await executor
    .select({ id: usuarios.id, nome: usuarios.nome, robo: usuarios.robo })
    .from(usuarios)
    .where(inArray(usuarios.id, jogadoresIds));
  // Na ordem recebida (a da mesa).
  const porId = new Map(encontrados.map((j) => [j.id, j]));
  const jogadores = jogadoresIds.flatMap((id) => porId.get(id) ?? []);
  const linhas = jogadores
    .filter((j) => !j.robo)
    .map((j) => ({
      usuarioId: j.id,
      tipo: "partida_iniciada" as const,
      partidaId: partida.id,
      partidaNome: partida.nome,
      adversarios: jogadores
        .filter((outro) => outro.id !== j.id)
        .map(({ nome, robo }) => ({ nome, robo })),
    }));
  if (linhas.length > 0) await executor.insert(logUsuarios).values(linhas);
}

export async function listarLogDoUsuario(usuarioId: string): Promise<LogUsuarioDto[]> {
  const linhas = await db
    .select()
    .from(logUsuarios)
    .where(eq(logUsuarios.usuarioId, usuarioId))
    .orderBy(desc(logUsuarios.criadoEm))
    .limit(LIMITE_LOG_USUARIO);
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    criadoEm: l.criadoEm.toISOString(),
    partida: l.partidaNome === null ? null : { id: l.partidaId, nome: l.partidaNome },
    adversarios: l.adversarios ?? [],
    ip: l.ip,
  }));
}
