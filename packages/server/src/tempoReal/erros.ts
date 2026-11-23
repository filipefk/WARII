// Recusas dos pedidos do socket, convertidas no ack { ok: false, erro: { codigo, mensagem } }.
// `grave` marca o que é falha do servidor (não do cliente) e precisa ir para o log de erro.
export class ErroDeTempoReal extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
    readonly grave = false,
    causa?: unknown,
  ) {
    super(mensagem, { cause: causa });
    this.name = "ErroDeTempoReal";
  }
}

export const partidaInexistente = (): ErroDeTempoReal =>
  new ErroDeTempoReal("PARTIDA_INEXISTENTE", "partida inexistente");
