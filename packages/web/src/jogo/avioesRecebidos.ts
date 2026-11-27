// Bombardeiros recebidos no início da vez (+1 por CE, limitado à caixa — §6.5), para o aviso do
// próprio jogador. Sai do evento `recebimento` do lote.
import type { Evento, VisaoPartida } from "@warii/engine";

export interface AvioesRecebidos {
  // Seq do lote em que a vez começou (o aviso aparece uma vez por lote).
  seq: number;
  centros: number;
  recebidos: number;
}

export function avioesRecebidos(
  visao: VisaoPartida,
  eventos: readonly Evento[],
  seq: number,
): AvioesRecebidos | null {
  if (visao.voce === null) return null;
  const r = eventos.find((e) => e.tipo === "recebimento" && e.jogador === visao.voce);
  if (r?.tipo !== "recebimento") return null;
  return { seq, centros: r.centros.length, recebidos: r.bombardeiros };
}

const avioes = (n: number) => `${n} ${n === 1 ? "avião" : "aviões"}`;

export function textoDosAvioesRecebidos(a: AvioesRecebidos): string {
  if (a.centros === 0) return "Você não recebeu aviões pois não tem nenhum centro estratégico.";
  // Cada CE também recebe 1 exército automático (§6.5), mesmo com a base cheia.
  const exercitos = `${a.centros} ${a.centros === 1 ? "exército" : "exércitos"}`;
  if (a.recebidos >= a.centros) {
    return a.centros === 1
      ? "Você recebeu 1 avião e 1 exército pelo seu centro estratégico."
      : `Você recebeu ${avioes(a.recebidos)} e ${exercitos}, um por centro estratégico.`;
  }
  const centros = `${a.centros} ${a.centros === 1 ? "centro estratégico" : "centros estratégicos"}`;
  return `Você tem ${centros} e recebeu ${exercitos}, um por centro, mas só ${avioes(a.recebidos)}, pois sua base aérea está cheia.`;
}
