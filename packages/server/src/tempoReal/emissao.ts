// Envio do estado, do lobby e da presença às salas. Chamar de dentro da fila da partida, para
// que a ordem das mensagens acompanhe a ordem das alterações.
import { visaoDoJogador } from "@warii/engine";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { partidas } from "../db/schema.js";
import { obterLobby } from "../partidas/lobby.js";
import type { PartidaAtiva } from "./partidasAtivas.js";
import { salaDaPartida, salaDoJogador, type ServidorIo } from "./tipos.js";

// Estado completo, na visão de cada jogador.
export function emitirEstado(io: ServidorIo, partidaId: string, partida: PartidaAtiva): void {
  for (const jogador of partida.estado.jogadores) {
    io.to(salaDoJogador(partidaId, jogador.id)).emit(
      "estado",
      partidaId,
      visaoDoJogador(partida.estado, jogador.id),
      partida.seq,
    );
  }
}

// Sala de espera para cada participante; o link de convite só vai para o anfitrião.
export async function emitirLobby(io: ServidorIo, partidaId: string): Promise<void> {
  const [linha] = await db
    .select({ anfitriaoId: partidas.anfitriaoId })
    .from(partidas)
    .where(eq(partidas.id, partidaId));
  if (!linha) return;
  const doAnfitriao = await obterLobby(partidaId, linha.anfitriaoId);
  for (const p of doAnfitriao.participantes) {
    io.to(salaDoJogador(partidaId, p.usuarioId)).emit(
      "lobby",
      partidaId,
      p.anfitriao ? doAnfitriao : { ...doAnfitriao, convite: null },
    );
  }
}

export async function emitirPresenca(io: ServidorIo, partidaId: string): Promise<void> {
  const sockets = await io.in(salaDaPartida(partidaId)).fetchSockets();
  const conectados = [...new Set(sockets.map((s) => s.data.usuarioId))].toSorted();
  io.to(salaDaPartida(partidaId)).emit("presenca", partidaId, conectados);
}
