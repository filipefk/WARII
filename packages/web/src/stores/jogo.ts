// Estado só de interface da tela do jogo (nada disso vai ao servidor): território selecionado, a
// interação em andamento (origem, alvo, cartas marcadas) e até que lote de eventos as animações
// já mostraram. A interação é zerada a cada nova vez.
import type { CartaId, TerritorioId } from "@warii/engine";
import type { PapelDaEscolha } from "../jogo/interacao";
import { create } from "zustand";

export type ModoInteracao =
  | "nenhum"
  | "doisVagos"
  | "ataqueTerrestre"
  | "ataqueAereo"
  | "deslocar"
  | "reforco"
  | "transporte"
  | "descarte";

export interface Interacao {
  modo: ModoInteracao;
  // Primeiro território escolhido (origem do ataque/deslocamento/transporte, 1º dos dois vagos).
  origem: TerritorioId | null;
  // Segundo território escolhido (alvo ou destino), à espera da quantidade.
  destino: TerritorioId | null;
  cartas: CartaId[];
  // Bombardeiros da base no ataque aéreo (null = o padrão da situação).
  daBase: number | null;
}

const SEM_INTERACAO: Interacao & { invalido: null } = {
  modo: "nenhum",
  origem: null,
  destino: null,
  cartas: [],
  daBase: null,
  invalido: null,
};

// Último clique recusado numa etapa de origem e destino, para o painel avisar.
export interface EscolhaInvalida {
  territorio: TerritorioId;
  papel: PapelDaEscolha;
}

interface EstadoJogo extends Interacao {
  partidaId: string | null;
  invalido: EscolhaInvalida | null;
  // Território mostrado no painel (só informação; não altera a interação).
  selecionado: TerritorioId | null;
  // Identifica a vez e a fase atuais ("rodada:vez:etapa:fase"); quando muda, a interação é zerada.
  chaveDaVez: string | null;
  // Seq do último lote de eventos já animado.
  seqAnimado: number;

  abrirPartida: (partidaId: string, seqAtual: number) => void;
  sincronizarVez: (chave: string) => void;
  selecionar: (territorio: TerritorioId | null) => void;
  iniciar: (modo: ModoInteracao) => void;
  definirOrigem: (territorio: TerritorioId | null) => void;
  definirDestino: (territorio: TerritorioId | null) => void;
  alternarCarta: (carta: CartaId) => void;
  definirDaBase: (quantidade: number) => void;
  marcarInvalido: (invalido: EscolhaInvalida | null) => void;
  // Desfaz a origem e o destino escolhidos (mantém o modo e as cartas).
  limparEscolha: () => void;
  cancelar: () => void;
  marcarAnimado: (seq: number) => void;
}

export const useJogo = create<EstadoJogo>()((set, get) => ({
  ...SEM_INTERACAO,
  partidaId: null,
  selecionado: null,
  chaveDaVez: null,
  seqAnimado: 0,

  // Ao abrir (ou trocar de) partida, o que já aconteceu não é animado de novo.
  abrirPartida(partidaId, seqAtual) {
    if (get().partidaId === partidaId) return;
    set({ ...SEM_INTERACAO, partidaId, selecionado: null, chaveDaVez: null, seqAnimado: seqAtual });
  },
  sincronizarVez(chave) {
    if (get().chaveDaVez !== chave) set({ ...SEM_INTERACAO, chaveDaVez: chave });
  },
  selecionar: (selecionado) => set({ selecionado }),
  iniciar: (modo) => set({ ...SEM_INTERACAO, modo }),
  definirOrigem: (origem) => set({ origem, destino: null, invalido: null }),
  definirDestino: (destino) => set({ destino, invalido: null }),
  alternarCarta: (carta) =>
    set((s) => ({
      cartas: s.cartas.includes(carta) ? s.cartas.filter((c) => c !== carta) : [...s.cartas, carta],
    })),
  definirDaBase: (daBase) => set({ daBase }),
  marcarInvalido: (invalido) => set({ invalido }),
  limparEscolha: () => set({ origem: null, destino: null, invalido: null, selecionado: null }),
  cancelar: () => set(SEM_INTERACAO),
  marcarAnimado: (seq) => set((s) => ({ seqAnimado: Math.max(s.seqAnimado, seq) })),
}));

export function chaveDaVez(rodada: number, vez: number, etapa: 1 | 2 | null): string {
  return `${rodada}:${vez}:${etapa ?? "-"}`;
}

// A interação também é zerada quando a fase muda dentro da mesma vez.
export function chaveDaFase(
  rodada: number,
  vez: number,
  etapa: 1 | 2 | null,
  fase: string,
): string {
  return `${chaveDaVez(rodada, vez, etapa)}:${fase}`;
}
