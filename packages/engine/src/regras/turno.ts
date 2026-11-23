// Início e passagem da vez, com a primeira rodada especial (WARII.md §5.1) e o recebimento
// automático do +1 por CE e dos bombardeiros (§6.3 e §6.5).

import { IDS_TERRITORIOS } from "../data/territorios.js";
import { calcularRecebimento } from "./consultas.js";
import { type Contexto, daVez, emitir } from "./contexto.js";
import { turnoVazio } from "./estado.js";

export function iniciarVez(ctx: Contexto, indice: number): void {
  const estado = ctx.estado;
  estado.vez = indice;
  estado.turno = turnoVazio();
  for (const t of IDS_TERRITORIOS) estado.territorios[t].chegaramNoTurno = 0;
  // Etapa 2 da primeira rodada: o recebimento já aconteceu na etapa 1.
  estado.fase = estado.rodada === 1 && estado.etapaPrimeiraRodada === 2 ? "ATACAR" : "RECEBER";
  const j = daVez(ctx);
  emitir(ctx, {
    tipo: "inicioDaVez",
    jogador: j.id,
    rodada: estado.rodada,
    etapaPrimeiraRodada: estado.etapaPrimeiraRodada,
    fase: estado.fase,
  });
  if (estado.fase === "RECEBER") receber(ctx);
}

function receber(ctx: Contexto): void {
  const estado = ctx.estado;
  const j = daVez(ctx);
  const r = calcularRecebimento(estado, j.id);
  for (const c of r.centros) estado.territorios[c].exercitos += 1;
  // A caixa pode ter menos bombardeiros que o devido: recebe só os que existem (⚠ §6.5).
  const bombardeiros = Math.min(r.bombardeiros, j.bombardeirosCaixa);
  j.bombardeirosCaixa -= bombardeiros;
  j.bombardeirosBase += bombardeiros;
  estado.turno.recebimento = { livres: r.livres, porContinente: { ...r.porContinente } };
  emitir(ctx, {
    tipo: "recebimento",
    jogador: j.id,
    livres: r.livres,
    porContinente: r.porContinente,
    centros: r.centros,
    bombardeiros,
  });
}

// Passa a vez ao próximo jogador ativo, contando rodadas pela volta ao primeiro jogador.
export function passarVez(ctx: Contexto): void {
  const estado = ctx.estado;
  const n = estado.jogadores.length;
  let deuVolta = false;
  let proximo = -1;
  for (let k = 1; k <= n; k++) {
    const i = (estado.vez + k) % n;
    if (i === estado.primeiroJogador) deuVolta = true;
    if (estado.jogadores[i]?.eliminado === false) {
      proximo = i;
      break;
    }
  }
  if (proximo < 0) throw new Error("Estado corrompido: nenhum jogador ativo");
  if (deuVolta) {
    if (estado.rodada === 1 && estado.etapaPrimeiraRodada === 1) {
      estado.etapaPrimeiraRodada = 2;
    } else {
      estado.rodada += 1;
      estado.etapaPrimeiraRodada = null;
    }
  }
  iniciarVez(ctx, proximo);
}
