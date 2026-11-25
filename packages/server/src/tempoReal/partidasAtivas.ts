// Partidas em jogo guardadas na memória, com uma fila por partida que serializa tudo o que lê ou
// altera o estado dela (ações, entradas, avisos do lobby). O banco continua a fonte de verdade:
// a partida é carregada do último snapshot + repetição do log, e cada gravação confere o seq.
// Pressupõe uma única instância do servidor (com várias, seria preciso um adapter compartilhado).
import {
  type Acao,
  aplicarAcao,
  type EstadoPartida,
  type Resultado,
  rngDeReplay,
} from "@warii/engine";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { acoesPartida, partidas, snapshots } from "../db/schema.js";
import { type AcaoCriacao, montarPartida, TIPO_ACAO_CRIACAO } from "../partidas/inicio.js";
import { ErroDeTempoReal, partidaInexistente } from "./erros.js";

export interface PartidaAtiva {
  readonly estado: EstadoPartida;
  // Número da última ação aplicada (igual a partidas.seq).
  readonly seq: number;
  // Seq do snapshot mais recente gravado (-1 se nenhum).
  readonly seqSnapshot: number;
}

type LinhaAcao = typeof acoesPartida.$inferSelect;

// Tempo que uma partida sem ninguém conectado fica na memória antes de ser descartada.
export const ESPERA_DESPEJO_MS = 5 * 60 * 1000;

const ativas = new Map<string, PartidaAtiva>();
const filas = new Map<string, Promise<void>>();
const despejos = new Map<string, NodeJS.Timeout>();

// Roda a tarefa depois das anteriores da mesma partida (mesmo que alguma tenha falhado).
export function naFila<T>(partidaId: string, tarefa: () => Promise<T>): Promise<T> {
  const anterior = filas.get(partidaId) ?? Promise.resolve();
  const atual = anterior.then(tarefa);
  const fim = atual.then(
    () => undefined,
    () => undefined,
  );
  filas.set(partidaId, fim);
  void fim.then(() => {
    if (filas.get(partidaId) === fim) filas.delete(partidaId);
  });
  return atual;
}

// Partida da memória ou, se não estiver lá, do banco. Chamar sempre de dentro da fila.
export async function partidaAtiva(partidaId: string): Promise<PartidaAtiva> {
  const emMemoria = ativas.get(partidaId);
  if (emMemoria) return emMemoria;
  const carregada = await carregarDoBanco(partidaId);
  ativas.set(partidaId, carregada);
  return carregada;
}

// Quantas partidas estão na memória (para as métricas).
export function quantidadeDeAtivas(): number {
  return ativas.size;
}

export function guardarPartida(partidaId: string, partida: PartidaAtiva): void {
  ativas.set(partidaId, partida);
}

export function descartarPartida(partidaId: string): void {
  ativas.delete(partidaId);
}

export async function carregarDoBanco(partidaId: string): Promise<PartidaAtiva> {
  const [partida] = await db
    .select({ status: partidas.status, seq: partidas.seq })
    .from(partidas)
    .where(eq(partidas.id, partidaId));
  if (!partida || partida.status === "cancelada") throw partidaInexistente();
  if (partida.status === "aguardando") {
    throw new ErroDeTempoReal("PARTIDA_NAO_INICIADA", "a partida ainda não começou");
  }

  const [snapshot] = await db
    .select({ seq: snapshots.seq, estado: snapshots.estado })
    .from(snapshots)
    .where(and(eq(snapshots.partidaId, partidaId), lte(snapshots.seq, partida.seq)))
    .orderBy(desc(snapshots.seq))
    .limit(1);
  const desde = snapshot?.seq ?? -1;
  const acoes = await db
    .select()
    .from(acoesPartida)
    .where(
      and(
        eq(acoesPartida.partidaId, partidaId),
        gt(acoesPartida.seq, desde),
        lte(acoesPartida.seq, partida.seq),
      ),
    )
    .orderBy(asc(acoesPartida.seq));

  try {
    const estado = repetirLog(snapshot?.estado ?? null, desde, acoes, partida.seq);
    return { estado, seq: partida.seq, seqSnapshot: desde };
  } catch (erro) {
    throw new ErroDeTempoReal(
      "PARTIDA_CORROMPIDA",
      `o log da partida ${partidaId} não pôde ser repetido`,
      true,
      erro,
    );
  }
}

function ehCriacao(acao: AcaoCriacao | Acao): acao is AcaoCriacao {
  return "participantes" in acao;
}

// Repete as ações do log a partir de um estado (o do snapshot `desde`, ou nenhum se desde = -1),
// com os sorteios gravados, e confere que todas valem e consomem exatamente o que foi sorteado.
export function repetirLog(
  inicial: EstadoPartida | null,
  desde: number,
  acoes: readonly LinhaAcao[],
  seqFinal: number,
): EstadoPartida {
  let estado = inicial;
  let esperado = desde + 1;
  for (const linha of acoes) {
    if (linha.seq !== esperado) {
      throw new Error(`buraco no log: esperado seq ${esperado}, veio ${linha.seq}`);
    }
    const rng = rngDeReplay(linha.sorteios);
    let resultado: Resultado;
    if (linha.seq === 0) {
      if (linha.tipo !== TIPO_ACAO_CRIACAO || !ehCriacao(linha.acao)) {
        throw new Error("seq 0 não é a criação da partida");
      }
      resultado = montarPartida(linha.acao, rng).resultado;
    } else {
      if (estado === null || linha.usuarioId === null || ehCriacao(linha.acao)) {
        throw new Error(`ação seq ${linha.seq} sem estado anterior, sem jogador ou fora do lugar`);
      }
      resultado = aplicarAcao(estado, linha.usuarioId, linha.acao, rng);
    }
    if (!resultado.ok) {
      throw new Error(`ação seq ${linha.seq} recusada na repetição: ${resultado.erro.codigo}`);
    }
    if (rng.restantes() !== 0) {
      throw new Error(`ação seq ${linha.seq} deixou ${rng.restantes()} sorteios sem usar`);
    }
    estado = resultado.estado;
    esperado++;
  }
  if (estado === null || esperado !== seqFinal + 1) {
    throw new Error(`o log termina no seq ${esperado - 1}, mas a partida está no ${seqFinal}`);
  }
  return estado;
}

// Agenda o descarte da partida da memória se, passado o prazo, ninguém a estiver acompanhando.
export function agendarDespejo(partidaId: string, estaVazia: () => boolean): void {
  if (!estaVazia() || despejos.has(partidaId)) return;
  const temporizador = setTimeout(() => {
    despejos.delete(partidaId);
    void naFila(partidaId, async () => {
      if (estaVazia()) descartarPartida(partidaId);
    });
  }, ESPERA_DESPEJO_MS);
  temporizador.unref();
  despejos.set(partidaId, temporizador);
}

export function cancelarDespejo(partidaId: string): void {
  const temporizador = despejos.get(partidaId);
  if (temporizador) clearTimeout(temporizador);
  despejos.delete(partidaId);
}

// Esvazia a memória (ao encerrar o servidor).
export function esquecerTodas(): void {
  for (const temporizador of despejos.values()) clearTimeout(temporizador);
  despejos.clear();
  ativas.clear();
}
