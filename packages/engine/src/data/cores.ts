// Cores dos jogadores (WARII.md §2). Só o que as regras usam; os tons de exibição ficam no front.

export const IDS_CORES = ["branco", "vermelho", "azul", "preto", "verde", "amarelo"] as const;

export type CorId = (typeof IDS_CORES)[number];

export interface Cor {
  readonly id: CorId;
  readonly nome: string;
  // Forma usada nas cartas-objetivo ("Destruir totalmente os exércitos AZUIS").
  readonly plural: string;
}

export const CORES: Readonly<Record<CorId, Cor>> = {
  branco: { id: "branco", nome: "Branco", plural: "brancos" },
  vermelho: { id: "vermelho", nome: "Vermelho", plural: "vermelhos" },
  azul: { id: "azul", nome: "Azul", plural: "azuis" },
  preto: { id: "preto", nome: "Preto", plural: "pretos" },
  verde: { id: "verde", nome: "Verde", plural: "verdes" },
  amarelo: { id: "amarelo", nome: "Amarelo", plural: "amarelos" },
};
