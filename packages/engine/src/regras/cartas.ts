// Cartas de troca (WARII.md §9): combinação carta de território + numéricas, reforço (A),
// transporte (C), descarte, reembaralho e compra. O uso B (bombardeiros) fica em ataqueAereo.ts.

import type { CartaDeTroca, CartaId } from "../data/cartas.js";
import type { TerritorioId } from "../data/territorios.js";
import { exercitosMoviveis, territoriosDaCarta } from "./consultas.js";
import {
  type Contexto,
  daVez,
  emitir,
  exigirCartasNaMao,
  exigirProprio,
  idsDasCartas,
} from "./contexto.js";
import { exigir, exigirQuantidade } from "./resultado.js";
import { embaralhar } from "./rng.js";

export interface Combinacao {
  readonly carta: CartaDeTroca;
  readonly numericas: readonly CartaDeTroca[];
  // 1 + soma das numéricas (§9.3 A e B).
  readonly valor: number;
}

// Uma carta de território (ou continente) com quantas numéricas quiser; numérica nunca sozinha.
export function exigirCombinacao(
  ctx: Contexto,
  cartaId: unknown,
  numericasIds: readonly unknown[] = [],
): Combinacao {
  exigir(Array.isArray(numericasIds), "CARTA_INVALIDA", "Lista de numéricas inválida");
  const [carta, ...numericas] = exigirCartasNaMao(ctx, [cartaId, ...numericasIds]);
  exigir(
    carta !== undefined && carta.tipo !== "numerica",
    "CARTA_INVALIDA",
    "A carta numérica precisa acompanhar uma carta de território",
  );
  let valor = 1;
  for (const n of numericas) {
    exigir(n.tipo === "numerica", "CARTA_INVALIDA", "Só cartas numéricas se somam à carta");
    valor += n.valor;
  }
  return { carta, numericas, valor };
}

export function idsDaCombinacao(c: Combinacao): CartaId[] {
  return [c.carta.id, ...idsDasCartas(c.numericas)];
}

// Tira as cartas da mão e as põe no descarte; com o descarte cheio, ele volta ao monte (§9.4).
export function descartarCartas(ctx: Contexto, ids: readonly CartaId[]): void {
  const j = daVez(ctx);
  j.cartas = j.cartas.filter((c) => !ids.includes(c));
  porNoDescarte(ctx, ids);
}

// Põe cartas (já fora de qualquer mão) no descarte; com o descarte cheio, ele volta ao monte.
export function porNoDescarte(ctx: Contexto, ids: readonly CartaId[]): void {
  ctx.estado.descarte.push(...ids);
  if (ctx.estado.descarte.length >= ctx.estado.parametros.tamanhoDescarteReembaralhar) {
    reembaralharDescarte(ctx);
  }
}

function reembaralharDescarte(ctx: Contexto): void {
  const estado = ctx.estado;
  const quantidade = estado.descarte.length;
  estado.monte = embaralhar(ctx.rng, [...estado.monte, ...estado.descarte]);
  estado.descarte = [];
  emitir(ctx, { tipo: "descarteReembaralhado", quantidade });
}

// A) Reforço: +1 + numéricas num território próprio da carta (§9.3 A).
export function reforcarComCartas(
  ctx: Contexto,
  cartaId: unknown,
  valorTerritorio: unknown,
  numericas: readonly unknown[],
): void {
  const t = exigirProprio(ctx, valorTerritorio);
  const c = exigirCombinacao(ctx, cartaId, numericas);
  exigir(
    territoriosDaCarta(c.carta).includes(t),
    "CARTA_INVALIDA",
    `O território não está na carta ${c.carta.nome}`,
  );
  const ids = idsDaCombinacao(c);
  ctx.estado.territorios[t].exercitos += c.valor;
  descartarCartas(ctx, ids);
  emitir(ctx, {
    tipo: "reforcoComCartas",
    jogador: daVez(ctx).id,
    cartas: ids,
    territorio: t,
    quantidade: c.valor,
  });
}

const em = (c: CartaDeTroca, t: TerritorioId): boolean => territoriosDaCarta(c).includes(t);

// C) Transporte: 2 cartas de territórios próprios levam exércitos de um para o outro (§9.3 C).
export function transportarComCartas(
  ctx: Contexto,
  cartasIds: readonly unknown[],
  valorOrigem: unknown,
  valorDestino: unknown,
  quantidade: unknown,
): void {
  exigir(
    Array.isArray(cartasIds) && cartasIds.length === 2,
    "CARTA_INVALIDA",
    "O transporte usa 2 cartas de território",
  );
  const origem = exigirProprio(ctx, valorOrigem, "Origem");
  const destino = exigirProprio(ctx, valorDestino, "Destino");
  exigir(origem !== destino, "ALVO_INVALIDO", "Origem e destino devem ser diferentes");
  const [c1, c2] = exigirCartasNaMao(ctx, cartasIds);
  exigir(
    c1 !== undefined && c2 !== undefined && c1.tipo !== "numerica" && c2.tipo !== "numerica",
    "CARTA_INVALIDA",
    "O transporte usa 2 cartas de território",
  );
  exigir(
    (em(c1, origem) && em(c2, destino)) || (em(c2, origem) && em(c1, destino)),
    "CARTA_INVALIDA",
    "Origem e destino devem ser os territórios das 2 cartas",
  );
  exigirQuantidade(quantidade);
  const p = ctx.estado.parametros;
  const o = ctx.estado.territorios[origem];
  // ⚠ §9.3 C: por padrão, o transporte por cartas conta para o movimento único.
  const maximo = p.transporteCartasContaMovimento
    ? exercitosMoviveis(ctx.estado, origem)
    : o.exercitos - 1;
  exigir(quantidade <= maximo, "EXERCITOS_INSUFICIENTES", `Dá para transportar até ${maximo}`);
  o.exercitos -= quantidade;
  const d = ctx.estado.territorios[destino];
  d.exercitos += quantidade;
  if (p.transporteCartasContaMovimento) d.chegaramNoTurno += quantidade;
  const ids = [c1.id, c2.id];
  descartarCartas(ctx, ids);
  emitir(ctx, {
    tipo: "transporteComCartas",
    jogador: daVez(ctx).id,
    cartas: ids,
    origem,
    destino,
    quantidade,
  });
}

// Descarte voluntário, a qualquer momento da própria vez (§9.2).
export function descartar(ctx: Contexto, cartasIds: readonly unknown[]): void {
  exigir(
    Array.isArray(cartasIds) && cartasIds.length > 0,
    "CARTA_INVALIDA",
    "Escolha as cartas a descartar",
  );
  const ids = idsDasCartas(exigirCartasNaMao(ctx, cartasIds));
  descartarCartas(ctx, ids);
  emitir(ctx, { tipo: "cartasDescartadas", jogador: daVez(ctx).id, cartas: ids });
}

// Compra no fim da vez: 3 cartas se houve conquista, sem passar do limite da mão (§9.2). Se o
// monte acabar, o descarte volta a ele mesmo abaixo do tamanho de reembaralho.
export function comprarCartas(ctx: Contexto): void {
  const estado = ctx.estado;
  const j = daVez(ctx);
  if (!estado.turno.conquistou) return;
  const p = estado.parametros;
  const quantidade = Math.min(p.cartasPorConquista, Math.max(0, p.limiteMao - j.cartas.length));
  const compradas: CartaId[] = [];
  for (let k = 0; k < quantidade; k++) {
    if (estado.monte.length === 0 && estado.descarte.length > 0) reembaralharDescarte(ctx);
    const carta = estado.monte.shift();
    if (carta === undefined) break;
    compradas.push(carta);
  }
  if (compradas.length === 0) return;
  j.cartas.push(...compradas);
  emitir(ctx, {
    tipo: "cartasCompradas",
    jogador: j.id,
    cartas: compradas,
    quantidade: compradas.length,
  });
}
