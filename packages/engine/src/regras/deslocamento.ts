// Fase de deslocamento (WARII.md §8) e fim da vez (§9.2).

import { saoVizinhos } from "../data/fronteiras.js";
import { territorio } from "../data/territorios.js";
import { comprarCartas } from "./cartas.js";
import { exercitosMoviveis } from "./consultas.js";
import { type Contexto, daVez, emitir, exigirProprio } from "./contexto.js";
import { exigir, exigirQuantidade } from "./resultado.js";
import { passarVez } from "./turno.js";

export function encerrarAtaques(ctx: Contexto): void {
  ctx.estado.fase = "DESLOCAR";
  emitir(ctx, { tipo: "faseAlterada", jogador: daVez(ctx).id, fase: "DESLOCAR" });
}

// Entre territórios próprios vizinhos, ou de um CE próprio para outro (aerotransporte, §8.2).
// O destino soma os que chegaram, e eles não saem mais nesta vez: isso cobre o encadeamento
// terra → terra e as combinações com aerotransporte proibidas em §8.3.
export function deslocar(
  ctx: Contexto,
  valorOrigem: unknown,
  valorDestino: unknown,
  quantidade: unknown,
): void {
  const origem = exigirProprio(ctx, valorOrigem, "Origem");
  const destino = exigirProprio(ctx, valorDestino, "Destino");
  exigir(origem !== destino, "ALVO_INVALIDO", "Origem e destino devem ser diferentes");
  const vizinhos = saoVizinhos(origem, destino);
  const aereo =
    !vizinhos && territorio(origem).centroEstrategico && territorio(destino).centroEstrategico;
  exigir(
    vizinhos || aereo,
    "NAO_VIZINHO",
    "Só entre territórios vizinhos, ou de um CE para outro por aerotransporte",
  );
  exigirQuantidade(quantidade);
  const maximo = exercitosMoviveis(ctx.estado, origem);
  exigir(
    quantidade <= maximo,
    "EXERCITOS_INSUFICIENTES",
    `Dá para mover até ${maximo} exércitos daí nesta vez`,
  );
  ctx.estado.territorios[origem].exercitos -= quantidade;
  const d = ctx.estado.territorios[destino];
  d.exercitos += quantidade;
  d.chegaramNoTurno += quantidade;
  emitir(ctx, { tipo: "deslocamento", jogador: daVez(ctx).id, origem, destino, quantidade, aereo });
}

export function encerrarJogada(ctx: Contexto): void {
  comprarCartas(ctx);
  passarVez(ctx);
}
