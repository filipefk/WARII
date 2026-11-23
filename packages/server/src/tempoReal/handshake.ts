// Autenticação da conexão do Socket.IO: mesma origem do site e o mesmo cookie de sessão do REST,
// validado por sessaoPorToken. Recusas chegam ao cliente no `connect_error` (err.data = ErroApi).
import fastifyCookie from "@fastify/cookie";
import type { ErroApi } from "@warii/shared";
import type { FastifyBaseLogger } from "fastify";
import { NOME_COOKIE_SESSAO } from "../auth/plugin.js";
import { sessaoPorToken } from "../auth/sessoes.js";
import { config } from "../config.js";
import type { SocketDoJogo } from "./tipos.js";

function erroDeConexao(codigo: string, mensagem: string): Error & { data: ErroApi } {
  return Object.assign(new Error(mensagem), { data: { codigo, mensagem } });
}

// Devolve o erro que recusa a conexão, ou undefined se ela pode seguir (socket.data preenchido).
export async function autenticarSocket(
  socket: SocketDoJogo,
  log: FastifyBaseLogger,
): Promise<Error | undefined> {
  try {
    const origem = socket.handshake.headers.origin;
    // Sem Origin (clientes fora do navegador) passa, como no REST; a etapa 10 endurece.
    if (origem !== undefined && origem !== config.URL_PUBLICA) {
      return erroDeConexao("ORIGEM_RECUSADA", "origem da conexão não permitida");
    }
    const cabecalho = socket.handshake.headers.cookie;
    const token = cabecalho ? fastifyCookie.parse(cabecalho)[NOME_COOKIE_SESSAO] : undefined;
    const sessao = token ? await sessaoPorToken(token) : undefined;
    if (!sessao) return erroDeConexao("NAO_AUTENTICADO", "faça login para continuar");
    socket.data.usuarioId = sessao.usuario.id;
    socket.data.sessaoId = sessao.sessaoId;
    return undefined;
  } catch (erro) {
    log.error({ err: erro }, "falha ao autenticar conexão do socket");
    return erroDeConexao("ERRO_INTERNO", "erro interno do servidor");
  }
}
