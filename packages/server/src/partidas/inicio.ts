// Montagem do estado inicial (ação seq 0 do log): sorteia a ordem da mesa e cria a partida no
// engine com a mesma RNG. Ao repetir os sorteios gravados (rngDeReplay), sai o mesmo estado.
import {
  type CorId,
  criarPartida,
  embaralhar,
  type JogadorInicial,
  type Parametros,
  type Resultado,
  type Rng,
} from "@warii/engine";

// Conteúdo da ação seq 0 gravada em acoes_partida.
export interface AcaoCriacao {
  // Participantes na ordem de entrada no lobby, antes do sorteio dos assentos.
  readonly participantes: readonly { readonly id: string; readonly cor: CorId }[];
  readonly parametros: Parametros;
}

export const TIPO_ACAO_CRIACAO = "criarPartida";

export function montarPartida(
  criacao: AcaoCriacao,
  rng: Rng,
): { jogadores: JogadorInicial[]; resultado: Resultado } {
  const jogadores = embaralhar(rng, criacao.participantes).map((p) => ({ id: p.id, cor: p.cor }));
  return { jogadores, resultado: criarPartida(jogadores, criacao.parametros, rng) };
}
