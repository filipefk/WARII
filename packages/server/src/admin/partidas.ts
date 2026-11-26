// Partidas vistas pelo administrador: todas, de qualquer status. Ele pode encerrar (a que aguarda
// vira cancelada; a em andamento vira encerrada sem vencedor) e apagar (a partida some com log,
// snapshots e participantes). As duas operações travam a linha da partida, como as ações do jogo
// (tempoReal/acoes.ts), que recusam gravar se a partida mudou de status ou sumiu.
import type { PartidaAdminDto, StatusPartida } from "@warii/shared";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Transacao } from "../db/index.js";
import { acoesPartida, partidas, participantes, snapshots, usuarios } from "../db/schema.js";
import { ErroDeAdmin } from "./usuarios.js";

const partidaInexistente = () => new ErroDeAdmin(404, "PARTIDA_INEXISTENTE", "partida inexistente");

export async function listarTodasAsPartidas(): Promise<PartidaAdminDto[]> {
  const anfitriao = alias(usuarios, "anfitriao");
  const vencedor = alias(usuarios, "vencedor");
  const linhas = await db
    .select({
      partida: partidas,
      anfitriaoNome: anfitriao.nome,
      vencedorNome: vencedor.nome,
    })
    .from(partidas)
    .innerJoin(anfitriao, eq(anfitriao.id, partidas.anfitriaoId))
    .leftJoin(vencedor, eq(vencedor.id, partidas.vencedorId))
    .orderBy(desc(partidas.criadaEm));
  if (linhas.length === 0) return [];

  const jogadores = await db
    .select({
      partidaId: participantes.partidaId,
      usuarioId: participantes.usuarioId,
      nome: usuarios.nome,
      robo: usuarios.robo,
    })
    .from(participantes)
    .innerJoin(usuarios, eq(usuarios.id, participantes.usuarioId))
    .where(
      inArray(
        participantes.partidaId,
        linhas.map((l) => l.partida.id),
      ),
    )
    .orderBy(asc(participantes.assento), asc(participantes.entrouEm));
  const porPartida = new Map<string, PartidaAdminDto["participantes"]>();
  for (const { partidaId, ...jogador } of jogadores) {
    const lista = porPartida.get(partidaId) ?? [];
    lista.push(jogador);
    porPartida.set(partidaId, lista);
  }

  return linhas.map(({ partida, anfitriaoNome, vencedorNome }) => ({
    id: partida.id,
    nome: partida.nome,
    status: partida.status,
    anfitriao: { id: partida.anfitriaoId, nome: anfitriaoNome },
    participantes: porPartida.get(partida.id) ?? [],
    vencedor:
      partida.vencedorId === null ? null : { id: partida.vencedorId, nome: vencedorNome ?? "" },
    seq: partida.seq,
    criadaEm: partida.criadaEm.toISOString(),
    iniciadaEm: partida.iniciadaEm?.toISOString() ?? null,
    encerradaEm: partida.encerradaEm?.toISOString() ?? null,
  }));
}

async function travar(tx: Transacao, partidaId: string) {
  const [linha] = await tx
    .select({ status: partidas.status })
    .from(partidas)
    .where(eq(partidas.id, partidaId))
    .for("update");
  if (!linha) throw partidaInexistente();
  return linha;
}

// Devolve o novo status (cancelada ou encerrada).
export async function encerrarPartida(partidaId: string): Promise<StatusPartida> {
  return db.transaction(async (tx) => {
    const { status } = await travar(tx, partidaId);
    const agora = new Date();
    if (status === "aguardando") {
      await tx
        .update(partidas)
        .set({ status: "cancelada", convite: null, atualizadaEm: agora })
        .where(eq(partidas.id, partidaId));
      return "cancelada";
    }
    if (status === "em_andamento") {
      await tx
        .update(partidas)
        .set({ status: "encerrada", encerradaEm: agora, atualizadaEm: agora })
        .where(eq(partidas.id, partidaId));
      return "encerrada";
    }
    throw new ErroDeAdmin(409, "PARTIDA_JA_ENCERRADA", "a partida já está encerrada ou cancelada");
  });
}

// Apaga a partida e tudo o que é dela. O log (acoes_partida) é só de inclusão: o trigger da
// migration 0003 só deixa apagar com `warii.apagar_partida` ligado nesta transação.
export async function apagarPartida(partidaId: string): Promise<{ status: StatusPartida }> {
  return db.transaction(async (tx) => {
    const { status } = await travar(tx, partidaId);
    await tx.execute(sql`SELECT set_config('warii.apagar_partida', 'on', true)`);
    await tx.delete(snapshots).where(eq(snapshots.partidaId, partidaId));
    await tx.delete(acoesPartida).where(eq(acoesPartida.partidaId, partidaId));
    await tx.delete(participantes).where(eq(participantes.partidaId, partidaId));
    await tx.delete(partidas).where(eq(partidas.id, partidaId));
    return { status };
  });
}
