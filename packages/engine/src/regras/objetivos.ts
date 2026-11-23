// Avaliação dos objetivos (WARII.md §10), mudança "3 CE" (opção do manual) e vitória (§10.3).

import { IDS_CONTINENTES } from "../data/continentes.js";
import { objetivo, OBJETIVO_TRES_CENTROS, type Requisito } from "../data/objetivos.js";
import { centrosDe, dominaMaioria, dominaTotalidade, jogador, territoriosDe } from "./consultas.js";
import { type Contexto, emitir } from "./contexto.js";
import type { EstadoJogador, EstadoPartida, JogadorId } from "./estado.js";
import { naoAlcancavel } from "./util.js";

function requisitoCumprido(estado: EstadoPartida, j: EstadoJogador, r: Requisito): boolean {
  switch (r.tipo) {
    case "destruirCor": {
      // Só vale se foi o próprio jogador quem eliminou a cor (§10.2).
      const alvo = estado.jogadores.find((x) => x.cor === r.cor);
      return alvo !== undefined && alvo.id !== j.id && alvo.eliminado && alvo.eliminadoPor === j.id;
    }
    case "totalidade":
      return r.continentes.every((c) => dominaTotalidade(estado, j.id, c));
    case "maioria":
      return r.continentes.every((c) => dominaMaioria(estado, j.id, c));
    case "totalidadeQuaisquer":
      return (
        IDS_CONTINENTES.filter((c) => dominaTotalidade(estado, j.id, c)).length >= r.quantidade
      );
    case "maioriaQuaisquer":
      return IDS_CONTINENTES.filter((c) => dominaMaioria(estado, j.id, c)).length >= r.quantidade;
    case "territorios":
      return territoriosDe(estado, j.id).length >= r.quantidade;
    case "centros": {
      const minimo = r.exercitosEmCada ?? 0;
      const centros = centrosDe(estado, j.id).filter(
        (t) => estado.territorios[t].exercitos >= minimo,
      );
      return centros.length >= r.quantidade;
    }
    case "exercitosEm":
      return r.territorios.every((t) => {
        const e = estado.territorios[t];
        return e.dono === j.id && e.exercitos >= r.minimoEmCada;
      });
    default:
      return naoAlcancavel(r);
  }
}

export function objetivoCumprido(estado: EstadoPartida, id: JogadorId): boolean {
  const j = jogador(estado, id);
  if (j === undefined || j.eliminado || j.objetivoId === null) return false;
  const o = objetivo(j.objetivoId);
  if (o === undefined) return false;
  return o.requisitos.every((r) => requisitoCumprido(estado, j, r));
}

// Opção do manual (desligada por padrão): quem fica com 1 território passa a ter o objetivo
// "3 CE", de forma definitiva.
function aplicarTresCentros(ctx: Contexto): void {
  if (!ctx.estado.parametros.objetivoTresCentros) return;
  for (const j of ctx.estado.jogadores) {
    if (j.eliminado || j.objetivoId === OBJETIVO_TRES_CENTROS.id) continue;
    if (territoriosDe(ctx.estado, j.id).length !== 1) continue;
    j.objetivoId = OBJETIVO_TRES_CENTROS.id;
    emitir(ctx, {
      tipo: "objetivoAlterado",
      jogador: j.id,
      objetivo: j.objetivoId,
      motivo: "reduzidoAUmTerritorio",
    });
  }
}

// Roda depois de toda ação aceita. Com vitória a qualquer momento (padrão), confere todos os
// jogadores ativos, começando pelo da vez e seguindo a ordem da mesa (⚠ §10.3).
export function verificarFimDeJogo(ctx: Contexto): void {
  const estado = ctx.estado;
  if (estado.fase === "FIM" || estado.rodada === 0) return;
  aplicarTresCentros(ctx);
  const n = estado.jogadores.length;
  const ordem = estado.parametros.vitoriaAQualquerMomento
    ? Array.from({ length: n }, (_, k) => (estado.vez + k) % n)
    : [estado.vez];
  for (const i of ordem) {
    const j = estado.jogadores[i];
    if (j === undefined || !objetivoCumprido(estado, j.id) || j.objetivoId === null) continue;
    estado.fase = "FIM";
    estado.vencedor = j.id;
    emitir(ctx, { tipo: "vitoria", jogador: j.id, objetivo: j.objetivoId });
    return;
  }
}
