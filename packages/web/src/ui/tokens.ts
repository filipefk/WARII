// Valores dos tokens do sistema de design (index.css) para quando a cor precisa ser calculada no
// JavaScript (variação de luminosidade dos territórios, clareamento do nome do continente). Fora
// disso, use `var(--color-…)` direto.
//
// O Tailwind só emite as variáveis de tema citadas por extenso no código-fonte: por isso os nomes
// abaixo são literais, nunca montados.
import type { ContinenteId } from "@warii/engine";
import { hsl } from "d3";

const VARIAVEL_DO_CONTINENTE: Readonly<Record<ContinenteId, string>> = {
  AN: "--color-cont-an",
  AS: "--color-cont-as",
  EU: "--color-cont-eu",
  AF: "--color-cont-af",
  ASI: "--color-cont-asi",
  OC: "--color-cont-oc",
};

const cache = new Map<string, string>();

function valorDaVariavel(variavel: string): string {
  let valor = cache.get(variavel);
  if (valor === undefined) {
    valor = getComputedStyle(document.documentElement).getPropertyValue(variavel).trim();
    cache.set(variavel, valor);
  }
  return valor;
}

export const corDoContinente = (c: ContinenteId): string => `var(${VARIAVEL_DO_CONTINENTE[c]})`;

const baseDoContinente = (c: ContinenteId) => hsl(valorDaVariavel(VARIAVEL_DO_CONTINENTE[c]));

// Cor do território: a do continente com a luminosidade deslocada por `tom` (de geografia.json),
// limitada a [0,2; 0,8] como no protótipo.
export function corDoTerritorio(c: ContinenteId, tom: number): string {
  const cor = baseDoContinente(c);
  cor.l = Math.max(0.2, Math.min(0.8, cor.l + tom));
  return cor.formatHex();
}

// Nome de continente escrito sobre o mapa (clareado 0,4) ou sobre a carta-objetivo (0,7).
export function corClareadaDoContinente(c: ContinenteId, quanto: number): string {
  return baseDoContinente(c).brighter(quanto).formatHex();
}
