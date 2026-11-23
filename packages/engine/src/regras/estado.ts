// Estado completo de uma partida (WARII.md §13.1). Só dados serializáveis em JSON (sem Map, Set
// ou classes), porque o estado vai para os snapshots do banco. Inclui a informação oculta
// (objetivos, mãos, ordem do monte): para enviar a um jogador, use visaoDoJogador().

import type { CartaId } from "../data/cartas.js";
import type { ContinenteId } from "../data/continentes.js";
import type { CorId } from "../data/cores.js";
import type { TerritorioId } from "../data/territorios.js";
import type { Parametros } from "./parametros.js";

export type JogadorId = string;

// PREP_ESCOLHA_5J: escolha (a)/(b) do caso de 5 jogadores (§4.3).
// PREP_OCUPACAO: ocupação dos territórios vagos, 1 exército por vez (§4.4).
// RECEBER → ATACAR → DESLOCAR: fases da vez (§5). FIM: partida encerrada.
// Sorteio do distribuidor, distribuição dos CEs, objetivos e compra de cartas são automáticos.
export type Fase = "PREP_ESCOLHA_5J" | "PREP_OCUPACAO" | "RECEBER" | "ATACAR" | "DESLOCAR" | "FIM";

export interface EstadoTerritorio {
  // null só durante a preparação (território vago).
  dono: JogadorId | null;
  exercitos: number;
  // Exércitos que entraram neste território na vez atual e não podem mais se mover (§8.3).
  chegaramNoTurno: number;
}

export interface EstadoJogador {
  readonly id: JogadorId;
  readonly cor: CorId;
  // Objetivo em vigor (pode ter sido trocado automaticamente, §10.2). null até o sorteio.
  objetivoId: string | null;
  // Objetivo sorteado.
  objetivoOriginalId: string | null;
  cartas: CartaId[];
  bombardeirosBase: number;
  bombardeirosCaixa: number;
  eliminado: boolean;
  eliminadoPor: JogadorId | null;
}

// Exércitos ainda a colocar na fase de recebimento. O +1 de cada CE é colocado automaticamente.
export interface Recebimento {
  // Valem em qualquer território do jogador.
  livres: number;
  // Valem só em territórios do continente.
  porContinente: Partial<Record<ContinenteId, number>>;
}

export interface AtaqueAereoEmCurso {
  readonly alvo: TerritorioId;
  readonly defensor: JogadorId;
  emCombate: number;
  ciclos: number;
}

// Território recém-conquistado esperando o atacante dizer quantos exércitos entram (§7.2).
// O primeiro exército já entrou; `maximo` é o total permitido (dados do último ataque).
export interface ConquistaPendente {
  readonly origem: TerritorioId;
  readonly alvo: TerritorioId;
  readonly maximo: number;
}

export interface EstadoTurno {
  conquistou: boolean;
  recebimento: Recebimento | null;
  ataqueAereo: AtaqueAereoEmCurso | null;
  conquistaPendente: ConquistaPendente | null;
}

export interface EstadoPreparacao {
  // Caso de 5 jogadores: as 2 cartas de CE que sobraram da distribuição (§4.3).
  centrosExtras: CartaId[];
  escolhasB: number;
  escolhasFeitas: number;
}

export interface EstadoPartida {
  readonly versao: 1;
  fase: Fase;
  // 0 durante a preparação.
  rodada: number;
  // Primeira rodada especial (§5.1): etapa 1 só recebe, etapa 2 ataca, desloca e compra.
  etapaPrimeiraRodada: 1 | 2 | null;
  // Ordem da mesa: o próximo índice é o jogador "à esquerda".
  jogadores: EstadoJogador[];
  // Índice, em `jogadores`, de quem tem a vez (ou de quem escolhe/ocupa na preparação).
  vez: number;
  distribuidor: number;
  // Quem abre cada rodada (§4.6). -1 durante a preparação.
  primeiroJogador: number;
  territorios: Record<TerritorioId, EstadoTerritorio>;
  // Monte de compra; o topo é o índice 0.
  monte: CartaId[];
  descarte: CartaId[];
  turno: EstadoTurno;
  preparacao: EstadoPreparacao | null;
  vencedor: JogadorId | null;
  readonly parametros: Parametros;
}

export const turnoVazio = (): EstadoTurno => ({
  conquistou: false,
  recebimento: null,
  ataqueAereo: null,
  conquistaPendente: null,
});
