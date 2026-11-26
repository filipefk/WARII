// Geometria do tabuleiro já projetada (1640×900), gerada por scripts/gerar-geografia.mjs a partir
// do world-atlas e da montagem de Tabuleiro.html. Ids, nomes, continentes, CEs e fronteiras ficam
// no engine; aqui só há desenho. O JSON é grande e entra num chunk próprio, carregado pela tela da
// partida com carregarGeografia().

import {
  IDS_TERRITORIOS,
  type ContinenteId,
  type TerritorioId,
  type TipoFronteira,
} from "@warii/engine";

export type Ponto = readonly [x: number, y: number];

// Parte de um território: o caminho próprio (países inteiros unidos) ou o país dividido
// (em `paisesDivididos`) recortado pelo polígono da região, como um <clipPath>.
export type ParteTerritorio =
  { readonly d: string } | { readonly pais: string; readonly recorte: string };

export interface GeografiaTerritorio {
  readonly partes: readonly ParteTerritorio[];
  // Ponto do nome (e do marcador de exércitos).
  readonly rotulo: Ponto;
  // [x0, y0, x1, y1] da parte principal, sem ilhas pequenas e distantes: enquadra a silhueta das
  // cartas de troca.
  readonly caixa: readonly [x0: number, y0: number, x1: number, y1: number];
  // Países incluídos, em letra menor sob o nome (o mesmo texto de `regioes` do engine).
  readonly sub?: string;
  // Variação somada à luminosidade HSL da cor do continente, limitada a [0,2; 0,8], para
  // distinguir territórios vizinhos do mesmo continente.
  readonly tom: number;
}

// Fronteiras do desenho (não as das regras). `recorte`: caminho do <clipPath>;
// `recortePais`: recortar pelo contorno do país dividido de mesmo nome.
export interface TracoFronteira {
  readonly d: string;
  readonly recorte?: string;
  readonly recortePais?: string;
}

export interface RotaMaritima {
  readonly tipo: Exclude<TipoFronteira, "terrestre">;
  readonly d: string;
  // Onde ficam as bolinhas das pontas.
  readonly pontas: readonly [Ponto, Ponto];
}

export interface Geografia {
  readonly largura: number;
  readonly altura: number;
  // Uma volta ao mundo em px: o mapa se repete a cada `periodo` no sentido leste–oeste (o
  // tabuleiro desenha cópias lado a lado; a rota de volta cruza para a cópia vizinha).
  readonly periodo: number;
  readonly territorios: Readonly<Record<TerritorioId, GeografiaTerritorio>>;
  readonly paisesDivididos: Readonly<Record<string, string>>;
  readonly fronteiras: readonly TracoFronteira[];
  // Indexadas por chaveDaRota(a, b); só as ligações marítimas e de volta do mapa.
  readonly rotas: Readonly<Record<string, RotaMaritima>>;
  readonly oceanos: readonly { readonly texto: string; readonly ponto: Ponto }[];
  readonly continentes: Readonly<Record<ContinenteId, Ponto>>;
}

export function chaveDaRota(a: TerritorioId, b: TerritorioId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Confere o formato por alto (o JSON é gerado, não editado à mão): números da área e os 43
// territórios com partes, rótulo e caixa. Pega um arquivo velho ou gerado pela metade.
function ehGeografia(valor: unknown): valor is Geografia {
  if (typeof valor !== "object" || valor === null) return false;
  const g = valor as Partial<Record<keyof Geografia, unknown>>;
  if (typeof g.largura !== "number" || typeof g.altura !== "number") return false;
  if (typeof g.periodo !== "number" || g.periodo <= 0) return false;
  if (typeof g.territorios !== "object" || g.territorios === null) return false;
  const territorios = g.territorios as Partial<Record<TerritorioId, Partial<GeografiaTerritorio>>>;
  return IDS_TERRITORIOS.every((id) => {
    const t = territorios[id];
    return Array.isArray(t?.partes) && t.rotulo?.length === 2 && t.caixa?.length === 4;
  });
}

let carregando: Promise<Geografia> | undefined;

export function carregarGeografia(): Promise<Geografia> {
  carregando ??= import("./geografia.json").then((m) => {
    const dados: unknown = m.default;
    if (!ehGeografia(dados)) throw new Error("geografia.json em formato inesperado");
    return dados;
  });
  return carregando;
}
