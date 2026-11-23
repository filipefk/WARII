// As 20 cartas-objetivo (WARII.md §10.1) e os objetivos substitutos (§10.2).
// Cada objetivo é cumprido quando todos os seus requisitos valem ao mesmo tempo.
// A avaliação fica com as regras (etapa 4); aqui só a descrição estruturada.

import type { ContinenteId } from "./continentes.js";
import { CORES, type CorId } from "./cores.js";
import type { TerritorioId } from "./territorios.js";

export type Requisito =
  // Eliminar o último exército da cor (pelo próprio jogador; ver §10.2).
  | { readonly tipo: "destruirCor"; readonly cor: CorId }
  // Todos os territórios de cada continente listado.
  | { readonly tipo: "totalidade"; readonly continentes: readonly ContinenteId[] }
  // Maioria (§6.2) de cada continente listado.
  | { readonly tipo: "maioria"; readonly continentes: readonly ContinenteId[] }
  // Totalidade de pelo menos N continentes quaisquer, contando os de outros requisitos.
  | { readonly tipo: "totalidadeQuaisquer"; readonly quantidade: number }
  // Maioria de pelo menos N continentes quaisquer.
  | { readonly tipo: "maioriaQuaisquer"; readonly quantidade: number }
  // Pelo menos N territórios quaisquer.
  | { readonly tipo: "territorios"; readonly quantidade: number }
  // Pelo menos N centros estratégicos; se houver, cada um com no mínimo M exércitos.
  | { readonly tipo: "centros"; readonly quantidade: number; readonly exercitosEmCada?: number }
  // Possuir cada território listado com no mínimo M exércitos (⚠ "em cada", §10.1).
  | {
      readonly tipo: "exercitosEm";
      readonly territorios: readonly TerritorioId[];
      readonly minimoEmCada: number;
    };

export interface Objetivo {
  // Estável: vai para o banco e para o log das partidas.
  readonly id: string;
  readonly texto: string;
  readonly requisitos: readonly Requisito[];
}

// Ordem das cartas 1–6 (destruir cor), como na ajuda online.
const ORDEM_DESTRUIR: readonly CorId[] = [
  "azul",
  "amarelo",
  "branco",
  "verde",
  "preto",
  "vermelho",
];

const idCarta = (numero: number): string => `obj${String(numero).padStart(2, "0")}`;

const DESTRUIR: readonly Objetivo[] = ORDEM_DESTRUIR.map((cor, i) => {
  const plural = CORES[cor].plural;
  return {
    id: idCarta(i + 1),
    texto:
      `Destruir totalmente os exércitos ${plural.toUpperCase()}. Se os exércitos ${plural} ` +
      "forem seus, ou se outro jogador eliminá-los, o objetivo passa a ser conquistar 24 territórios.",
    requisitos: [{ tipo: "destruirCor", cor }],
  };
});

const DEMAIS: readonly Omit<Objetivo, "id">[] = [
  {
    texto: "Conquistar na totalidade a América do Norte e a África.",
    requisitos: [{ tipo: "totalidade", continentes: ["AN", "AF"] }],
  },
  {
    texto: "Conquistar na totalidade a Ásia e a África.",
    requisitos: [{ tipo: "totalidade", continentes: ["ASI", "AF"] }],
  },
  {
    texto: "Conquistar na totalidade a América do Norte e a Oceania.",
    requisitos: [{ tipo: "totalidade", continentes: ["AN", "OC"] }],
  },
  {
    texto: "Conquistar na totalidade a Ásia e a maioria dos territórios da Europa e da África.",
    requisitos: [
      { tipo: "totalidade", continentes: ["ASI"] },
      { tipo: "maioria", continentes: ["EU", "AF"] },
    ],
  },
  {
    texto: "Conquistar na totalidade a Ásia e a América do Sul.",
    requisitos: [{ tipo: "totalidade", continentes: ["ASI", "AS"] }],
  },
  {
    texto: "Conquistar na totalidade a Europa, a Oceania e mais outro continente qualquer.",
    requisitos: [
      { tipo: "totalidade", continentes: ["EU", "OC"] },
      { tipo: "totalidadeQuaisquer", quantidade: 3 },
    ],
  },
  {
    texto: "Possuir 50 exércitos no Oriente Médio.",
    requisitos: [{ tipo: "exercitosEm", territorios: ["orientemedio"], minimoEmCada: 50 }],
  },
  {
    texto: "Conquistar 24 territórios quaisquer.",
    requisitos: [{ tipo: "territorios", quantidade: 24 }],
  },
  {
    texto: "Conquistar 8 centros estratégicos quaisquer.",
    requisitos: [{ tipo: "centros", quantidade: 8 }],
  },
  {
    texto: "Conquistar a maioria dos territórios da Europa, da Ásia e da América do Norte.",
    requisitos: [{ tipo: "maioria", continentes: ["EU", "ASI", "AN"] }],
  },
  {
    texto:
      "Conquistar na totalidade a América do Sul e a Europa e ter no mínimo 20 exércitos na Alemanha.",
    requisitos: [
      { tipo: "totalidade", continentes: ["AS", "EU"] },
      { tipo: "exercitosEm", territorios: ["alemanha"], minimoEmCada: 20 },
    ],
  },
  {
    texto: "Conquistar a maioria dos territórios em 4 continentes quaisquer.",
    requisitos: [{ tipo: "maioriaQuaisquer", quantidade: 4 }],
  },
  {
    texto: "Conquistar 5 centros estratégicos e ter no mínimo 10 exércitos em cada um.",
    requisitos: [{ tipo: "centros", quantidade: 5, exercitosEmCada: 10 }],
  },
  {
    texto: "Possuir 20 exércitos em Nova York e no Japão.",
    requisitos: [{ tipo: "exercitosEm", territorios: ["novayork", "japao"], minimoEmCada: 20 }],
  },
];

export const OBJETIVOS: readonly Objetivo[] = [
  ...DESTRUIR,
  ...DEMAIS.map((o, i) => ({ id: idCarta(DESTRUIR.length + i + 1), ...o })),
];

// Substitui "destruir cor" quando a cor é do próprio jogador ou outro jogador a elimina (§10.2).
export const OBJETIVO_SUBSTITUTO_DESTRUIR: Objetivo = {
  id: "subst-24-territorios",
  texto: "Conquistar 24 territórios quaisquer.",
  requisitos: [{ tipo: "territorios", quantidade: 24 }],
};

// Opção do manual, desligada por padrão: jogador reduzido a 1 território (§10.2).
export const OBJETIVO_TRES_CENTROS: Objetivo = {
  id: "subst-3-centros",
  texto: "Conquistar 3 centros estratégicos quaisquer.",
  requisitos: [{ tipo: "centros", quantidade: 3 }],
};

const OBJETIVO_POR_ID: ReadonlyMap<string, Objetivo> = new Map(
  [...OBJETIVOS, OBJETIVO_SUBSTITUTO_DESTRUIR, OBJETIVO_TRES_CENTROS].map((o) => [o.id, o]),
);

export function objetivo(id: string): Objetivo | undefined {
  return OBJETIVO_POR_ID.get(id);
}
