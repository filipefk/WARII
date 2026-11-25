// Endurecimento HTTP (etapa 10): regra de origem, cabeçalhos de segurança, tipos de corpo,
// limite global de corpo e a rota de métricas desligada. Não usa banco (nenhum handler roda).
import "./ambiente.js";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import type { FastifyInstance } from "fastify";

import { mascararEmail } from "../src/auditoria.js";
import { criarApp } from "../src/app.js";
import { origemPermitida } from "../src/origem.js";

const SITE = "http://localhost:5173";

describe("origemPermitida", () => {
  test("com Origin, só a do site passa", () => {
    assert.equal(origemPermitida({ origin: SITE }), true);
    assert.equal(origemPermitida({ origin: "https://malicioso.example" }), false);
    assert.equal(origemPermitida({ origin: "null" }), false);
    assert.equal(origemPermitida({ origin: `${SITE}.malicioso.example` }), false);
    // Origin vale mais que Sec-Fetch-Site.
    assert.equal(origemPermitida({ origin: SITE, "sec-fetch-site": "cross-site" }), true);
  });

  test("sem Origin, vale o Sec-Fetch-Site", () => {
    assert.equal(origemPermitida({ "sec-fetch-site": "same-origin" }), true);
    assert.equal(origemPermitida({ "sec-fetch-site": "none" }), true);
    assert.equal(origemPermitida({ "sec-fetch-site": "same-site" }), false);
    assert.equal(origemPermitida({ "sec-fetch-site": "cross-site" }), false);
  });

  test("sem os dois (fora do navegador), passa", () => {
    assert.equal(origemPermitida({}), true);
  });
});

describe("mascararEmail", () => {
  test("mantém só a primeira letra e o domínio", () => {
    assert.equal(mascararEmail("fulano@exemplo.com"), "f***@exemplo.com");
    assert.equal(mascararEmail("a@b.c"), "a***@b.c");
    assert.equal(mascararEmail("sem-arroba"), "***");
  });
});

describe("cabeçalhos e corpo das requisições", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await criarApp(false);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("respostas da API levam os cabeçalhos de segurança", async () => {
    const resposta = await app.inject({ method: "GET", url: "/api/nada" });
    assert.equal(resposta.statusCode, 404);
    const h = resposta.headers;
    assert.equal(
      h["content-security-policy"],
      "default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'",
    );
    assert.equal(h["x-content-type-options"], "nosniff");
    assert.equal(h["x-frame-options"], "DENY");
    assert.equal(h["referrer-policy"], "no-referrer");
    assert.equal(h["cross-origin-resource-policy"], "same-origin");
    assert.equal(h["x-powered-by"], undefined);
    // Em desenvolvimento (http://localhost) não há HSTS.
    assert.equal(h["strict-transport-security"], undefined);
    // Sem CORS: nenhuma outra origem pode ler as respostas.
    assert.equal(h["access-control-allow-origin"], undefined);
  });

  test("POST sem Origin, mas com Sec-Fetch-Site de outro site, é recusado", async () => {
    const resposta = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { "sec-fetch-site": "cross-site" },
    });
    assert.equal(resposta.statusCode, 403);
    assert.equal(resposta.json<{ codigo: string }>().codigo, "ORIGEM_RECUSADA");
  });

  test("corpo text/plain (o de um <form> de outro site) é recusado com 415", async () => {
    const resposta = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "text/plain" },
      payload: '{"email":"a@b.c","senha":"x"}',
    });
    assert.equal(resposta.statusCode, 415);
  });

  test("o limite global de corpo vale nas rotas sem limite próprio", async () => {
    const resposta = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ lixo: "x".repeat(20_000) }),
    });
    assert.equal(resposta.statusCode, 413);
  });

  test("sem METRICAS_TOKEN, a rota de métricas não existe", async () => {
    const resposta = await app.inject({ method: "GET", url: "/api/metricas" });
    assert.equal(resposta.statusCode, 404);
  });
});
