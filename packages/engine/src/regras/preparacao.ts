// Preparação (WARII.md §4): escolha do caso de 5 jogadores, ocupação dos vagos, sorteio dos
// objetivos e primeiro jogador. A criação da partida (distribuidor e CEs) fica em criar.ts.

import { CARTAS_DE_TROCA, cartaDeTroca } from "../data/cartas.js";
import { OBJETIVO_SUBSTITUTO_DESTRUIR, OBJETIVOS } from "../data/objetivos.js";
import { territorio } from "../data/territorios.js";
import { territoriosVagos } from "./consultas.js";
import { type Contexto, daVez, emitir, exigirTerritorio, territorioDe } from "./contexto.js";
import type { EstadoPreparacao } from "./estado.js";
import { exigir } from "./resultado.js";
import { embaralhar } from "./rng.js";
import { iniciarVez } from "./turno.js";

function preparacao(ctx: Contexto): EstadoPreparacao {
  const p = ctx.estado.preparacao;
  if (p === null) throw new Error("Estado corrompido: fase de preparação sem dados");
  return p;
}

// Depois de 3 escolhas (b), só resta a (a) enquanto houver carta extra (regra do manual).
function opcaoBPermitida(ctx: Contexto): boolean {
  const p = preparacao(ctx);
  return !(
    ctx.estado.parametros.cincoJogadoresRestricaoManual &&
    p.escolhasB >= 3 &&
    p.centrosExtras.length > 0
  );
}

// Opção (a): pegar uma das cartas de CE que sobraram e pôr 2 exércitos no CE (§4.3).
export function pegarCentroExtra(ctx: Contexto, cartaId: unknown): void {
  const p = preparacao(ctx);
  const carta = typeof cartaId === "string" ? cartaDeTroca(cartaId) : undefined;
  exigir(
    carta?.tipo === "territorio" &&
      carta.centro !== undefined &&
      p.centrosExtras.includes(carta.id),
    "CARTA_INVALIDA",
    "Essa carta de CE não está entre as que sobraram",
  );
  const ce = carta.centro;
  if (ce === undefined) throw new Error("Carta de CE sem centro");
  p.centrosExtras = p.centrosExtras.filter((c) => c !== carta.id);
  const j = daVez(ctx);
  ctx.estado.territorios[ce] = { dono: j.id, exercitos: 2, chegaramNoTurno: 0 };
  emitir(ctx, { tipo: "centroExtraEscolhido", jogador: j.id, carta: carta.id, territorio: ce });
  proximaEscolha(ctx);
}

// Opção (b): 2 territórios vagos, sem CE e de continentes diferentes, 1 exército em cada (§4.3).
export function ocuparDoisVagos(ctx: Contexto, territorios: readonly unknown[]): void {
  exigir(
    Array.isArray(territorios) && territorios.length === 2,
    "QUANTIDADE_INVALIDA",
    "Escolha 2 territórios",
  );
  exigir(opcaoBPermitida(ctx), "ACAO_BLOQUEADA", "Já houve 3 escolhas (b): só resta a opção (a)");
  const a = exigirTerritorio(territorios[0]);
  const b = exigirTerritorio(territorios[1]);
  for (const t of [a, b]) {
    exigir(territorioDe(ctx, t).dono === null, "TERRITORIO_OCUPADO", "Território já ocupado");
    exigir(!territorio(t).centroEstrategico, "ALVO_INVALIDO", "Na opção (b) não vale CE");
  }
  exigir(
    territorio(a).continente !== territorio(b).continente,
    "ALVO_INVALIDO",
    "Os 2 territórios devem estar em continentes diferentes",
  );
  const j = daVez(ctx);
  for (const t of [a, b])
    ctx.estado.territorios[t] = { dono: j.id, exercitos: 1, chegaramNoTurno: 0 };
  preparacao(ctx).escolhasB += 1;
  emitir(ctx, { tipo: "doisVagosOcupados", jogador: j.id, territorios: [a, b] });
  proximaEscolha(ctx);
}

function proximaEscolha(ctx: Contexto): void {
  const p = preparacao(ctx);
  p.escolhasFeitas += 1;
  const n = ctx.estado.jogadores.length;
  if (p.escolhasFeitas >= n) iniciarOcupacao(ctx);
  else ctx.estado.vez = (ctx.estado.vez + 1) % n;
}

// As 12 cartas de CE voltam ao maço; o monte é embaralhado e começa a ocupação (§4.4).
export function iniciarOcupacao(ctx: Contexto): void {
  const estado = ctx.estado;
  estado.monte = embaralhar(
    ctx.rng,
    CARTAS_DE_TROCA.map((c) => c.id),
  );
  estado.descarte = [];
  estado.fase = "PREP_OCUPACAO";
  estado.vez = estado.distribuidor;
  if (estado.preparacao !== null) estado.preparacao.centrosExtras = [];
}

export function ocupar(ctx: Contexto, valor: unknown): void {
  const t = exigirTerritorio(valor);
  exigir(territorioDe(ctx, t).dono === null, "TERRITORIO_OCUPADO", "Território já ocupado");
  const j = daVez(ctx);
  ctx.estado.territorios[t] = { dono: j.id, exercitos: 1, chegaramNoTurno: 0 };
  emitir(ctx, { tipo: "territorioOcupado", jogador: j.id, territorio: t });
  if (territoriosVagos(ctx.estado).length === 0) concluirPreparacao(ctx);
  else ctx.estado.vez = (ctx.estado.vez + 1) % ctx.estado.jogadores.length;
}

// Sorteio dos objetivos (§4.5) e início da primeira rodada pelo seguinte a quem ocupou o
// último território (§4.6).
function concluirPreparacao(ctx: Contexto): void {
  const estado = ctx.estado;
  const emJogo = new Set(estado.jogadores.map((j) => j.cor));
  const disponiveis = OBJETIVOS.filter((o) =>
    o.requisitos.every((r) => r.tipo !== "destruirCor" || emJogo.has(r.cor)),
  );
  const sorteados = embaralhar(ctx.rng, disponiveis);
  estado.jogadores.forEach((j, i) => {
    const o = sorteados[i];
    if (o === undefined) throw new Error("Objetivos insuficientes para os jogadores");
    const destroiPropria = o.requisitos.some((r) => r.tipo === "destruirCor" && r.cor === j.cor);
    const emVigor =
      destroiPropria && estado.parametros.objetivoSubstitutoDestruir
        ? OBJETIVO_SUBSTITUTO_DESTRUIR.id
        : o.id;
    j.objetivoOriginalId = o.id;
    j.objetivoId = emVigor;
    emitir(ctx, { tipo: "objetivoSorteado", jogador: j.id, objetivo: o.id, emVigor });
  });
  const n = estado.jogadores.length;
  estado.preparacao = null;
  estado.primeiroJogador = (estado.vez + 1) % n;
  estado.rodada = 1;
  estado.etapaPrimeiraRodada = 1;
  iniciarVez(ctx, estado.primeiroJogador);
}
