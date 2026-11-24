// Tons de exibição das cores dos jogadores: os tokens jogador-* do sistema de design (definidos em
// index.css). Os nomes das cores vêm do engine.
import type { CorId } from "@warii/engine";

export interface TomDaCor {
  fundo: string;
  texto: string;
}

export const TONS: Readonly<Record<CorId, TomDaCor>> = {
  branco: { fundo: "var(--color-jogador-branco)", texto: "var(--color-jogador-branco-texto)" },
  vermelho: { fundo: "var(--color-jogador-vermelho)", texto: "var(--color-jogador-texto-claro)" },
  azul: { fundo: "var(--color-jogador-azul)", texto: "var(--color-jogador-texto-claro)" },
  preto: { fundo: "var(--color-jogador-preto)", texto: "var(--color-jogador-texto-claro)" },
  verde: { fundo: "var(--color-jogador-verde)", texto: "var(--color-jogador-texto-claro)" },
  amarelo: { fundo: "var(--color-jogador-amarelo)", texto: "var(--color-jogador-amarelo-texto)" },
};
