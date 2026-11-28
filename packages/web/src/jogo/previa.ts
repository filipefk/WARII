// Pré-visualização local com o engine: diz se uma ação seria aceita e, quando ela não depende de
// sorteio, como fica o estado. Serve para destacar no mapa o que é possível e desabilitar o que o
// servidor recusaria. A resposta oficial é sempre a do servidor.
//
// Nenhuma regra é reescrita aqui: monta-se um estado a partir da visão (com o que é oculto
// preenchido por valores neutros) e chama-se `aplicarAcao` com uma RNG que interrompe no primeiro
// sorteio. As regras conferem tudo antes de sortear, então a interrupção significa "válida".
import {
  type Acao,
  aplicarAcao,
  cartaDeTroca,
  CENTROS_ESTRATEGICOS,
  type CartaId,
  type ErroRegra,
  estadoDaVisao,
  type EstadoPartida,
  type Evento,
  IDS_TERRITORIOS,
  type Rng,
  type TerritorioId,
  territoriosDaCarta,
  type VisaoJogador,
  type VisaoPartida,
  vizinhos,
} from "@warii/engine";

export type Validacao =
  | { tipo: "recusada"; erro: ErroRegra }
  // Válida, mas o resultado depende dos dados ou de um embaralhamento.
  | { tipo: "sorteio" }
  // Válida e determinística: o estado previsto pode ser mostrado.
  | { tipo: "prevista"; estado: EstadoPartida; eventos: readonly Evento[] };

class SorteioNecessario extends Error {}

const RNG_INTERROMPE: Rng = {
  inteiro() {
    throw new SorteioNecessario("sorteio");
  },
};

const SEM_VISAO: ErroRegra = {
  codigo: "JOGADOR_INEXISTENTE",
  mensagem: "Você não joga esta partida",
};

// Cache do estado montado por visão (a visão é trocada inteira a cada lote, nunca alterada).
const estados = new WeakMap<VisaoPartida, EstadoPartida>();

function estadoDe(visao: VisaoPartida): EstadoPartida {
  let estado = estados.get(visao);
  if (!estado) {
    estado = estadoDaVisao(visao);
    estados.set(visao, estado);
  }
  return estado;
}

export function validar(visao: VisaoPartida, acao: Acao): Validacao {
  if (visao.voce === null) return { tipo: "recusada", erro: SEM_VISAO };
  try {
    const r = aplicarAcao(estadoDe(visao), visao.voce, acao, RNG_INTERROMPE);
    if (!r.ok) return { tipo: "recusada", erro: r.erro };
    return { tipo: "prevista", estado: r.estado, eventos: r.eventos };
  } catch (e) {
    if (e instanceof SorteioNecessario) return { tipo: "sorteio" };
    throw e;
  }
}

export const aceita = (v: Validacao): boolean => v.tipo !== "recusada";

// Candidatos para os quais a ação montada seria aceita.
export function filtrarValidos(
  visao: VisaoPartida,
  candidatos: Iterable<TerritorioId>,
  montar: (t: TerritorioId) => Acao,
): TerritorioId[] {
  const r: TerritorioId[] = [];
  for (const t of candidatos) if (aceita(validar(visao, montar(t)))) r.push(t);
  return r;
}

// ---- Consultas para a interface ----

export function euSouDaVez(visao: VisaoPartida): boolean {
  return visao.voce !== null && visao.jogadores[visao.vez]?.id === visao.voce;
}

export function eu(visao: VisaoPartida): VisaoJogador | undefined {
  return visao.jogadores.find((j) => j.id === visao.voce);
}

export function territoriosOcupaveis(visao: VisaoPartida): TerritorioId[] {
  return filtrarValidos(visao, IDS_TERRITORIOS, (t) => ({ tipo: "ocupar", territorio: t }));
}

export function territoriosPosicionaveis(visao: VisaoPartida): TerritorioId[] {
  return filtrarValidos(visao, IDS_TERRITORIOS, (t) => ({
    tipo: "posicionar",
    territorio: t,
    quantidade: 1,
  }));
}

// Maior quantidade aceita por uma ação que varia só na quantidade (busca binária até `teto`).
export function maiorQuantidade(
  visao: VisaoPartida,
  teto: number,
  montar: (quantidade: number) => Acao,
): number {
  if (!aceita(validar(visao, montar(1)))) return 0;
  let baixo = 1;
  let alto = teto;
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2);
    if (aceita(validar(visao, montar(meio)))) baixo = meio;
    else alto = meio - 1;
  }
  return baixo;
}

const TETO_EXERCITOS = 999;

export function maximoPosicionar(visao: VisaoPartida, territorio: TerritorioId): number {
  return maiorQuantidade(visao, TETO_EXERCITOS, (quantidade) => ({
    tipo: "posicionar",
    territorio,
    quantidade,
  }));
}

export function alvosTerrestres(visao: VisaoPartida, origem: TerritorioId): TerritorioId[] {
  return filtrarValidos(visao, vizinhos(origem), (alvo) => ({
    tipo: "atacar",
    origem,
    alvo,
    dados: 1,
  }));
}

export function origensDeAtaque(visao: VisaoPartida): TerritorioId[] {
  return IDS_TERRITORIOS.filter((t) => alvosTerrestres(visao, t).length > 0);
}

// Quantos dados (exércitos) podem atacar de `origem` em `alvo` (0 = ataque impossível).
export function maximoDados(visao: VisaoPartida, origem: TerritorioId, alvo: TerritorioId): number {
  return maiorQuantidade(visao, 3, (dados) => ({ tipo: "atacar", origem, alvo, dados }));
}

export interface CartasDoAtaqueAereo {
  carta: CartaId;
  numericas: CartaId[];
}

export function alvosAereos(
  visao: VisaoPartida,
  daBase: number,
  cartas?: CartasDoAtaqueAereo,
): TerritorioId[] {
  return filtrarValidos(visao, IDS_TERRITORIOS, (alvo) => ({
    tipo: "iniciarAtaqueAereo",
    alvo,
    daBase,
    ...(cartas && { cartas }),
  }));
}

export function candidatosDeDestino(origem: TerritorioId): Set<TerritorioId> {
  const r = new Set(vizinhos(origem));
  if (CENTROS_ESTRATEGICOS.includes(origem)) {
    for (const ce of CENTROS_ESTRATEGICOS) if (ce !== origem) r.add(ce);
  }
  return r;
}

export function destinosDeDeslocamento(visao: VisaoPartida, origem: TerritorioId): TerritorioId[] {
  return filtrarValidos(visao, candidatosDeDestino(origem), (destino) => ({
    tipo: "deslocar",
    origem,
    destino,
    quantidade: 1,
  }));
}

export function origensDeDeslocamento(visao: VisaoPartida): TerritorioId[] {
  return IDS_TERRITORIOS.filter((t) => destinosDeDeslocamento(visao, t).length > 0);
}

export function maximoDeslocar(
  visao: VisaoPartida,
  origem: TerritorioId,
  destino: TerritorioId,
): number {
  return maiorQuantidade(visao, TETO_EXERCITOS, (quantidade) => ({
    tipo: "deslocar",
    origem,
    destino,
    quantidade,
  }));
}

// Deslocamento entre dois CEs que não são vizinhos (aerotransporte).
export function ehAerotransporte(origem: TerritorioId, destino: TerritorioId): boolean {
  return !vizinhos(origem).has(destino);
}

export function territoriosParaReforco(
  visao: VisaoPartida,
  carta: CartaId,
  numericas: CartaId[],
): TerritorioId[] {
  return filtrarValidos(visao, IDS_TERRITORIOS, (territorio) => ({
    tipo: "reforcarComCartas",
    carta,
    territorio,
    numericas,
  }));
}

function territoriosDaCartaId(id: CartaId): readonly TerritorioId[] {
  const carta = cartaDeTroca(id);
  return carta ? territoriosDaCarta(carta) : [];
}

// Pares origem → destino de um transporte com as duas cartas dadas.
export function paresDeTransporte(
  visao: VisaoPartida,
  cartas: [CartaId, CartaId],
): [TerritorioId, TerritorioId][] {
  // Origem e destino estão cada um numa das cartas (em qualquer ordem).
  const a = territoriosDaCartaId(cartas[0]);
  const b = territoriosDaCartaId(cartas[1]);
  const pares = [
    ...a.flatMap((x) => b.map((y): [TerritorioId, TerritorioId] => [x, y])),
    ...b.flatMap((x) => a.map((y): [TerritorioId, TerritorioId] => [x, y])),
  ];
  const r: [TerritorioId, TerritorioId][] = [];
  for (const [origem, destino] of pares) {
    if (origem === destino) continue;
    const acao: Acao = { tipo: "transportarComCartas", cartas, origem, destino, quantidade: 1 };
    if (aceita(validar(visao, acao))) r.push([origem, destino]);
  }
  return r;
}

export function maximoTransportar(
  visao: VisaoPartida,
  cartas: [CartaId, CartaId],
  origem: TerritorioId,
  destino: TerritorioId,
): number {
  return maiorQuantidade(visao, TETO_EXERCITOS, (quantidade) => ({
    tipo: "transportarComCartas",
    cartas,
    origem,
    destino,
    quantidade,
  }));
}

// A mão passou do limite (herança de cartas): só valem usar ou descartar cartas. Usa a contagem
// pública, que também vale na visão de fora (ver interacao.ts).
export function maoAcimaDoLimite(visao: VisaoPartida): boolean {
  return (eu(visao)?.quantidadeCartas ?? 0) > visao.parametros.limiteMao;
}
