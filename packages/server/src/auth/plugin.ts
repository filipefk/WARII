// Infraestrutura de autenticação do Fastify: cookie, rate limit, checagem de Origin e
// `exigirSessao` (preHandler das rotas que pedem login, que preenche `requisicao.sessao`).
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { responderErro } from "../erros.js";
import { type OrigemDaSessao, type SessaoValida, sessaoPorToken } from "./sessoes.js";

declare module "fastify" {
  interface FastifyRequest {
    sessao: SessaoValida | null;
  }
}

const emProducao = config.NODE_ENV === "production";

// Em produção o prefixo __Host- obriga Secure, Path=/ e nenhum Domain (o navegador recusa o cookie
// se faltar algo). Em dev roda em http://localhost, então vai sem Secure e sem o prefixo.
export const NOME_COOKIE_SESSAO = emProducao ? "__Host-warii_sessao" : "warii_sessao";

const OPCOES_COOKIE = {
  httpOnly: true,
  secure: emProducao,
  sameSite: "lax",
  path: "/",
} as const;

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

export function gravarCookieSessao(resposta: FastifyReply, token: string, expiraEm: Date): void {
  resposta.setCookie(NOME_COOKIE_SESSAO, token, { ...OPCOES_COOKIE, expires: expiraEm });
}

export function apagarCookieSessao(resposta: FastifyReply): void {
  resposta.clearCookie(NOME_COOKIE_SESSAO, OPCOES_COOKIE);
}

export function origemDaRequisicao(requisicao: FastifyRequest): OrigemDaSessao {
  return { ip: requisicao.ip, userAgent: requisicao.headers["user-agent"] };
}

export async function exigirSessao(
  requisicao: FastifyRequest,
  resposta: FastifyReply,
): Promise<void> {
  const token = requisicao.cookies[NOME_COOKIE_SESSAO];
  const sessao = token ? await sessaoPorToken(token) : undefined;
  if (!sessao) {
    if (token) apagarCookieSessao(resposta);
    await responderErro(resposta, 401, "NAO_AUTENTICADO", "faça login para continuar");
    return;
  }
  if (sessao.renovadaAte && token) gravarCookieSessao(resposta, token, sessao.renovadaAte);
  requisicao.sessao = sessao;
}

// Sessão de uma rota protegida por `exigirSessao` (que garante que ela existe).
export function sessaoDa(requisicao: FastifyRequest): SessaoValida {
  if (!requisicao.sessao) throw new Error("rota sem o preHandler exigirSessao");
  return requisicao.sessao;
}

export async function registrarAutenticacao(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
  // Sem limite global: cada rota de /api/auth declara o seu em `config.rateLimit`.
  await app.register(rateLimit, { global: false });
  app.decorateRequest("sessao", null);

  // Proteção mínima contra CSRF (além do SameSite=Lax): requisições que alteram dados vindas
  // de outra origem são recusadas. Clientes sem Origin (curl, a CLI) passam; a etapa 10 endurece.
  app.addHook("onRequest", async (requisicao, resposta) => {
    if (METODOS_SEGUROS.has(requisicao.method) || !requisicao.url.startsWith("/api/")) return;
    const origem = requisicao.headers.origin;
    if (origem !== undefined && origem !== config.URL_PUBLICA) {
      await responderErro(resposta, 403, "ORIGEM_RECUSADA", "origem da requisição não permitida");
    }
  });
}
