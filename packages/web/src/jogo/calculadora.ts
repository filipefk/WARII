// Calculadora de reforços do guia de regras. Em vez de repetir a conta no front, monta um estado de
// exemplo em que um jogador fictício tem os territórios, CEs e continentes pedidos e chama
// `calcularRecebimento` do engine com os parâmetros da partida.
import {
  calcularRecebimento,
  type CalculoRecebimento,
  CENTROS_ESTRATEGICOS,
  CONTINENTES,
  type ContinenteId,
  estadoDaVisao,
  IDS_CONTINENTES,
  IDS_TERRITORIOS,
  type TerritorioId,
  territorio as dadosDoTerritorio,
  territoriosDoContinente,
  type VisaoPartida,
} from "@warii/engine";

export type Dominio = "maioria" | "totalidade";

export interface PedidoDeCalculo {
  territorios: number;
  centros: number;
  continentes: Partial<Record<ContinenteId, Dominio>>;
}

export type ResultadoDoCalculo =
  { ok: true; calculo: CalculoRecebimento } | { ok: false; mensagem: string };

const JOGADOR = "calculadora";
const ehCentro = (t: TerritorioId) => dadosDoTerritorio(t).centroEstrategico;

// Quantos territórios o jogador pode ter em cada continente sem mudar o domínio pedido.
function limites(c: ContinenteId, dominio: Dominio | undefined): [number, number] {
  const n = territoriosDoContinente(c).length;
  const maioria = CONTINENTES[c].maioriaMinima;
  if (dominio === "totalidade") return [n, n];
  if (dominio === "maioria") return [maioria, n - 1];
  return [0, maioria - 1];
}

// Escolhe os territórios do jogador fictício: o mínimo de cada continente, depois o que faltar,
// sempre preferindo CEs enquanto não se chega à quantidade pedida.
function escolherTerritorios(pedido: PedidoDeCalculo): TerritorioId[] | string {
  const { territorios: total, centros } = pedido;
  const faixas = IDS_CONTINENTES.map((c) => limites(c, pedido.continentes[c]));
  const minimo = faixas.reduce((s, [a]) => s + a, 0);
  const maximo = faixas.reduce((s, [, b]) => s + b, 0);
  if (minimo > total) return `Os continentes escolhidos exigem pelo menos ${minimo} territórios.`;
  if (maximo < total) {
    return `Com ${total} territórios não dá para ficar só com esses continentes: o máximo é ${maximo}.`;
  }
  const escolhidos = new Set<TerritorioId>();
  const noContinente = (c: ContinenteId) =>
    territoriosDoContinente(c).filter((t) => escolhidos.has(t)).length;
  const centrosEscolhidos = () => [...escolhidos].filter(ehCentro).length;
  const ordenar = (ts: readonly TerritorioId[]) =>
    ts.toSorted((a, b) => {
      const querCentro = centrosEscolhidos() < centros;
      return Number(ehCentro(b) === querCentro) - Number(ehCentro(a) === querCentro);
    });
  // Os continentes inteiros primeiro: os CEs deles são obrigatórios.
  const ordemDosMinimos = IDS_CONTINENTES.toSorted(
    (a, b) =>
      Number(pedido.continentes[b] === "totalidade") -
      Number(pedido.continentes[a] === "totalidade"),
  );
  for (const c of ordemDosMinimos) {
    const [a] = faixas[IDS_CONTINENTES.indexOf(c)] ?? [0, 0];
    for (const t of ordenar(territoriosDoContinente(c)).slice(0, a)) escolhidos.add(t);
  }
  while (escolhidos.size < total) {
    const livres = IDS_TERRITORIOS.filter((t) => {
      if (escolhidos.has(t)) return false;
      const c = dadosDoTerritorio(t).continente;
      return noContinente(c) < (faixas[IDS_CONTINENTES.indexOf(c)]?.[1] ?? 0);
    });
    const proximo = ordenar(livres)[0];
    if (proximo === undefined) break;
    escolhidos.add(proximo);
  }
  const obtidos = centrosEscolhidos();
  if (obtidos !== centros) {
    return obtidos > centros
      ? `Com esses continentes o jogador tem pelo menos ${obtidos} CEs.`
      : `Com esses números o jogador tem no máximo ${obtidos} CEs.`;
  }
  return [...escolhidos];
}

export function calcularReforcos(visao: VisaoPartida, pedido: PedidoDeCalculo): ResultadoDoCalculo {
  const { territorios, centros } = pedido;
  if (!Number.isInteger(territorios) || territorios < 1 || territorios > IDS_TERRITORIOS.length) {
    return { ok: false, mensagem: `O número de territórios vai de 1 a ${IDS_TERRITORIOS.length}.` };
  }
  if (
    !Number.isInteger(centros) ||
    centros < 0 ||
    centros > CENTROS_ESTRATEGICOS.length ||
    centros > territorios
  ) {
    return {
      ok: false,
      mensagem: `Os CEs vão de 0 a ${CENTROS_ESTRATEGICOS.length} e não podem passar do número de territórios.`,
    };
  }
  const escolha = escolherTerritorios(pedido);
  if (typeof escolha === "string") return { ok: false, mensagem: escolha };
  const meus = new Set(escolha);
  // estadoDaVisao já devolve uma cópia: pode ser alterada à vontade.
  const estado = estadoDaVisao(visao);
  for (const t of IDS_TERRITORIOS) estado.territorios[t].dono = meus.has(t) ? JOGADOR : null;
  return { ok: true, calculo: calcularRecebimento(estado, JOGADOR) };
}
