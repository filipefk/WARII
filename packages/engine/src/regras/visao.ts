// Projeção da partida para um jogador (WARII.md §13.3): remove objetivos e cartas alheios e a
// ordem do monte. É o único formato de estado que deve sair do servidor para os clientes.

import { CARTAS_DE_TROCA, type CartaId } from "../data/cartas.js";
import type { CorId } from "../data/cores.js";
import type { EstadoPartida, JogadorId } from "./estado.js";
import type { Evento } from "./eventos.js";
import { copiaJson } from "./util.js";

export interface VisaoJogador {
  readonly id: JogadorId;
  readonly cor: CorId;
  readonly eliminado: boolean;
  readonly eliminadoPor: JogadorId | null;
  readonly bombardeirosBase: number;
  readonly bombardeirosCaixa: number;
  readonly quantidadeCartas: number;
  // Só do próprio jogador; dos outros, null.
  readonly cartas: readonly CartaId[] | null;
  // Só do próprio jogador (e do vencedor, no fim); dos outros, null.
  readonly objetivoId: string | null;
  readonly objetivoOriginalId: string | null;
}

export interface VisaoPartida extends Omit<EstadoPartida, "jogadores" | "monte"> {
  // Quem está vendo (null = espectador, sem nada privado).
  readonly voce: JogadorId | null;
  readonly jogadores: readonly VisaoJogador[];
  readonly quantidadeMonte: number;
}

export function visaoDoJogador(estado: EstadoPartida, jogadorId: JogadorId | null): VisaoPartida {
  // Cópia profunda: quem recebe a visão não consegue alterar o estado.
  const copia = copiaJson(estado);
  const { jogadores, monte, ...resto } = copia;
  return {
    ...resto,
    voce: jogadorId,
    quantidadeMonte: monte.length,
    jogadores: jogadores.map((j) => {
      const proprio = j.id === jogadorId;
      const revelaObjetivo = proprio || (copia.fase === "FIM" && j.id === copia.vencedor);
      return {
        id: j.id,
        cor: j.cor,
        eliminado: j.eliminado,
        eliminadoPor: j.eliminadoPor,
        bombardeirosBase: j.bombardeirosBase,
        bombardeirosCaixa: j.bombardeirosCaixa,
        quantidadeCartas: j.cartas.length,
        cartas: proprio ? j.cartas : null,
        objetivoId: revelaObjetivo ? j.objetivoId : null,
        objetivoOriginalId: revelaObjetivo ? j.objetivoOriginalId : null,
      };
    }),
  };
}

// Estado equivalente à visão para as regras de quem vê (pré-visualização no front, decisão do
// robô). O monte vira cartas quaisquer que não estão à vista (só a quantidade importa) e as mãos
// e objetivos alheios ficam vazios. Devolve uma cópia: pode ser alterada à vontade.
export function estadoDaVisao(visao: VisaoPartida): EstadoPartida {
  const { voce: _voce, quantidadeMonte, jogadores, ...resto } = copiaJson(visao);
  const minhas = new Set(jogadores.find((j) => j.id === visao.voce)?.cartas ?? []);
  const vistas = new Set<CartaId>([...minhas, ...resto.descarte]);
  const monte = CARTAS_DE_TROCA.map((c) => c.id)
    .filter((id) => !vistas.has(id))
    .slice(0, quantidadeMonte);
  return {
    ...resto,
    monte,
    jogadores: jogadores.map((j) => ({
      id: j.id,
      cor: j.cor,
      objetivoId: j.objetivoId,
      objetivoOriginalId: j.objetivoOriginalId,
      cartas: [...(j.cartas ?? [])],
      bombardeirosBase: j.bombardeirosBase,
      bombardeirosCaixa: j.bombardeirosCaixa,
      eliminado: j.eliminado,
      eliminadoPor: j.eliminadoPor,
    })),
  };
}

// Filtra os eventos de uma ação para um jogador: some o objetivo alheio e o conteúdo das cartas
// compradas ou herdadas por outro (fica só a quantidade).
export function eventosParaJogador(
  eventos: readonly Evento[],
  jogadorId: JogadorId | null,
): Evento[] {
  const filtrados: Evento[] = [];
  for (const e of eventos) {
    switch (e.tipo) {
      case "objetivoSorteado":
      case "objetivoAlterado":
        if (e.jogador === jogadorId) filtrados.push(e);
        break;
      case "cartasCompradas":
      case "cartasHerdadas":
        filtrados.push(e.jogador === jogadorId ? e : { ...e, cartas: [] });
        break;
      default:
        filtrados.push(e);
    }
  }
  return filtrados;
}
