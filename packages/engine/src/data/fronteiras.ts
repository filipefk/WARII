// Fronteiras do mapa (WARII.md §3.3), como grafo não direcionado: cada par aparece uma única vez.
// Para as regras todas as ligações são iguais; o tipo só interessa ao desenho do mapa.
// O aerotransporte (§8.2) não precisa de dado extra: liga os CEs de um mesmo dono.

import { IDS_TERRITORIOS, type TerritorioId } from "./territorios.js";

// "terrestre": territórios que se tocam; "maritima": linha pontilhada;
// "volta": linha pontilhada pela borda do tabuleiro (Alasca ↔ Vladivostok).
export type TipoFronteira = "terrestre" | "maritima" | "volta";

export type Fronteira = readonly [TerritorioId, TerritorioId, TipoFronteira];

const T = "terrestre";
const M = "maritima";
const V = "volta";

export const FRONTEIRAS: readonly Fronteira[] = [
  // América do Norte
  ["alasca", "mackenzie", T],
  ["alasca", "vancouver", T],
  ["alasca", "vladivostok", V],
  ["mackenzie", "vancouver", T],
  ["mackenzie", "ottawa", T],
  ["mackenzie", "groenlandia", M],
  ["vancouver", "ottawa", T],
  ["vancouver", "california", T],
  ["ottawa", "labrador", T],
  ["ottawa", "novayork", T],
  ["ottawa", "california", T],
  ["labrador", "novayork", T],
  ["labrador", "groenlandia", M],
  ["california", "novayork", T],
  ["california", "mexico", T],
  ["novayork", "mexico", T],
  ["novayork", "cuba", M],
  ["mexico", "cuba", M],
  ["mexico", "venezuela", T],
  ["groenlandia", "islandia", M],
  // América do Sul
  ["venezuela", "peru", T],
  ["venezuela", "brasil", T],
  ["peru", "brasil", T],
  ["peru", "argentina", T],
  ["brasil", "argentina", T],
  ["brasil", "argelia", M],
  // África
  ["argelia", "egito", T],
  ["argelia", "sudao", T],
  ["argelia", "congo", T],
  ["egito", "sudao", T],
  ["sudao", "congo", T],
  ["sudao", "africadosul", T],
  ["congo", "africadosul", T],
  ["africadosul", "madagascar", M],
  ["sudao", "madagascar", M],
  ["argelia", "franca", M],
  ["egito", "franca", M],
  ["egito", "polonia", M],
  ["egito", "orientemedio", T],
  // Europa
  ["islandia", "inglaterra", M],
  ["islandia", "suecia", M],
  ["inglaterra", "suecia", M],
  ["inglaterra", "franca", M],
  ["franca", "alemanha", T],
  ["franca", "polonia", T],
  ["alemanha", "polonia", T],
  ["suecia", "moscou", T],
  ["polonia", "moscou", T],
  ["polonia", "orientemedio", T],
  ["moscou", "omsk", T],
  ["moscou", "aral", T],
  ["moscou", "orientemedio", T],
  // Ásia
  ["orientemedio", "aral", T],
  ["orientemedio", "india", T],
  ["aral", "omsk", T],
  ["aral", "china", T],
  ["aral", "india", T],
  ["omsk", "dudinka", T],
  ["omsk", "mongolia", T],
  ["omsk", "china", T],
  ["dudinka", "siberia", T],
  ["dudinka", "tchita", T],
  ["dudinka", "mongolia", T],
  ["siberia", "tchita", T],
  ["siberia", "vladivostok", T],
  ["tchita", "mongolia", T],
  ["tchita", "china", T],
  ["tchita", "vladivostok", T],
  ["mongolia", "china", T],
  ["china", "india", T],
  ["china", "vietna", T],
  ["china", "vladivostok", T],
  ["china", "japao", M],
  ["india", "vietna", T],
  ["vladivostok", "japao", M],
  // Oceania
  ["india", "sumatra", M],
  ["vietna", "borneu", M],
  ["sumatra", "australia", M],
  ["borneu", "novaguine", M],
  ["borneu", "australia", M],
  ["novaguine", "australia", M],
];

const VIZINHOS = new Map<TerritorioId, Set<TerritorioId>>(
  IDS_TERRITORIOS.map((id) => [id, new Set<TerritorioId>()]),
);

for (const [a, b] of FRONTEIRAS) {
  VIZINHOS.get(a)?.add(b);
  VIZINHOS.get(b)?.add(a);
}

const NENHUM: ReadonlySet<TerritorioId> = new Set();

export function vizinhos(territorio: TerritorioId): ReadonlySet<TerritorioId> {
  return VIZINHOS.get(territorio) ?? NENHUM;
}

export function saoVizinhos(a: TerritorioId, b: TerritorioId): boolean {
  return vizinhos(a).has(b);
}
