// Cartas que o jogador recebeu (ou não) ao encerrar a própria jogada, para o aviso do fim da vez.
// Sai da visão de antes do lote (conquista na vez, mão, parâmetros) e do cartasCompradas do lote.
import type { Evento, VisaoPartida } from "@warii/engine";

export interface CartasDoFimDaVez {
  // Seq do lote em que a vez terminou (o aviso aparece uma vez por lote).
  seq: number;
  conquistou: boolean;
  recebidas: number;
  // Cartas na mão antes da compra.
  tinha: number;
  limite: number;
  porConquista: number;
}

export function cartasDoFimDaVez(
  antes: VisaoPartida,
  eventos: readonly Evento[],
  seq: number,
): CartasDoFimDaVez | null {
  const voce = antes.voce;
  if (voce === null || antes.jogadores[antes.vez]?.id !== voce) return null;
  // Só o encerrar jogada (ataque ou deslocamento) compra cartas; a vez passa com o inicioDaVez.
  if (antes.fase !== "ATACAR" && antes.fase !== "DESLOCAR") return null;
  if (!eventos.some((e) => e.tipo === "inicioDaVez")) return null;
  if (eventos.some((e) => e.tipo === "vitoria")) return null;
  const { cartasPorConquista: porConquista, limiteMao: limite } = antes.parametros;
  if (porConquista === 0) return null;
  let recebidas = 0;
  for (const e of eventos) {
    if (e.tipo === "cartasCompradas" && e.jogador === voce) recebidas += e.quantidade;
  }
  return {
    seq,
    conquistou: antes.turno.conquistou,
    recebidas,
    tinha: antes.jogadores[antes.vez]?.quantidadeCartas ?? 0,
    limite,
    porConquista,
  };
}

const cartas = (n: number) => `${n} ${n === 1 ? "carta" : "cartas"}`;

export function textoDasCartasDoFimDaVez(c: CartasDoFimDaVez): string {
  if (!c.conquistou) return "Você não conquistou nenhum território, então não recebe cartas.";
  const peloLimite = Math.min(c.porConquista, Math.max(0, c.limite - c.tinha));
  const motivoLimite = `O máximo de cartas é ${c.limite} e você já tem ${c.tinha}.`;
  if (c.recebidas === 0) {
    return peloLimite === 0
      ? `Você não recebeu cartas. ${motivoLimite}`
      : "Você não recebeu cartas: o monte acabou.";
  }
  if (c.recebidas === c.porConquista) return `Você recebeu ${cartas(c.recebidas)}.`;
  if (c.recebidas === peloLimite) return `Você recebeu ${cartas(c.recebidas)}. ${motivoLimite}`;
  return `Você recebeu ${cartas(c.recebidas)}: o monte acabou.`;
}
