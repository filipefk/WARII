// Estado só de interface da tela do jogo (nada disso vai ao servidor): território selecionado, a
// interação em andamento (origem, alvo, cartas marcadas) e até que lote de eventos as animações
// já mostraram. A interação é zerada a cada nova vez.
import type { CartaId, TerritorioId } from "@warii/engine";
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

interface Interacao {
  modo: ModoInteracao;
  // Primeiro território escolhido (origem do ataque/deslocamento/transporte, 1º dos dois vagos).
  origem: TerritorioId | null;
  // Segundo território escolhido (alvo ou destino), à espera da quantidade.
  destino: TerritorioId | null;
  cartas: CartaId[];
}

const SEM_INTERACAO: Interacao = { modo: "nenhum", origem: null, destino: null, cartas: [] };

interface EstadoJogo extends Interacao {
  partidaId: string | null;
  // Território mostrado no painel (só informação; não altera a interação).
  selecionado: TerritorioId | null;
  // Identifica a vez atual ("rodada:vez:etapa"); quando muda, a interação é zerada.
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
  definirOrigem: (origem) => set({ origem, destino: null }),
  definirDestino: (destino) => set({ destino }),
  alternarCarta: (carta) =>
    set((s) => ({
      cartas: s.cartas.includes(carta) ? s.cartas.filter((c) => c !== carta) : [...s.cartas, carta],
    })),
  cancelar: () => set(SEM_INTERACAO),
  marcarAnimado: (seq) => set((s) => ({ seqAnimado: Math.max(s.seqAnimado, seq) })),
}));

export function chaveDaVez(rodada: number, vez: number, etapa: 1 | 2 | null): string {
  return `${rodada}:${vez}:${etapa ?? "-"}`;
}
