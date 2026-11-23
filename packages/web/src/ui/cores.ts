// Tons de exibição das cores dos jogadores (os mesmos do Tabuleiro.html). Os nomes vêm do engine.
import type { CorId } from "@warii/engine";

export interface TomDaCor {
  fundo: string;
  texto: string;
}

export const TONS: Readonly<Record<CorId, TomDaCor>> = {
  branco: { fundo: "#f5f5f5", texto: "#222222" },
  vermelho: { fundo: "#d62828", texto: "#ffffff" },
  azul: { fundo: "#1f6fe0", texto: "#ffffff" },
  preto: { fundo: "#222222", texto: "#ffffff" },
  verde: { fundo: "#2e9e3a", texto: "#ffffff" },
  amarelo: { fundo: "#ffd21f", texto: "#222222" },
};
