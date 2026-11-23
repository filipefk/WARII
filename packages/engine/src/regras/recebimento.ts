// Fase de recebimento (WARII.md §6): o jogador coloca os exércitos livres e os bônus de
// continente. O +1 por CE e os bombardeiros já foram colocados no início da vez (turno.ts).

import { territorio } from "../data/territorios.js";
import { type Contexto, daVez, emitir, exigirProprio } from "./contexto.js";
import type { Recebimento } from "./estado.js";
import { exigir, exigirQuantidade } from "./resultado.js";
import { passarVez } from "./turno.js";

function recebimento(ctx: Contexto): Recebimento {
  const r = ctx.estado.turno.recebimento;
  if (r === null) throw new Error("Estado corrompido: fase de recebimento sem recebimento");
  return r;
}

export function pendenteDeRecebimento(r: Recebimento): number {
  return r.livres + Object.values(r.porContinente).reduce<number>((s, v) => s + (v ?? 0), 0);
}

// Gasta primeiro o bônus do continente do território e depois os livres. Como os livres valem
// em qualquer lugar, essa ordem nunca impede de colocar o resto.
export function posicionar(ctx: Contexto, valor: unknown, quantidade: unknown): void {
  const t = exigirProprio(ctx, valor);
  exigirQuantidade(quantidade);
  const r = recebimento(ctx);
  const continente = territorio(t).continente;
  const doContinente = r.porContinente[continente] ?? 0;
  exigir(
    quantidade <= r.livres + doContinente,
    "EXERCITOS_INSUFICIENTES",
    `Só há ${r.livres + doContinente} exércitos para colocar nesse território`,
  );
  const usarContinente = Math.min(quantidade, doContinente);
  if (doContinente > 0) r.porContinente[continente] = doContinente - usarContinente;
  r.livres -= quantidade - usarContinente;
  ctx.estado.territorios[t].exercitos += quantidade;
  emitir(ctx, { tipo: "exercitosPosicionados", jogador: daVez(ctx).id, territorio: t, quantidade });
}

export function encerrarRecebimento(ctx: Contexto): void {
  const r = recebimento(ctx);
  const faltam = pendenteDeRecebimento(r);
  exigir(faltam === 0, "RECEBIMENTO_PENDENTE", `Ainda faltam ${faltam} exércitos para colocar`);
  const estado = ctx.estado;
  estado.turno.recebimento = null;
  // Etapa 1 da primeira rodada: só recebe e passa a vez (§5.1).
  if (estado.rodada === 1 && estado.etapaPrimeiraRodada === 1) {
    passarVez(ctx);
    return;
  }
  estado.fase = "ATACAR";
  emitir(ctx, { tipo: "faseAlterada", jogador: daVez(ctx).id, fase: "ATACAR" });
}
