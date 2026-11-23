// Continentes e tabela de bônus de recebimento (WARII.md §3.1 e §6.2).
// Os bônus são o padrão da partida; a tabela é um parâmetro configurável (§13.4).

export const IDS_CONTINENTES = ["AN", "AS", "EU", "AF", "ASI", "OC"] as const;

export type ContinenteId = (typeof IDS_CONTINENTES)[number];

export interface Continente {
  readonly id: ContinenteId;
  readonly nome: string;
  // Territórios necessários para a maioria: mais da metade, floor(n/2) + 1.
  readonly maioriaMinima: number;
  readonly bonusMaioria: number;
  readonly bonusTotalidade: number;
}

export const CONTINENTES: Readonly<Record<ContinenteId, Continente>> = {
  AN: { id: "AN", nome: "América do Norte", maioriaMinima: 6, bonusMaioria: 5, bonusTotalidade: 7 },
  AS: { id: "AS", nome: "América do Sul", maioriaMinima: 3, bonusMaioria: 2, bonusTotalidade: 3 },
  EU: { id: "EU", nome: "Europa", maioriaMinima: 4, bonusMaioria: 5, bonusTotalidade: 7 },
  AF: { id: "AF", nome: "África", maioriaMinima: 4, bonusMaioria: 3, bonusTotalidade: 4 },
  ASI: { id: "ASI", nome: "Ásia", maioriaMinima: 7, bonusMaioria: 7, bonusTotalidade: 10 },
  OC: { id: "OC", nome: "Oceania", maioriaMinima: 3, bonusMaioria: 2, bonusTotalidade: 3 },
};
