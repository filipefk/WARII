// Os 43 territórios do mapa (WARII.md §3.2). Ids iguais aos de Tabuleiro.html, para o front
// reaproveitar a geografia do protótipo sem tradução.

import { IDS_CONTINENTES, type ContinenteId } from "./continentes.js";

interface DefinicaoTerritorio {
  readonly id: string;
  readonly nome: string;
  // Regiões agrupadas no mesmo território, escritas em letra menor no tabuleiro.
  readonly regioes?: string;
  readonly continente: ContinenteId;
  readonly centroEstrategico: boolean;
}

const DEFINICOES = [
  // América do Norte
  { id: "alasca", nome: "Alasca", continente: "AN", centroEstrategico: false },
  { id: "mackenzie", nome: "Mackenzie", continente: "AN", centroEstrategico: false },
  { id: "groenlandia", nome: "Groenlândia", continente: "AN", centroEstrategico: false },
  { id: "vancouver", nome: "Vancouver", continente: "AN", centroEstrategico: false },
  { id: "ottawa", nome: "Ottawa", continente: "AN", centroEstrategico: true },
  { id: "labrador", nome: "Labrador", continente: "AN", centroEstrategico: false },
  { id: "california", nome: "Califórnia", continente: "AN", centroEstrategico: false },
  { id: "novayork", nome: "Nova York", continente: "AN", centroEstrategico: true },
  { id: "mexico", nome: "México", continente: "AN", centroEstrategico: false },
  { id: "cuba", nome: "Cuba", continente: "AN", centroEstrategico: false },
  // América do Sul
  {
    id: "venezuela",
    nome: "Venezuela",
    regioes: "Colômbia",
    continente: "AS",
    centroEstrategico: false,
  },
  {
    id: "peru",
    nome: "Peru",
    regioes: "Bolívia · Chile",
    continente: "AS",
    centroEstrategico: false,
  },
  { id: "brasil", nome: "Brasil", continente: "AS", centroEstrategico: true },
  {
    id: "argentina",
    nome: "Argentina",
    regioes: "Uruguai",
    continente: "AS",
    centroEstrategico: false,
  },
  // Europa
  { id: "islandia", nome: "Islândia", continente: "EU", centroEstrategico: false },
  { id: "inglaterra", nome: "Inglaterra", continente: "EU", centroEstrategico: true },
  { id: "suecia", nome: "Suécia", continente: "EU", centroEstrategico: false },
  { id: "moscou", nome: "Moscou", continente: "EU", centroEstrategico: true },
  { id: "alemanha", nome: "Alemanha", continente: "EU", centroEstrategico: true },
  {
    id: "franca",
    nome: "França",
    regioes: "Portugal · Espanha · Itália",
    continente: "EU",
    centroEstrategico: false,
  },
  {
    id: "polonia",
    nome: "Polônia",
    regioes: "Iugoslávia",
    continente: "EU",
    centroEstrategico: false,
  },
  // África
  {
    id: "argelia",
    nome: "Argélia",
    regioes: "Nigéria",
    continente: "AF",
    centroEstrategico: false,
  },
  { id: "egito", nome: "Egito", continente: "AF", centroEstrategico: true },
  { id: "sudao", nome: "Sudão", continente: "AF", centroEstrategico: false },
  { id: "congo", nome: "Congo", continente: "AF", centroEstrategico: false },
  { id: "africadosul", nome: "África do Sul", continente: "AF", centroEstrategico: true },
  { id: "madagascar", nome: "Madagascar", continente: "AF", centroEstrategico: false },
  // Ásia
  { id: "orientemedio", nome: "Oriente Médio", continente: "ASI", centroEstrategico: true },
  { id: "aral", nome: "Aral", continente: "ASI", centroEstrategico: false },
  { id: "omsk", nome: "Omsk", continente: "ASI", centroEstrategico: false },
  { id: "dudinka", nome: "Dudinka", continente: "ASI", centroEstrategico: false },
  { id: "siberia", nome: "Sibéria", continente: "ASI", centroEstrategico: false },
  { id: "tchita", nome: "Tchita", continente: "ASI", centroEstrategico: false },
  { id: "vladivostok", nome: "Vladivostok", continente: "ASI", centroEstrategico: false },
  { id: "mongolia", nome: "Mongólia", continente: "ASI", centroEstrategico: false },
  { id: "china", nome: "China", continente: "ASI", centroEstrategico: true },
  { id: "india", nome: "Índia", continente: "ASI", centroEstrategico: false },
  { id: "vietna", nome: "Vietnã", continente: "ASI", centroEstrategico: false },
  { id: "japao", nome: "Japão", continente: "ASI", centroEstrategico: true },
  // Oceania
  { id: "sumatra", nome: "Sumatra", continente: "OC", centroEstrategico: false },
  { id: "borneu", nome: "Bornéu", continente: "OC", centroEstrategico: false },
  { id: "novaguine", nome: "Nova Guiné", continente: "OC", centroEstrategico: false },
  { id: "australia", nome: "Austrália", continente: "OC", centroEstrategico: true },
] as const satisfies readonly DefinicaoTerritorio[];

export type TerritorioId = (typeof DEFINICOES)[number]["id"];

export interface Territorio extends DefinicaoTerritorio {
  readonly id: TerritorioId;
}

export const TERRITORIOS: readonly Territorio[] = DEFINICOES;

export const IDS_TERRITORIOS: readonly TerritorioId[] = TERRITORIOS.map((t) => t.id);

const TERRITORIO_POR_ID: ReadonlyMap<string, Territorio> = new Map(
  TERRITORIOS.map((t) => [t.id, t]),
);

export function territorio(id: TerritorioId): Territorio {
  const encontrado = TERRITORIO_POR_ID.get(id);
  // Só acontece se o tipo for contornado (ex.: id vindo de fora sem passar por ehTerritorioId).
  if (encontrado === undefined) throw new Error(`Território inexistente: ${id}`);
  return encontrado;
}

// Para validar ids vindos de fora (payload do cliente, log gravado).
export function ehTerritorioId(valor: string): valor is TerritorioId {
  return TERRITORIO_POR_ID.has(valor);
}

export const CENTROS_ESTRATEGICOS: readonly TerritorioId[] = TERRITORIOS.filter(
  (t) => t.centroEstrategico,
).map((t) => t.id);

const TERRITORIOS_POR_CONTINENTE: ReadonlyMap<ContinenteId, readonly TerritorioId[]> = new Map(
  IDS_CONTINENTES.map((c) => [c, TERRITORIOS.filter((t) => t.continente === c).map((t) => t.id)]),
);

export function territoriosDoContinente(continente: ContinenteId): readonly TerritorioId[] {
  return TERRITORIOS_POR_CONTINENTE.get(continente) ?? [];
}
