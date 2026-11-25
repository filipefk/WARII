// Autenticação da conexão do Socket.IO: a mesma regra de origem do REST (origem.ts) e o mesmo
// cookie de sessão, validado por sessaoPorToken. Recusas chegam ao cliente no `connect_error` (err.data = ErroApi).
import fastifyCookie from "@fastify/cookie";
import type { ErroApi } from "@warii/shared";
import type { FastifyBaseLogger } from "fastify";
import { NOME_COOKIE_SESSAO } from "../auth/plugin.js";
import { sessaoPorToken } from "../auth/sessoes.js";
import { auditar } from "../auditoria.js";
import { origemPermitida } from "../origem.js";
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
    const cabecalhos = socket.handshake.headers;
    if (!origemPermitida(cabecalhos)) {
      auditar(log, "socket_recusado", {
        motivo: "origem",
        // Endereço da conexão (atrás do proxy, o do Traefik) e a cadeia que ele repassou.
        ip: socket.handshake.address,
        encaminhadoPor: cabecalhos["x-forwarded-for"],
        origem: cabecalhos.origin,
        site: cabecalhos["sec-fetch-site"],
      });
      return erroDeConexao("ORIGEM_RECUSADA", "origem da conexão não permitida");
    }
    const cabecalho = cabecalhos.cookie;
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
