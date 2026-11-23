// Uma ação do jogo pelo socket: aplica no engine com a RNG crypto, grava ação + sorteios (e o
// snapshot, quando for a hora) numa transação que confere o seq, e emite os eventos filtrados.
import {
  type Acao,
  aplicarAcao,
  type EstadoPartida,
  eventosParaJogador,
  gravarRng,
} from "@warii/engine";
import type { Confirmacao, StatusPartida } from "@warii/shared";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { acoesPartida, partidas, snapshots } from "../db/schema.js";
import { rngCrypto } from "../partidas/rng.js";
import { emitirEstado } from "./emissao.js";
import { descartarPartida, guardarPartida, naFila, partidaAtiva } from "./partidasAtivas.js";
import { salaDoJogador, type ServidorIo } from "./tipos.js";

// Ações no máximo entre dois snapshots (além dos gravados a cada nova vez e no fim).
export const INTERVALO_SNAPSHOT = 50;

export function precisaDeSnapshot(
  antes: EstadoPartida,
  depois: EstadoPartida,
  acoesDesdeOUltimo: number,
): boolean {
  const comecouUmaVez = depois.fase === "RECEBER" && antes.fase !== "RECEBER";
  return depois.fase === "FIM" || comecouUmaVez || acoesDesdeOUltimo >= INTERVALO_SNAPSHOT;
}

export function processarAcao(
  io: ServidorIo,
  partidaId: string,
  usuarioId: string,
  acao: Acao,
): Promise<Confirmacao> {
  return naFila(partidaId, async () => {
    const atual = await partidaAtiva(partidaId);
    const { rng, sorteios } = gravarRng(rngCrypto());
    const resultado = aplicarAcao(atual.estado, usuarioId, acao, rng);
    if (!resultado.ok) return { ok: false, erro: resultado.erro };

    const seq = atual.seq + 1;
    const novo = resultado.estado;
    const comSnapshot = precisaDeSnapshot(atual.estado, novo, seq - atual.seqSnapshot);
    const terminou = novo.fase === "FIM";

    const gravou = await db.transaction(async (tx) => {
      const [linha] = await tx
        .select({ seq: partidas.seq, status: partidas.status })
        .from(partidas)
        .where(eq(partidas.id, partidaId))
        .for("update");
      // Outro processo (ou um estado antigo na memória) mexeu na partida: não grava nada.
      if (!linha || linha.seq !== atual.seq || linha.status !== "em_andamento") return false;
      await tx
        .insert(acoesPartida)
        .values({ partidaId, seq, usuarioId, tipo: acao.tipo, acao, sorteios });
      if (comSnapshot) await tx.insert(snapshots).values({ partidaId, seq, estado: novo });
      const agora = new Date();
      await tx
        .update(partidas)
        .set({
          seq,
          atualizadaEm: agora,
          ...(terminou && {
            status: "encerrada" satisfies StatusPartida,
            vencedorId: novo.vencedor,
            encerradaEm: agora,
          }),
        })
        .where(eq(partidas.id, partidaId));
      return true;
    });

    if (!gravou) {
      descartarPartida(partidaId);
      emitirEstado(io, partidaId, await partidaAtiva(partidaId));
      return {
        ok: false,
        erro: {
          codigo: "ESTADO_DESATUALIZADO",
          mensagem: "a partida mudou enquanto a ação era processada; o estado foi reenviado",
        },
      };
    }

    guardarPartida(partidaId, {
      estado: novo,
      seq,
      seqSnapshot: comSnapshot ? seq : atual.seqSnapshot,
    });
    for (const jogador of novo.jogadores) {
      io.to(salaDoJogador(partidaId, jogador.id)).emit(
        "eventos",
        partidaId,
        eventosParaJogador(resultado.eventos, jogador.id),
        seq,
      );
    }
    return { ok: true };
  });
}
