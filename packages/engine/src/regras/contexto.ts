// Uso interno: contexto de aplicação de uma ação (cópia do estado, eventos emitidos e RNG) e
// validações comuns às regras.

import { cartaDeTroca, type CartaDeTroca, type CartaId } from "../data/cartas.js";
import { ehTerritorioId, type TerritorioId } from "../data/territorios.js";
import { jogadorDaVez } from "./consultas.js";
import type { EstadoJogador, EstadoPartida, EstadoTerritorio } from "./estado.js";
import type { Evento } from "./eventos.js";
import { exigir } from "./resultado.js";
import type { Rng } from "./rng.js";

export interface Contexto {
  // Cópia do estado de entrada: as regras a alteram livremente.
  readonly estado: EstadoPartida;
  readonly eventos: Evento[];
  readonly rng: Rng;
}

export function emitir(ctx: Contexto, evento: Evento): void {
  ctx.eventos.push(evento);
}

export function daVez(ctx: Contexto): EstadoJogador {
  return jogadorDaVez(ctx.estado);
}

export function exigirTerritorio(valor: unknown, nome = "Território"): TerritorioId {
  exigir(
    typeof valor === "string" && ehTerritorioId(valor),
    "TERRITORIO_INVALIDO",
    `${nome} inexistente`,
  );
  return valor;
}

export function territorioDe(ctx: Contexto, t: TerritorioId): EstadoTerritorio {
  return ctx.estado.territorios[t];
}

export function exigirProprio(ctx: Contexto, valor: unknown, nome = "Território"): TerritorioId {
  const t = exigirTerritorio(valor, nome);
  exigir(territorioDe(ctx, t).dono === daVez(ctx).id, "NAO_E_SEU", `${nome} não é seu`);
  return t;
}

// Confere que as cartas existem, são distintas e estão na mão do jogador da vez.
export function exigirCartasNaMao(ctx: Contexto, ids: readonly unknown[]): CartaDeTroca[] {
  const mao = daVez(ctx).cartas;
  exigir(new Set(ids).size === ids.length, "CARTA_INVALIDA", "Carta repetida");
  return ids.map((id) => {
    const carta = typeof id === "string" ? cartaDeTroca(id) : undefined;
    exigir(carta !== undefined, "CARTA_INVALIDA", "Carta inexistente");
    exigir(mao.includes(carta.id), "CARTA_INVALIDA", `A carta ${carta.nome} não está na sua mão`);
    return carta;
  });
}

export function idsDasCartas(cartas: readonly CartaDeTroca[]): CartaId[] {
  return cartas.map((c) => c.id);
}
