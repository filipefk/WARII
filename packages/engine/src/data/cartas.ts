// As 61 cartas de troca (WARII.md §9.1), uma entrada por carta física.
// Os ids são estáveis e vão para o log das partidas: não renomear depois de haver partidas gravadas.

import { CONTINENTES, IDS_CONTINENTES, type ContinenteId } from "./continentes.js";
import type { TerritorioId } from "./territorios.js";

interface DefinicaoCartaTerritorio {
  readonly id: string;
  readonly nome: string;
  // Numa carta com mais de um território, o jogador escolhe um só ao usá-la.
  readonly territorios: readonly TerritorioId[];
  // Carta de CE (usada na preparação, §4.2): só o território marcado é o CE.
  readonly centro?: TerritorioId;
}

const DEFINICOES_TERRITORIO = [
  // Cartas de CE (12)
  { id: "novayork", nome: "Nova York", territorios: ["novayork"], centro: "novayork" },
  {
    id: "labrador-ottawa-mackenzie",
    nome: "Labrador, Ottawa, Mackenzie",
    territorios: ["labrador", "ottawa", "mackenzie"],
    centro: "ottawa",
  },
  { id: "brasil", nome: "Brasil", territorios: ["brasil"], centro: "brasil" },
  {
    id: "franca-inglaterra",
    nome: "França, Inglaterra",
    territorios: ["franca", "inglaterra"],
    centro: "inglaterra",
  },
  {
    id: "alemanha-polonia",
    nome: "Alemanha, Polônia",
    territorios: ["alemanha", "polonia"],
    centro: "alemanha",
  },
  { id: "moscou", nome: "Moscou", territorios: ["moscou"], centro: "moscou" },
  { id: "egito", nome: "Egito", territorios: ["egito"], centro: "egito" },
  { id: "africadosul", nome: "África do Sul", territorios: ["africadosul"], centro: "africadosul" },
  {
    id: "orientemedio",
    nome: "Oriente Médio",
    territorios: ["orientemedio"],
    centro: "orientemedio",
  },
  { id: "china", nome: "China", territorios: ["china"], centro: "china" },
  { id: "japao", nome: "Japão", territorios: ["japao"], centro: "japao" },
  {
    id: "australia-novaguine",
    nome: "Austrália, Nova Guiné",
    territorios: ["australia", "novaguine"],
    centro: "australia",
  },
  // Cartas de território sem CE (15)
  { id: "alasca", nome: "Alasca", territorios: ["alasca"] },
  {
    id: "california-vancouver",
    nome: "Califórnia, Vancouver",
    territorios: ["california", "vancouver"],
  },
  { id: "groenlandia", nome: "Groenlândia", territorios: ["groenlandia"] },
  { id: "mexico-cuba", nome: "México, Cuba", territorios: ["mexico", "cuba"] },
  { id: "venezuela", nome: "Venezuela, Colômbia", territorios: ["venezuela"] },
  // A ajuda online chama esta carta de "Argentina Bolívia"; a Bolívia faz parte do Peru no mapa.
  { id: "peru-argentina", nome: "Argentina, Bolívia", territorios: ["peru", "argentina"] },
  { id: "islandia-suecia", nome: "Islândia, Suécia", territorios: ["islandia", "suecia"] },
  { id: "argelia", nome: "Argélia", territorios: ["argelia"] },
  {
    id: "congo-sudao-madagascar",
    nome: "Congo, Sudão, Madagascar",
    territorios: ["congo", "sudao", "madagascar"],
  },
  { id: "aral-omsk", nome: "Aral, Omsk", territorios: ["aral", "omsk"] },
  { id: "dudinka-siberia", nome: "Dudinka, Sibéria", territorios: ["dudinka", "siberia"] },
  { id: "mongolia-tchita", nome: "Mongólia, Tchita", territorios: ["mongolia", "tchita"] },
  { id: "vladivostok", nome: "Vladivostok", territorios: ["vladivostok"] },
  { id: "india-vietna", nome: "Índia, Vietnã", territorios: ["india", "vietna"] },
  { id: "borneu-sumatra", nome: "Bornéu, Sumatra", territorios: ["borneu", "sumatra"] },
] as const satisfies readonly DefinicaoCartaTerritorio[];

export const VALORES_NUMERICOS = [2, 3, 4, 5] as const;

export type ValorNumerico = (typeof VALORES_NUMERICOS)[number];

// Quantidade de cartas numéricas de cada valor.
export const QUANTIDADE_NUMERICAS: Readonly<Record<ValorNumerico, number>> = {
  2: 10,
  3: 8,
  4: 6,
  5: 4,
};

export type CartaId =
  | (typeof DEFINICOES_TERRITORIO)[number]["id"]
  | `cont-${ContinenteId}`
  | `num${ValorNumerico}-${string}`;

export interface CartaTerritorio extends DefinicaoCartaTerritorio {
  readonly tipo: "territorio";
  readonly id: CartaId;
}

// Vale um território qualquer do continente (⚠ A CONFIRMAR, §9.1).
export interface CartaContinente {
  readonly tipo: "continente";
  readonly id: CartaId;
  readonly nome: string;
  readonly continente: ContinenteId;
}

// Soma exércitos ou bombardeiros a uma carta de território; nunca é usada sozinha.
export interface CartaNumerica {
  readonly tipo: "numerica";
  readonly id: CartaId;
  readonly nome: string;
  readonly valor: ValorNumerico;
}

export type CartaDeTroca = CartaTerritorio | CartaContinente | CartaNumerica;

const CARTAS_TERRITORIO: readonly CartaTerritorio[] = DEFINICOES_TERRITORIO.map((c) => ({
  tipo: "territorio",
  ...c,
}));

const CARTAS_CONTINENTE: readonly CartaContinente[] = IDS_CONTINENTES.map((c) => ({
  tipo: "continente",
  id: `cont-${c}`,
  nome: CONTINENTES[c].nome,
  continente: c,
}));

const CARTAS_NUMERICAS: readonly CartaNumerica[] = VALORES_NUMERICOS.flatMap((valor) =>
  Array.from({ length: QUANTIDADE_NUMERICAS[valor] }, (_, i) => ({
    tipo: "numerica" as const,
    id: `num${valor}-${String(i + 1).padStart(2, "0")}` as const,
    nome: `+${valor}`,
    valor,
  })),
);

export const CARTAS_DE_TROCA: readonly CartaDeTroca[] = [
  ...CARTAS_TERRITORIO,
  ...CARTAS_CONTINENTE,
  ...CARTAS_NUMERICAS,
];

const CARTA_POR_ID: ReadonlyMap<string, CartaDeTroca> = new Map(
  CARTAS_DE_TROCA.map((c) => [c.id, c]),
);

export function cartaDeTroca(id: string): CartaDeTroca | undefined {
  return CARTA_POR_ID.get(id);
}
