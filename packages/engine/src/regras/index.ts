// Regras do jogo: criação da partida, aplicação de ações, consultas e visão por jogador.
export type { Acao, TipoAcao } from "./acoes.js";
export { aplicarAcao } from "./aplicar.js";
export {
  calcularRecebimento,
  type CalculoRecebimento,
  centrosDe,
  dominaMaioria,
  dominaTotalidade,
  exercitosMoviveis,
  jogador,
  jogadorDaVez,
  jogadoresAtivos,
  jogadorQueAge,
  territoriosDaCarta,
  territoriosDe,
  territoriosVagos,
} from "./consultas.js";
export { criarPartida, type JogadorInicial, MAXIMO_JOGADORES, MINIMO_JOGADORES } from "./criar.js";
export type * from "./estado.js";
export type { Evento, TipoEvento } from "./eventos.js";
export { objetivoCumprido } from "./objetivos.js";
export {
  type BonusContinente,
  comParametros,
  type Parametros,
  PARAMETROS_PADRAO,
  validarParametros,
} from "./parametros.js";
export { pendenteDeRecebimento } from "./recebimento.js";
export type { CodigoErro, ErroRegra, Resultado } from "./resultado.js";
export {
  embaralhar,
  gravarRng,
  indiceDaFace,
  rolar,
  type Rng,
  rngComSemente,
  rngDeReplay,
  rngRoteirizado,
  type Sorteio,
} from "./rng.js";
export {
  estadoDaVisao,
  eventosParaJogador,
  type VisaoJogador,
  type VisaoPartida,
  visaoDoJogador,
} from "./visao.js";
