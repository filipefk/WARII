// Estado completo de uma partida (WARII.md §13.1). Só dados serializáveis em JSON (sem Map, Set
// ou classes), porque o estado vai para os snapshots do banco. Inclui a informação oculta
// (objetivos, mãos, ordem do monte): para enviar a um jogador, use visaoDoJogador().

import type { CartaId } from "../data/cartas.js";
import type { ContinenteId } from "../data/continentes.js";
import type { CorId } from "../data/cores.js";
import type { TerritorioId } from "../data/territorios.js";
import type { Parametros } from "./parametros.js";

export type JogadorId = string;

// PREP_OCUPACAO: ocupação dos territórios vagos, 1 exército por vez (§4.4).
// RECEBER → ATACAR → DESLOCAR: fases da vez (§5). FIM: partida encerrada.
// Sorteio do distribuidor, distribuição dos CEs, objetivos e compra de cartas são automáticos.
export type Fase = "PREP_OCUPACAO" | "RECEBER" | "ATACAR" | "DESLOCAR" | "FIM";

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

// Ataque terrestre com os dados do atacante já rolados, esperando o defensor rolar os dele (§7.1).
export interface AtaqueTerrestreEmCurso {
  readonly origem: TerritorioId;
  readonly alvo: TerritorioId;
  readonly defensor: JogadorId;
  // Já ordenados do maior para o menor.
  readonly dadosAtaque: readonly number[];
}

// Ataque terrestre declarado (iniciarAtaqueTerrestre): o combate entre a origem e o alvo fica
// aberto para toda a mesa (a janela de combate) e vale para os ataques seguidos com o mesmo par,
// até o atacante encerrá-lo ou fazer outra coisa. Não muda regra nenhuma do combate.
export interface ConflitoTerrestre {
  readonly origem: TerritorioId;
  readonly alvo: TerritorioId;
  readonly defensor: JogadorId;
}

// Etapa do ciclo aéreo: o defensor rola a antiaérea, depois o atacante rola o ataque e, se a
// partida permite interromper (vídeo), o atacante decide entre os ciclos se continua.
export type EtapaAerea = "antiaereo" | "ataque" | "decisao";

export interface AtaqueAereoEmCurso {
  readonly alvo: TerritorioId;
  readonly defensor: JogadorId;
  emCombate: number;
  ciclos: number;
  etapa: EtapaAerea;
  // Antiaérea do ciclo em curso, enquanto o atacante não rola o ataque (etapa "ataque").
  dadoAntiaereo: number | null;
  bombardeirosAbatidos: number;
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
  ataqueTerrestre: AtaqueTerrestreEmCurso | null;
  // Opcional: os snapshots de antes do conflito declarado não o têm.
  conflitoTerrestre?: ConflitoTerrestre | null;
  ataqueAereo: AtaqueAereoEmCurso | null;
  conquistaPendente: ConquistaPendente | null;
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
  // Índice, em `jogadores`, de quem tem a vez (ou de quem ocupa na preparação).
  vez: number;
  distribuidor: number;
  // Quem abre cada rodada (§4.6). -1 durante a preparação.
  primeiroJogador: number;
  territorios: Record<TerritorioId, EstadoTerritorio>;
  // Monte de compra; o topo é o índice 0.
  monte: CartaId[];
  descarte: CartaId[];
  turno: EstadoTurno;
  vencedor: JogadorId | null;
  readonly parametros: Parametros;
}

export const turnoVazio = (): EstadoTurno => ({
  conquistou: false,
  recebimento: null,
  ataqueTerrestre: null,
  conflitoTerrestre: null,
  ataqueAereo: null,
  conquistaPendente: null,
});
