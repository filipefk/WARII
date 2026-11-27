// Cartas que o próprio jogador herdou ao eliminar um adversário (§11), para o aviso. Sai do
// evento `cartasHerdadas` do lote.
import { CORES, type Evento, type VisaoPartida } from "@warii/engine";

export interface CartasHerdadas {
  // Seq do lote da eliminação (o aviso aparece uma vez por lote).
  seq: number;
  // Cor do eliminado, no plural ("vermelhos").
  cor: string;
  recebidas: number;
  doAdversario: number;
  limite: number;
}

export function cartasHerdadas(
  visao: VisaoPartida,
  eventos: readonly Evento[],
  seq: number,
): CartasHerdadas | null {
  if (visao.voce === null) return null;
  const h = eventos.find((e) => e.tipo === "cartasHerdadas" && e.jogador === visao.voce);
  if (h?.tipo !== "cartasHerdadas") return null;
  const cor = visao.jogadores.find((j) => j.id === h.de)?.cor;
  return {
    seq,
    cor: cor ? CORES[cor].plural : "do adversário",
    recebidas: h.quantidade,
    doAdversario: h.doAdversario,
    limite: visao.parametros.limiteMao,
  };
}

const cartas = (n: number) => `${n} ${n === 1 ? "carta" : "cartas"}`;

export function textoDasCartasHerdadas(h: CartasHerdadas): string {
  const inicio = `Você eliminou os exércitos ${h.cor} e deve receber as cartas do adversário.`;
  if (h.recebidas === 0) {
    return `${inicio} Você não recebeu nenhuma carta do adversário porque já tem o limite de ${h.limite} cartas.`;
  }
  if (h.recebidas < h.doAdversario) {
    return `${inicio} Você recebeu ${h.recebidas} das ${cartas(h.doAdversario)} do adversário por sorteio, pois não pode ficar com mais de ${h.limite} cartas.`;
  }
  return `${inicio} Você recebeu ${cartas(h.recebidas)}.`;
}
