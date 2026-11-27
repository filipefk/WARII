// Eliminação de jogadores (WARII.md §11) e troca automática de "destruir cor" (§10.2).

import type { CartaId } from "../data/cartas.js";
import { OBJETIVO_SUBSTITUTO_DESTRUIR, objetivo } from "../data/objetivos.js";
import { porNoDescarte } from "./cartas.js";
import { jogador, territoriosDe } from "./consultas.js";
import { type Contexto, emitir } from "./contexto.js";
import type { EstadoJogador, JogadorId } from "./estado.js";
import { embaralhar } from "./rng.js";
import { objetivoCumprido } from "./objetivos.js";

const destroiCor = (j: EstadoJogador, cor: EstadoJogador["cor"]): boolean =>
  j.objetivoId !== null &&
  (objetivo(j.objetivoId)?.requisitos.some((r) => r.tipo === "destruirCor" && r.cor === cor) ??
    false);

export function verificarEliminacao(ctx: Contexto, defensorId: JogadorId, porId: JogadorId): void {
  const estado = ctx.estado;
  const defensor = jogador(estado, defensorId);
  const eliminador = jogador(estado, porId);
  if (defensor === undefined || eliminador === undefined) return;
  if (defensor.eliminado || territoriosDe(estado, defensor.id).length > 0) return;

  // Bombardeiros, CI e objetivo do eliminado saem do jogo.
  defensor.eliminado = true;
  defensor.eliminadoPor = eliminador.id;
  defensor.bombardeirosBase = 0;
  defensor.bombardeirosCaixa = 0;
  emitir(ctx, { tipo: "jogadorEliminado", jogador: defensor.id, por: eliminador.id });

  // Quem tinha de destruir essa cor e não foi o eliminador passa a "24 territórios".
  if (estado.parametros.objetivoSubstitutoDestruir) {
    for (const j of estado.jogadores) {
      if (j.eliminado || j.id === eliminador.id || !destroiCor(j, defensor.cor)) continue;
      j.objetivoId = OBJETIVO_SUBSTITUTO_DESTRUIR.id;
      emitir(ctx, {
        tipo: "objetivoAlterado",
        jogador: j.id,
        objetivo: j.objetivoId,
        motivo: "corEliminadaPorOutro",
      });
    }
  }

  // Se a eliminação cumpriu o objetivo do eliminador, ele vence (verificarFimDeJogo) e não
  // herda nada. Senão, recebe as cartas do eliminado. Com a herança limitada, só as que cabem no
  // limite da mão, sorteadas, e as outras vão para o descarte; sem ela, todas, e acima do limite
  // ele precisa usar ou descartar o excesso antes de seguir (aplicar.ts).
  if (objetivoCumprido(estado, eliminador.id) || defensor.cartas.length === 0) return;
  const doAdversario = defensor.cartas;
  defensor.cartas = [];
  let cartas = doAdversario;
  let sobra: CartaId[] = [];
  const vagas = Math.max(0, estado.parametros.limiteMao - eliminador.cartas.length);
  // `=== true`: partidas antigas não têm o parâmetro e seguem a regra anterior.
  // oxlint-disable-next-line typescript/no-unnecessary-boolean-literal-compare -- pode ser undefined
  if (estado.parametros.herancaLimitadaPorSorteio === true && doAdversario.length > vagas) {
    const sorteadas = vagas === 0 ? doAdversario : embaralhar(ctx.rng, doAdversario);
    cartas = sorteadas.slice(0, vagas);
    sobra = sorteadas.slice(vagas);
  }
  eliminador.cartas.push(...cartas);
  emitir(ctx, {
    tipo: "cartasHerdadas",
    jogador: eliminador.id,
    de: defensor.id,
    cartas,
    quantidade: cartas.length,
    doAdversario: doAdversario.length,
  });
  if (sobra.length > 0) porNoDescarte(ctx, sobra);
}
