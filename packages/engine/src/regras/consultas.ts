// Consultas sem efeito sobre o estado. Usadas pelas regras e úteis ao front (calculadora de
// recebimento, destaque de movimentos possíveis etc.).

import type { CartaDeTroca } from "../data/cartas.js";
import { IDS_CONTINENTES, type ContinenteId } from "../data/continentes.js";
import {
  IDS_TERRITORIOS,
  territorio,
  type TerritorioId,
  territoriosDoContinente,
} from "../data/territorios.js";
import type { EstadoJogador, EstadoPartida, JogadorId } from "./estado.js";
import { naoAlcancavel } from "./util.js";

export function jogador(estado: EstadoPartida, id: JogadorId): EstadoJogador | undefined {
  return estado.jogadores.find((j) => j.id === id);
}

export function jogadorDaVez(estado: EstadoPartida): EstadoJogador {
  const j = estado.jogadores[estado.vez];
  if (j === undefined) throw new Error(`Estado corrompido: vez ${estado.vez} sem jogador`);
  return j;
}

export function jogadoresAtivos(estado: EstadoPartida): EstadoJogador[] {
  return estado.jogadores.filter((j) => !j.eliminado);
}

export function territoriosDe(estado: EstadoPartida, id: JogadorId): TerritorioId[] {
  return IDS_TERRITORIOS.filter((t) => estado.territorios[t].dono === id);
}

export function centrosDe(estado: EstadoPartida, id: JogadorId): TerritorioId[] {
  return territoriosDe(estado, id).filter((t) => territorio(t).centroEstrategico);
}

export function territoriosVagos(estado: EstadoPartida): TerritorioId[] {
  return IDS_TERRITORIOS.filter((t) => estado.territorios[t].dono === null);
}

function contarNoContinente(estado: EstadoPartida, id: JogadorId, c: ContinenteId): number {
  return territoriosDoContinente(c).filter((t) => estado.territorios[t].dono === id).length;
}

export function dominaTotalidade(estado: EstadoPartida, id: JogadorId, c: ContinenteId): boolean {
  return contarNoContinente(estado, id, c) === territoriosDoContinente(c).length;
}

// Maioria = mais da metade dos territórios do continente (§6.2). A totalidade também é maioria.
export function dominaMaioria(estado: EstadoPartida, id: JogadorId, c: ContinenteId): boolean {
  const n = territoriosDoContinente(c).length;
  return contarNoContinente(estado, id, c) >= Math.floor(n / 2) + 1;
}

export interface CalculoRecebimento {
  readonly territorios: number;
  // max(mínimo, floor(territórios / 2)), em qualquer território do jogador (§6.1).
  readonly livres: number;
  // Bônus de maioria ou totalidade, o maior, só no próprio continente (§6.2).
  readonly porContinente: Partial<Record<ContinenteId, number>>;
  // +1 em cada CE (§6.3).
  readonly centros: readonly TerritorioId[];
  // +1 bombardeiro por CE, antes de limitar ao que há na caixa (§6.5).
  readonly bombardeiros: number;
  readonly total: number;
}

export function calcularRecebimento(estado: EstadoPartida, id: JogadorId): CalculoRecebimento {
  const p = estado.parametros;
  const territorios = territoriosDe(estado, id).length;
  const livres = Math.max(p.minimoRecebimento, Math.floor(territorios / 2));
  const porContinente: Partial<Record<ContinenteId, number>> = {};
  let bonus = 0;
  for (const c of IDS_CONTINENTES) {
    const tabela = p.bonusContinentes[c];
    let valor = 0;
    if (dominaTotalidade(estado, id, c)) valor = tabela.totalidade;
    else if (dominaMaioria(estado, id, c)) valor = tabela.maioria;
    if (valor > 0) {
      porContinente[c] = valor;
      bonus += valor;
    }
  }
  const centros = centrosDe(estado, id);
  return {
    territorios,
    livres,
    porContinente,
    centros,
    bombardeiros: centros.length,
    total: livres + bonus + centros.length,
  };
}

// Exércitos que ainda podem sair do território nesta vez: sempre fica 1 de ocupação, e os que
// chegaram na vez não se movem de novo (§8.3).
export function exercitosMoviveis(estado: EstadoPartida, t: TerritorioId): number {
  const e = estado.territorios[t];
  return Math.max(0, e.exercitos - 1 - e.chegaramNoTurno);
}

// Territórios que uma carta permite escolher: os da carta, ou qualquer um do continente (⚠ §9.1).
export function territoriosDaCarta(carta: CartaDeTroca): readonly TerritorioId[] {
  switch (carta.tipo) {
    case "territorio":
      return carta.territorios;
    case "continente":
      return territoriosDoContinente(carta.continente);
    case "numerica":
      return [];
    default:
      return naoAlcancavel(carta);
  }
}
