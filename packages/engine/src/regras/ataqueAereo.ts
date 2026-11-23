// Ataque aéreo em ciclos (WARII.md §7.3), com bombardeiros da base e/ou da caixa por cartas
// (§9.3 B). Nunca conquista: o alvo fica sempre com pelo menos 1 exército.

import type { CartaId } from "../data/cartas.js";
import { territoriosDaCarta } from "./consultas.js";
import { type Contexto, daVez, emitir, exigirTerritorio } from "./contexto.js";
import { descartarCartas, exigirCombinacao, idsDaCombinacao } from "./cartas.js";
import type { AtaqueAereoEmCurso } from "./estado.js";
import { exigir, exigirQuantidade } from "./resultado.js";
import { rolar } from "./rng.js";

export interface CartasDoAtaque {
  readonly carta: unknown;
  readonly numericas: readonly unknown[];
}

export function iniciarAtaqueAereo(
  ctx: Contexto,
  valorAlvo: unknown,
  daBase: unknown,
  cartas: CartasDoAtaque | undefined,
): void {
  const estado = ctx.estado;
  const p = estado.parametros;
  const j = daVez(ctx);
  const alvo = exigirTerritorio(valorAlvo, "Alvo");
  const a = estado.territorios[alvo];
  exigir(a.dono !== null && a.dono !== j.id, "ALVO_INVALIDO", "O alvo deve ser de um adversário");
  exigir(a.exercitos >= 2, "ALVO_INVALIDO", "O alvo precisa ter pelo menos 2 exércitos");
  exigirQuantidade(daBase, 0);
  exigir(
    daBase <= j.bombardeirosBase,
    "BOMBARDEIROS_INSUFICIENTES",
    `Só há ${j.bombardeirosBase} bombardeiros na base`,
  );

  let daCaixa = 0;
  let idsCartas: CartaId[] = [];
  if (cartas !== undefined) {
    const c = exigirCombinacao(ctx, cartas.carta, cartas.numericas);
    exigir(
      territoriosDaCarta(c.carta).includes(alvo),
      "CARTA_INVALIDA",
      `O alvo não está na carta ${c.carta.nome}`,
    );
    daCaixa = c.valor;
    idsCartas = idsDaCombinacao(c);
    exigir(
      daCaixa <= j.bombardeirosCaixa,
      "BOMBARDEIROS_INSUFICIENTES",
      `As cartas pedem ${daCaixa} bombardeiros, mas a caixa só tem ${j.bombardeirosCaixa}`,
    );
  }
  exigir(
    p.somarBaseECaixa || daBase === 0 || daCaixa === 0,
    "ACAO_BLOQUEADA",
    "Nesta partida o ataque aéreo usa a base ou as cartas, não as duas",
  );
  exigir(daBase + daCaixa > 0, "QUANTIDADE_INVALIDA", "Nenhum bombardeiro no ataque");

  const defensor = a.dono;
  j.bombardeirosBase -= daBase;
  j.bombardeirosCaixa -= daCaixa;
  if (idsCartas.length > 0) descartarCartas(ctx, idsCartas);
  const ataque: AtaqueAereoEmCurso = { alvo, defensor, emCombate: daBase + daCaixa, ciclos: 0 };
  estado.turno.ataqueAereo = ataque;
  emitir(ctx, {
    tipo: "ataqueAereoIniciado",
    jogador: j.id,
    defensor,
    alvo,
    daBase,
    daCaixa,
    cartas: idsCartas,
  });
  executarCiclo(ctx);
  // Sem interrupção (manual), os ciclos seguem até uma das condições de fim.
  if (!p.interromperAtaqueAereo) {
    while (estado.turno.ataqueAereo !== null) executarCiclo(ctx);
  }
}

function emCurso(ctx: Contexto): AtaqueAereoEmCurso {
  const a = ctx.estado.turno.ataqueAereo;
  exigir(a !== null, "FASE_ERRADA", "Não há ataque aéreo em curso");
  return a;
}

// Um ciclo: antiaérea do defensor e, se sobrar bombardeiro, dado de ataque do atacante.
function executarCiclo(ctx: Contexto): void {
  const estado = ctx.estado;
  const p = estado.parametros;
  const j = daVez(ctx);
  const ataque = emCurso(ctx);
  const alvo = estado.territorios[ataque.alvo];

  const dadoAntiaereo = rolar(ctx.rng, p.facesAntiaereo);
  const bombardeirosAbatidos = Math.min(dadoAntiaereo, ataque.emCombate);
  ataque.emCombate -= bombardeirosAbatidos;
  j.bombardeirosCaixa += bombardeirosAbatidos;

  let dadoAtaque: number | null = null;
  let exercitosAbatidos = 0;
  if (ataque.emCombate > 0) {
    dadoAtaque = rolar(ctx.rng, p.facesAtaqueAereo);
    // Nunca deixa menos de 1 exército; o excesso se perde.
    exercitosAbatidos = Math.min(dadoAtaque, alvo.exercitos - 1);
    alvo.exercitos -= exercitosAbatidos;
  }
  ataque.ciclos += 1;
  emitir(ctx, {
    tipo: "cicloAereo",
    jogador: j.id,
    defensor: ataque.defensor,
    alvo: ataque.alvo,
    dadoAntiaereo,
    bombardeirosAbatidos,
    dadoAtaque,
    exercitosAbatidos,
  });
  if (ataque.emCombate === 0 || alvo.exercitos < 2) encerrar(ctx);
}

export function continuarAtaqueAereo(ctx: Contexto): void {
  emCurso(ctx);
  executarCiclo(ctx);
}

export function encerrarAtaqueAereo(ctx: Contexto): void {
  emCurso(ctx);
  encerrar(ctx);
}

// Sobreviventes voltam para a base (vídeo) ou para a caixa (manual).
function encerrar(ctx: Contexto): void {
  const ataque = emCurso(ctx);
  const j = daVez(ctx);
  const paraBase = ctx.estado.parametros.sobreviventesAereoVoltamParaBase;
  if (paraBase) j.bombardeirosBase += ataque.emCombate;
  else j.bombardeirosCaixa += ataque.emCombate;
  ctx.estado.turno.ataqueAereo = null;
  emitir(ctx, {
    tipo: "ataqueAereoEncerrado",
    jogador: j.id,
    alvo: ataque.alvo,
    sobreviventes: ataque.emCombate,
    destino: paraBase ? "base" : "caixa",
  });
}
