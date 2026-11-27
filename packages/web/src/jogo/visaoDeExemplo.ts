// Visão de uma partida que não existe, para o tabuleiro de ambientação (/tabuleiro): o guia de
// regras e a galeria precisam de uma visão com os parâmetros. Monta uma partida de verdade com o
// engine (jogadores fictícios, parâmetros padrão) e a mostra a um espectador com todos os
// territórios vagos: nada de regra é reescrito aqui.
import {
  criarPartida,
  IDS_CORES,
  PARAMETROS_PADRAO,
  type VisaoPartida,
  visaoDoJogador,
} from "@warii/engine";

let cache: VisaoPartida | null = null;

export function visaoDeExemplo(): VisaoPartida {
  if (cache) return cache;
  const jogadores = IDS_CORES.slice(0, 3).map((cor, i) => ({ id: `exemplo-${i + 1}`, cor }));
  // Sorteios previsíveis: a partida só existe para dar forma à visão. Os valores precisam variar
  // (com o mesmo valor sempre, o sorteio do distribuidor empataria para sempre).
  let sorteio = 0;
  const criada = criarPartida(jogadores, PARAMETROS_PADRAO, {
    inteiro: (maximo) => sorteio++ % maximo,
  });
  if (!criada.ok) throw new Error(criada.erro.mensagem);
  const estado = structuredClone(criada.estado);
  for (const territorio of Object.values(estado.territorios)) {
    territorio.dono = null;
    territorio.exercitos = 0;
    territorio.chegaramNoTurno = 0;
  }
  cache = visaoDoJogador(estado, null);
  return cache;
}
