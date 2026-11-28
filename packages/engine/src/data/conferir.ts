// Conferência dos dados estáticos contra WARII.md. Devolve a lista de problemas (vazia = tudo certo).
// Roda no script `pnpm conferir` e no início do servidor, que se recusa a subir com dados errados.

import { CARTAS_DE_TROCA, QUANTIDADE_NUMERICAS, VALORES_NUMERICOS } from "./cartas.js";
import { CONTINENTES, IDS_CONTINENTES, type ContinenteId } from "./continentes.js";
import { IDS_CORES } from "./cores.js";
import {
  type Dado,
  DADOS,
  FACES_ANTIAEREO_PADRAO,
  FACES_ATAQUE_AEREO_PADRAO,
  FACES_D6,
} from "./dados.js";
import { FRONTEIRAS, saoVizinhos, vizinhos } from "./fronteiras.js";
import {
  OBJETIVO_SUBSTITUTO_DESTRUIR,
  OBJETIVO_TRES_CENTROS,
  OBJETIVOS,
  type Requisito,
} from "./objetivos.js";
import {
  CENTROS_ESTRATEGICOS,
  IDS_TERRITORIOS,
  ehTerritorioId,
  territorio,
  TERRITORIOS,
  type TerritorioId,
  territoriosDoContinente,
} from "./territorios.js";

// Valores esperados, transcritos de WARII.md.
const ESPERADO = {
  territorios: 43,
  // §3.2
  territoriosPorContinente: { AN: 10, AS: 4, EU: 7, AF: 6, ASI: 12, OC: 4 },
  // §3.1 e §3.2
  centros: [
    "ottawa",
    "novayork",
    "brasil",
    "inglaterra",
    "moscou",
    "alemanha",
    "egito",
    "africadosul",
    "orientemedio",
    "china",
    "japao",
    "australia",
  ],
  centrosPorContinente: { AN: 2, AS: 1, EU: 3, AF: 2, ASI: 3, OC: 1 },
  // §6.2: [bônus maioria, bônus totalidade]
  bonus: { AN: [5, 7], AS: [2, 3], EU: [5, 7], AF: [3, 4], ASI: [7, 10], OC: [2, 3] },
  // §3.3 (rascunho de adjacências)
  fronteiras: 81,
  fronteirasCitadas: [
    ["alasca", "vladivostok"],
    ["mexico", "venezuela"],
  ],
  // §9.1
  cartas: 61,
  cartasTerritorio: 27,
  cartasCentro: 12,
  cartasContinente: 6,
  numericas: { 2: 10, 3: 8, 4: 6, 5: 4 },
  // §10.1
  objetivos: 20,
} as const satisfies {
  territoriosPorContinente: Record<ContinenteId, number>;
  centros: readonly TerritorioId[];
  centrosPorContinente: Record<ContinenteId, number>;
  bonus: Record<ContinenteId, readonly [number, number]>;
  fronteirasCitadas: readonly (readonly [TerritorioId, TerritorioId])[];
  [chave: string]: unknown;
};

function duplicados(valores: readonly string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const v of valores) {
    if (vistos.has(v)) repetidos.add(v);
    vistos.add(v);
  }
  return [...repetidos];
}

// Sem o type guard de ehTerritorioId: o id já é TerritorioId e viraria `never` na mensagem.
const existeTerritorio = (id: string): boolean => ehTerritorioId(id);

const mesmaSequencia = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

function conferirTerritorios(erros: string[]): void {
  if (TERRITORIOS.length !== ESPERADO.territorios) {
    erros.push(`Territórios: ${TERRITORIOS.length}, esperado ${ESPERADO.territorios} (§3.2).`);
  }
  for (const id of duplicados(IDS_TERRITORIOS)) erros.push(`Território com id repetido: ${id}.`);

  for (const c of IDS_CONTINENTES) {
    const territorios = territoriosDoContinente(c);
    const esperado = ESPERADO.territoriosPorContinente[c];
    if (territorios.length !== esperado) {
      erros.push(
        `${CONTINENTES[c].nome}: ${territorios.length} territórios, esperado ${esperado} (§3.2).`,
      );
    }
    const centros = territorios.filter((t) => territorio(t).centroEstrategico).length;
    if (centros !== ESPERADO.centrosPorContinente[c]) {
      erros.push(
        `${CONTINENTES[c].nome}: ${centros} CEs, esperado ${ESPERADO.centrosPorContinente[c]} (§3.1).`,
      );
    }
  }

  const centros = CENTROS_ESTRATEGICOS.toSorted();
  const esperados = ESPERADO.centros.toSorted();
  if (!mesmaSequencia(centros, esperados)) {
    erros.push(`CEs diferentes de §3.2: ${centros.join(", ")}.`);
  }
}

function conferirContinentes(erros: string[]): void {
  for (const c of IDS_CONTINENTES) {
    const continente = CONTINENTES[c];
    if (continente.id !== c) erros.push(`Continente ${c} com id interno ${continente.id}.`);
    const n = territoriosDoContinente(c).length;
    const maioria = Math.floor(n / 2) + 1;
    if (continente.maioriaMinima !== maioria) {
      erros.push(
        `${continente.nome}: maioria mínima ${continente.maioriaMinima}, esperado ${maioria} (mais da metade de ${n}, §6.2).`,
      );
    }
    const [bonusMaioria, bonusTotalidade] = ESPERADO.bonus[c];
    if (
      continente.bonusMaioria !== bonusMaioria ||
      continente.bonusTotalidade !== bonusTotalidade
    ) {
      erros.push(
        `${continente.nome}: bônus ${continente.bonusMaioria}/${continente.bonusTotalidade}, esperado ${bonusMaioria}/${bonusTotalidade} (§6.2).`,
      );
    }
    if (continente.bonusTotalidade <= continente.bonusMaioria) {
      erros.push(`${continente.nome}: bônus de totalidade deve ser maior que o de maioria.`);
    }
  }
}

function conferirFronteiras(erros: string[]): void {
  if (FRONTEIRAS.length !== ESPERADO.fronteiras) {
    erros.push(`Fronteiras: ${FRONTEIRAS.length}, esperado ${ESPERADO.fronteiras} (§3.3).`);
  }
  const pares: string[] = [];
  for (const [a, b] of FRONTEIRAS) {
    if (!existeTerritorio(a) || !existeTerritorio(b)) {
      erros.push(`Fronteira com território inexistente: ${a}–${b}.`);
    }
    if (a === b) erros.push(`Fronteira de um território com ele mesmo: ${a}.`);
    pares.push([a, b].toSorted().join("–"));
  }
  // Um par repetido (em qualquer ordem) indicaria cópia errada; o grafo é montado nos dois sentidos.
  for (const par of duplicados(pares)) erros.push(`Fronteira repetida: ${par}.`);

  for (const id of IDS_TERRITORIOS) {
    if (vizinhos(id).size === 0) erros.push(`Território sem vizinhos: ${id}.`);
    for (const v of vizinhos(id)) {
      if (!saoVizinhos(v, id)) erros.push(`Fronteira não simétrica: ${id}–${v}.`);
    }
  }

  for (const [a, b] of ESPERADO.fronteirasCitadas) {
    if (!saoVizinhos(a, b)) erros.push(`Falta a fronteira ${a}–${b}, citada nas regras (§3.3).`);
  }

  // Grafo conexo: todo território alcançável a partir do primeiro.
  const inicio = IDS_TERRITORIOS[0];
  if (inicio !== undefined) {
    const alcancados = new Set<TerritorioId>([inicio]);
    const fila: TerritorioId[] = [inicio];
    for (let atual = fila.shift(); atual !== undefined; atual = fila.shift()) {
      for (const v of vizinhos(atual)) {
        if (!alcancados.has(v)) {
          alcancados.add(v);
          fila.push(v);
        }
      }
    }
    const isolados = IDS_TERRITORIOS.filter((id) => !alcancados.has(id));
    if (isolados.length > 0) erros.push(`Mapa desconexo; fora do alcance: ${isolados.join(", ")}.`);
  }
}

function conferirCartas(erros: string[]): void {
  if (CARTAS_DE_TROCA.length !== ESPERADO.cartas) {
    erros.push(`Cartas de troca: ${CARTAS_DE_TROCA.length}, esperado ${ESPERADO.cartas} (§9.1).`);
  }
  for (const id of duplicados(CARTAS_DE_TROCA.map((c) => c.id)))
    erros.push(`Carta com id repetido: ${id}.`);

  const deTerritorio = CARTAS_DE_TROCA.filter((c) => c.tipo === "territorio");
  const deContinente = CARTAS_DE_TROCA.filter((c) => c.tipo === "continente");
  const numericas = CARTAS_DE_TROCA.filter((c) => c.tipo === "numerica");

  if (deTerritorio.length !== ESPERADO.cartasTerritorio) {
    erros.push(
      `Cartas de território: ${deTerritorio.length}, esperado ${ESPERADO.cartasTerritorio} (§9.1).`,
    );
  }

  // As cartas de território particionam o mapa: cada território em exatamente uma carta.
  const cartasDoTerritorio = new Map<string, string[]>();
  for (const carta of deTerritorio) {
    if (carta.territorios.length === 0) erros.push(`Carta sem território: ${carta.id}.`);
    for (const t of carta.territorios) {
      if (!existeTerritorio(t)) erros.push(`Carta ${carta.id} com território inexistente: ${t}.`);
      cartasDoTerritorio.set(t, [...(cartasDoTerritorio.get(t) ?? []), carta.id]);
    }
    if (carta.centro !== undefined) {
      if (!carta.territorios.includes(carta.centro)) {
        erros.push(`Carta ${carta.id}: o CE ${carta.centro} não está entre os seus territórios.`);
      }
      if (!territorio(carta.centro).centroEstrategico) {
        erros.push(`Carta ${carta.id}: ${carta.centro} não é centro estratégico.`);
      }
    }
    // Uma carta que contém um CE é carta de CE e precisa marcá-lo.
    const centrosNaCarta = carta.territorios.filter((t) => territorio(t).centroEstrategico);
    if (centrosNaCarta.length > 1) erros.push(`Carta ${carta.id} com mais de um CE.`);
    if (centrosNaCarta.length === 1 && carta.centro !== centrosNaCarta[0]) {
      erros.push(`Carta ${carta.id} contém o CE ${centrosNaCarta[0]} mas não o marca.`);
    }
  }
  for (const id of IDS_TERRITORIOS) {
    const cartas = cartasDoTerritorio.get(id) ?? [];
    if (cartas.length !== 1) {
      erros.push(
        `Território ${id} aparece em ${cartas.length} cartas (${cartas.join(", ") || "nenhuma"}).`,
      );
    }
  }

  const deCentro = deTerritorio.filter((c) => c.centro !== undefined);
  if (deCentro.length !== ESPERADO.cartasCentro) {
    erros.push(`Cartas de CE: ${deCentro.length}, esperado ${ESPERADO.cartasCentro} (§9.1).`);
  }

  if (deContinente.length !== ESPERADO.cartasContinente) {
    erros.push(
      `Cartas de continente: ${deContinente.length}, esperado ${ESPERADO.cartasContinente} (§9.1).`,
    );
  }
  for (const c of IDS_CONTINENTES) {
    const n = deContinente.filter((carta) => carta.continente === c).length;
    if (n !== 1) erros.push(`Continente ${c} com ${n} cartas de continente.`);
  }

  for (const valor of VALORES_NUMERICOS) {
    const n = numericas.filter((c) => c.valor === valor).length;
    const esperado = ESPERADO.numericas[valor];
    if (n !== esperado || QUANTIDADE_NUMERICAS[valor] !== esperado) {
      erros.push(`Cartas numéricas +${valor}: ${n}, esperado ${esperado} (§9.1).`);
    }
  }
}

function conferirRequisito(onde: string, r: Requisito, erros: string[]): void {
  const positivo = (n: number, campo: string): void => {
    if (!Number.isInteger(n) || n <= 0) erros.push(`${onde}: ${campo} deve ser inteiro positivo.`);
  };
  switch (r.tipo) {
    case "destruirCor":
      if (!IDS_CORES.includes(r.cor)) erros.push(`${onde}: cor inexistente ${r.cor}.`);
      break;
    case "totalidade":
    case "maioria":
      if (r.continentes.length === 0) erros.push(`${onde}: requisito sem continentes.`);
      for (const c of r.continentes) {
        if (!IDS_CONTINENTES.includes(c)) erros.push(`${onde}: continente inexistente ${c}.`);
      }
      break;
    case "totalidadeQuaisquer":
    case "maioriaQuaisquer":
      positivo(r.quantidade, "quantidade");
      if (r.quantidade > IDS_CONTINENTES.length)
        erros.push(`${onde}: mais continentes que o mapa tem.`);
      break;
    case "territorios":
      positivo(r.quantidade, "quantidade");
      if (r.quantidade > TERRITORIOS.length)
        erros.push(`${onde}: mais territórios que o mapa tem.`);
      break;
    case "centros":
      positivo(r.quantidade, "quantidade");
      if (r.quantidade > CENTROS_ESTRATEGICOS.length)
        erros.push(`${onde}: mais CEs que o mapa tem.`);
      if (r.exercitosEmCada !== undefined) positivo(r.exercitosEmCada, "exércitos em cada");
      break;
    case "exercitosEm":
      positivo(r.minimoEmCada, "mínimo em cada");
      if (r.territorios.length === 0) erros.push(`${onde}: requisito sem territórios.`);
      for (const t of r.territorios) {
        if (!existeTerritorio(t)) erros.push(`${onde}: território inexistente ${t}.`);
      }
      break;
  }
}

function conferirObjetivos(erros: string[]): void {
  if (OBJETIVOS.length !== ESPERADO.objetivos) {
    erros.push(`Cartas-objetivo: ${OBJETIVOS.length}, esperado ${ESPERADO.objetivos} (§10.1).`);
  }
  const todos = [...OBJETIVOS, OBJETIVO_SUBSTITUTO_DESTRUIR, OBJETIVO_TRES_CENTROS];
  for (const id of duplicados(todos.map((o) => o.id)))
    erros.push(`Objetivo com id repetido: ${id}.`);

  for (const o of todos) {
    if (o.requisitos.length === 0) erros.push(`Objetivo ${o.id} sem requisitos.`);
    for (const r of o.requisitos) conferirRequisito(`Objetivo ${o.id}`, r, erros);
  }

  // Cada cor tem exatamente uma carta "destruir".
  const coresDestruir = OBJETIVOS.flatMap((o) =>
    o.requisitos.flatMap((r) => (r.tipo === "destruirCor" ? [r.cor] : [])),
  );
  for (const cor of IDS_CORES) {
    const n = coresDestruir.filter((c) => c === cor).length;
    if (n !== 1) erros.push(`Cor ${cor} com ${n} cartas "destruir" (§10.1).`);
  }
}

function conferirDadosDoJogo(erros: string[]): void {
  const dados: Readonly<Record<string, Dado>> = DADOS;
  for (const [nome, dado] of Object.entries(dados)) {
    if (dado.faces.length !== 6) erros.push(`Dado ${nome} com ${dado.faces.length} faces.`);
  }
  if (
    !mesmaSequencia(DADOS.ataqueTerrestre.faces, FACES_D6) ||
    !mesmaSequencia(DADOS.defesaTerrestre.faces, FACES_D6)
  ) {
    erros.push("Dados terrestres devem ser d6 comuns (§2).");
  }
  if (!mesmaSequencia(FACES_ATAQUE_AEREO_PADRAO, [0, 0, 0, 1, 2, 3])) {
    erros.push("Faces padrão do ataque aéreo diferentes de [0,0,0,1,2,3] (§13.4).");
  }
  if (!mesmaSequencia(FACES_ANTIAEREO_PADRAO, [0, 0, 0, 1, 2, 3])) {
    erros.push("Faces padrão da antiaérea diferentes de [0,0,0,1,2,3] (§13.4).");
  }
  const total = Object.values(dados).reduce((soma, d) => soma + d.quantidade, 0);
  if (total !== 8) erros.push(`Total de dados: ${total}, esperado 8 (§2).`);
}

export function conferirDados(): string[] {
  const erros: string[] = [];
  conferirTerritorios(erros);
  conferirContinentes(erros);
  conferirFronteiras(erros);
  conferirCartas(erros);
  conferirObjetivos(erros);
  conferirDadosDoJogo(erros);
  return erros;
}
