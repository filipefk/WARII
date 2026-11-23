// Eventos produzidos por uma ação: o que aconteceu, com os dados rolados, para o log e para a
// interface. Alguns são privados (cartas compradas, objetivos): eventosParaJogador() os filtra.

import type { CartaId } from "../data/cartas.js";
import type { ContinenteId } from "../data/continentes.js";
import type { TerritorioId } from "../data/territorios.js";
import type { Fase, JogadorId } from "./estado.js";

export type Evento =
  // Preparação
  | {
      readonly tipo: "distribuidorSorteado";
      // Uma lista por rodada de desempate.
      readonly rolagens: readonly (readonly { jogador: JogadorId; valor: number }[])[];
      readonly distribuidor: JogadorId;
    }
  | {
      readonly tipo: "centrosDistribuidos";
      readonly jogador: JogadorId;
      readonly cartas: readonly CartaId[];
      readonly territorios: readonly TerritorioId[];
    }
  | {
      readonly tipo: "centroExtraEscolhido";
      readonly jogador: JogadorId;
      readonly carta: CartaId;
      readonly territorio: TerritorioId;
    }
  | {
      readonly tipo: "doisVagosOcupados";
      readonly jogador: JogadorId;
      readonly territorios: readonly TerritorioId[];
    }
  | {
      readonly tipo: "territorioOcupado";
      readonly jogador: JogadorId;
      readonly territorio: TerritorioId;
    }
  // Privado: só o próprio jogador vê.
  | {
      readonly tipo: "objetivoSorteado";
      readonly jogador: JogadorId;
      readonly objetivo: string;
      // Objetivo em vigor, se o sorteado já foi trocado (destruir a própria cor).
      readonly emVigor: string;
    }
  // Vez e fases
  | {
      readonly tipo: "inicioDaVez";
      readonly jogador: JogadorId;
      readonly rodada: number;
      readonly etapaPrimeiraRodada: 1 | 2 | null;
      readonly fase: Fase;
    }
  | {
      readonly tipo: "recebimento";
      readonly jogador: JogadorId;
      readonly livres: number;
      readonly porContinente: Partial<Record<ContinenteId, number>>;
      // CEs que já receberam o +1 automático.
      readonly centros: readonly TerritorioId[];
      readonly bombardeiros: number;
    }
  | {
      readonly tipo: "exercitosPosicionados";
      readonly jogador: JogadorId;
      readonly territorio: TerritorioId;
      readonly quantidade: number;
    }
  | { readonly tipo: "faseAlterada"; readonly jogador: JogadorId; readonly fase: Fase }
  // Ataque terrestre
  | {
      readonly tipo: "ataqueTerrestre";
      readonly jogador: JogadorId;
      readonly defensor: JogadorId;
      readonly origem: TerritorioId;
      readonly alvo: TerritorioId;
      // Já ordenados do maior para o menor.
      readonly dadosAtaque: readonly number[];
      readonly dadosDefesa: readonly number[];
      readonly perdasAtaque: number;
      readonly perdasDefesa: number;
    }
  | {
      readonly tipo: "territorioConquistado";
      readonly jogador: JogadorId;
      readonly defensor: JogadorId;
      readonly origem: TerritorioId;
      readonly territorio: TerritorioId;
    }
  | {
      readonly tipo: "exercitosMovidosAposConquista";
      readonly jogador: JogadorId;
      readonly origem: TerritorioId;
      readonly destino: TerritorioId;
      // Total que entrou no território conquistado.
      readonly quantidade: number;
    }
  // Ataque aéreo
  | {
      readonly tipo: "ataqueAereoIniciado";
      readonly jogador: JogadorId;
      readonly defensor: JogadorId;
      readonly alvo: TerritorioId;
      readonly daBase: number;
      readonly daCaixa: number;
      readonly cartas: readonly CartaId[];
    }
  | {
      readonly tipo: "cicloAereo";
      readonly jogador: JogadorId;
      readonly defensor: JogadorId;
      readonly alvo: TerritorioId;
      readonly dadoAntiaereo: number;
      readonly bombardeirosAbatidos: number;
      // null quando não sobrou bombardeiro para rolar o dado de ataque.
      readonly dadoAtaque: number | null;
      readonly exercitosAbatidos: number;
    }
  | {
      readonly tipo: "ataqueAereoEncerrado";
      readonly jogador: JogadorId;
      readonly alvo: TerritorioId;
      readonly sobreviventes: number;
      readonly destino: "base" | "caixa";
    }
  // Deslocamento
  | {
      readonly tipo: "deslocamento";
      readonly jogador: JogadorId;
      readonly origem: TerritorioId;
      readonly destino: TerritorioId;
      readonly quantidade: number;
      // Aerotransporte CE → CE (§8.2).
      readonly aereo: boolean;
    }
  // Cartas (as usadas e descartadas ficam públicas; as compradas e herdadas, não)
  | {
      readonly tipo: "reforcoComCartas";
      readonly jogador: JogadorId;
      readonly cartas: readonly CartaId[];
      readonly territorio: TerritorioId;
      readonly quantidade: number;
    }
  | {
      readonly tipo: "transporteComCartas";
      readonly jogador: JogadorId;
      readonly cartas: readonly CartaId[];
      readonly origem: TerritorioId;
      readonly destino: TerritorioId;
      readonly quantidade: number;
    }
  | {
      readonly tipo: "cartasDescartadas";
      readonly jogador: JogadorId;
      readonly cartas: readonly CartaId[];
    }
  // Privado no conteúdo: os outros recebem `cartas` vazio e só a quantidade.
  | {
      readonly tipo: "cartasCompradas";
      readonly jogador: JogadorId;
      readonly cartas: readonly CartaId[];
      readonly quantidade: number;
    }
  | { readonly tipo: "descarteReembaralhado"; readonly quantidade: number }
  // Eliminação, objetivos e vitória
  | { readonly tipo: "jogadorEliminado"; readonly jogador: JogadorId; readonly por: JogadorId }
  // Privado no conteúdo, como cartasCompradas.
  | {
      readonly tipo: "cartasHerdadas";
      readonly jogador: JogadorId;
      readonly de: JogadorId;
      readonly cartas: readonly CartaId[];
      readonly quantidade: number;
    }
  // Privado: só o próprio jogador vê.
  | {
      readonly tipo: "objetivoAlterado";
      readonly jogador: JogadorId;
      readonly objetivo: string;
      readonly motivo: "corEliminadaPorOutro" | "reduzidoAUmTerritorio";
    }
  | { readonly tipo: "vitoria"; readonly jogador: JogadorId; readonly objetivo: string };

export type TipoEvento = Evento["tipo"];
