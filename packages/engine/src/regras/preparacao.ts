// Preparação (WARII.md §4): ocupação dos vagos, sorteio dos objetivos e primeiro
// jogador. A criação da partida (distribuidor e CEs) fica em criar.ts.

import { CARTAS_DE_TROCA } from "../data/cartas.js";
import { OBJETIVO_SUBSTITUTO_DESTRUIR, OBJETIVOS } from "../data/objetivos.js";
import { territoriosVagos } from "./consultas.js";
import { type Contexto, daVez, emitir, exigirTerritorio, territorioDe } from "./contexto.js";
import { exigir } from "./resultado.js";
import { embaralhar } from "./rng.js";
import { iniciarVez } from "./turno.js";

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
  estado.primeiroJogador = (estado.vez + 1) % n;
  estado.rodada = 1;
  estado.etapaPrimeiraRodada = 1;
  iniciarVez(ctx, estado.primeiroJogador);
}
