// Apoio aos testes de integração: app sem porta (app.inject), banco de teste preparado e limpo,
// e atalhos para criar contas e fazer requisições com cookie.
import { fileURLToPath } from "node:url";

import type { FastifyInstance, LightMyRequestResponse } from "fastify";

import { criarApp } from "../src/app.js";
import { criarConta, gerarLinkSenha } from "../src/auth/contas.js";
import { NOME_COOKIE_SESSAO } from "../src/auth/plugin.js";
import { pool } from "../src/db/index.js";
import { prepararBanco } from "../src/db/preparar.js";

const pastaDeMigrations = fileURLToPath(new URL("../drizzle", import.meta.url));

export const SENHA_PADRAO = "senha-de-teste-123";

export async function iniciarAppDeTeste(): Promise<FastifyInstance> {
  const app = await criarApp(false);
  await prepararBanco(app.log, pastaDeMigrations);
  await app.ready();
  return app;
}

export async function encerrarAppDeTeste(app: FastifyInstance): Promise<void> {
  await app.close();
  await pool.end();
}

export async function limparBanco(): Promise<void> {
  await pool.query(
    "TRUNCATE usuarios, sessoes, tokens_senha, partidas, participantes, acoes_partida, snapshots",
  );
}

// IPs diferentes por teste, para o rate limit (por IP) de um teste não interferir nos outros.
let ultimoIp = 0;
export function ipNovo(): string {
  ultimoIp += 1;
  return `10.0.${Math.floor(ultimoIp / 250)}.${(ultimoIp % 250) + 1}`;
}

export function tokenDoLink(link: string): string {
  const token = new URL(link).hash.replace(/^#token=/, "");
  if (!token) throw new Error(`link sem token: ${link}`);
  return token;
}

export function cookieDeSessao(resposta: LightMyRequestResponse): string | undefined {
  return resposta.cookies.find((cookie) => cookie.name === NOME_COOKIE_SESSAO)?.value;
}

interface Requisicao {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  corpo?: Record<string, unknown>;
  sessao?: string | undefined;
  ip?: string;
  cabecalhos?: Record<string, string>;
}

export function requisitar(
  app: FastifyInstance,
  { metodo = "GET", url, corpo, sessao, ip = "127.0.0.1", cabecalhos = {} }: Requisicao,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: metodo,
    url,
    remoteAddress: ip,
    headers: cabecalhos,
    ...(corpo !== undefined && { payload: corpo }),
    ...(sessao !== undefined && { cookies: { [NOME_COOKIE_SESSAO]: sessao } }),
  });
}

// Cria a conta e já a ativa pelo link, devolvendo o cookie da sessão aberta na ativação.
export async function criarContaAtiva(
  app: FastifyInstance,
  email: string,
  nome = "Jogador",
  senha = SENHA_PADRAO,
): Promise<{ id: string; sessao: string }> {
  const conta = await criarConta(email, nome);
  const { link } = await gerarLinkSenha(email, "ativacao");
  const resposta = await requisitar(app, {
    metodo: "POST",
    url: "/api/auth/senha/definir",
    corpo: { token: tokenDoLink(link), senha },
    ip: ipNovo(),
  });
  const sessao = cookieDeSessao(resposta);
  if (resposta.statusCode !== 200 || !sessao) {
    throw new Error(`ativação falhou: ${resposta.statusCode} ${resposta.body}`);
  }
  return { id: conta.id, sessao };
}

// N contas ativas ("jogador1@teste.local", …), cada uma com a sessão aberta.
export async function criarContasAtivas(
  app: FastifyInstance,
  quantidade: number,
): Promise<{ id: string; sessao: string; nome: string }[]> {
  const contas = [];
  for (let i = 1; i <= quantidade; i++) {
    const nome = `Jogador ${i}`;
    contas.push({ ...(await criarContaAtiva(app, `jogador${i}@teste.local`, nome)), nome });
  }
  return contas;
}
