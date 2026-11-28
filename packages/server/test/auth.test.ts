// Rotas /api/auth de ponta a ponta (app.inject + banco de teste). Ver ambiente.ts sobre o banco.
import { motivoSemBanco } from "./ambiente.js";

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import type { FastifyInstance } from "fastify";

import { criarConta, ErroDeConta, gerarLinkSenha } from "../src/auth/contas.js";
import { limparVencidas } from "../src/auth/sessoes.js";
import { hashDoToken } from "../src/auth/tokens.js";
import { pool } from "../src/db/index.js";
import {
  cookieDeSessao,
  criarContaAtiva,
  encerrarAppDeTeste,
  iniciarAppDeTeste,
  ipNovo,
  limparBanco,
  requisitar,
  SENHA_PADRAO,
  tokenDoLink,
} from "./apoio.js";

const DIA = 24 * 60 * 60 * 1000;

interface SessaoDoBanco {
  token_hash: Buffer;
  expira_em: Date;
  revogada_em: Date | null;
}

async function sessoesDoBanco(usuarioId: string): Promise<SessaoDoBanco[]> {
  const { rows } = await pool.query<SessaoDoBanco>(
    "SELECT token_hash, expira_em, revogada_em FROM sessoes WHERE usuario_id = $1",
    [usuarioId],
  );
  return rows;
}

describe("rotas /api/auth", { skip: motivoSemBanco, concurrency: false }, () => {
  let app: FastifyInstance;

  before(async () => {
    app = await iniciarAppDeTeste();
  });
  after(async () => {
    await encerrarAppDeTeste(app);
  });
  beforeEach(async () => {
    await limparBanco();
  });

  function login(email: string, senha: string, ip = ipNovo()) {
    return requisitar(app, {
      metodo: "POST",
      url: "/api/auth/login",
      corpo: { email, senha },
      ip,
    });
  }

  function definirPeloLink(link: string, senha = SENHA_PADRAO) {
    return requisitar(app, {
      metodo: "POST",
      url: "/api/auth/senha/definir",
      corpo: { token: tokenDoLink(link), senha },
      ip: ipNovo(),
    });
  }

  function eu(sessao: string | undefined) {
    return requisitar(app, { url: "/api/auth/eu", sessao });
  }

  describe("ativação e links de senha", () => {
    test("o link de ativação define a senha, já abre a sessão e não pode ser reusado", async () => {
      const conta = await criarConta("ativa@teste.local", "Ativa");
      const { link } = await gerarLinkSenha("ativa@teste.local", "ativacao");
      assert.ok(link.startsWith("http://localhost:5173/definir-senha#token="));
      const corpo = { token: tokenDoLink(link), senha: SENHA_PADRAO };

      const resposta = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/senha/definir",
        corpo,
        ip: ipNovo(),
      });
      assert.equal(resposta.statusCode, 200);
      assert.deepEqual(resposta.json(), {
        id: conta.id,
        email: "ativa@teste.local",
        nome: "Ativa",
        admin: false,
        avatar: null,
      });
      const cookie = resposta.cookies.find((c) => c.name === "warii_sessao");
      assert.ok(cookie);
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.sameSite, "Lax");
      assert.equal(cookie.path, "/");
      assert.equal((await eu(cookie.value)).statusCode, 200);

      const repetida = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/senha/definir",
        corpo,
        ip: ipNovo(),
      });
      assert.equal(repetida.statusCode, 400);
      assert.equal(repetida.json<{ codigo: string }>().codigo, "LINK_INVALIDO");
    });

    test("gerar um link novo invalida o anterior", async () => {
      await criarConta("dois@teste.local", "Dois");
      const primeiro = await gerarLinkSenha("dois@teste.local", "ativacao");
      const segundo = await gerarLinkSenha("dois@teste.local", "ativacao");
      assert.equal((await definirPeloLink(primeiro.link)).statusCode, 400);
      assert.equal((await definirPeloLink(segundo.link)).statusCode, 200);
    });

    test("link expirado é recusado", async () => {
      await criarConta("expira@teste.local", "Expira");
      const { link } = await gerarLinkSenha("expira@teste.local", "redefinicao");
      await pool.query("UPDATE tokens_senha SET expira_em = now() - interval '1 second'");
      const resposta = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/senha/definir",
        corpo: { token: tokenDoLink(link), senha: SENHA_PADRAO },
        ip: ipNovo(),
      });
      assert.equal(resposta.statusCode, 400);
      assert.equal(resposta.json<{ codigo: string }>().codigo, "LINK_INVALIDO");
    });

    test("link de ativação vale 72 h e o de redefinição 1 h", async () => {
      await criarConta("prazos@teste.local", "Prazos");
      const agora = Date.now();
      const ativacao = await gerarLinkSenha("prazos@teste.local", "ativacao");
      const redefinicao = await gerarLinkSenha("prazos@teste.local", "redefinicao");
      assert.ok(Math.abs(ativacao.expiraEm.getTime() - agora - 3 * DIA) < 60_000);
      assert.ok(Math.abs(redefinicao.expiraEm.getTime() - agora - DIA / 24) < 60_000);
    });

    test("token com formato inválido ou senha curta: 400 de entrada inválida", async () => {
      const resposta = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/senha/definir",
        corpo: { token: "abc", senha: "curta" },
        ip: ipNovo(),
      });
      assert.equal(resposta.statusCode, 400);
      assert.equal(resposta.json<{ codigo: string }>().codigo, "ENTRADA_INVALIDA");
    });

    test("redefinir a senha pelo link revoga todas as sessões anteriores", async () => {
      const { id, sessao } = await criarContaAtiva(app, "redefine@teste.local");
      const { link } = await gerarLinkSenha("redefine@teste.local", "redefinicao");
      const resposta = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/senha/definir",
        corpo: { token: tokenDoLink(link), senha: "outra-senha-456" },
        ip: ipNovo(),
      });
      assert.equal(resposta.statusCode, 200);
      assert.equal((await eu(sessao)).statusCode, 401);
      assert.equal((await eu(cookieDeSessao(resposta))).statusCode, 200);
      assert.equal((await login("redefine@teste.local", SENHA_PADRAO)).statusCode, 401);
      assert.equal((await login("redefine@teste.local", "outra-senha-456")).statusCode, 200);
      const ativas = (await sessoesDoBanco(id)).filter((s) => s.revogada_em === null);
      assert.equal(ativas.length, 2);
    });
  });

  describe("contas", () => {
    test("e-mail duplicado (sem diferenciar maiúsculas) é recusado", async () => {
      await criarConta("unico@teste.local", "Único");
      await assert.rejects(
        criarConta("UNICO@teste.local", "Outro"),
        (erro) => erro instanceof ErroDeConta && erro.codigo === "EMAIL_EM_USO",
      );
    });

    test("link para e-mail inexistente lança CONTA_INEXISTENTE", async () => {
      await assert.rejects(
        gerarLinkSenha("ninguem@teste.local", "redefinicao"),
        (erro) => erro instanceof ErroDeConta && erro.codigo === "CONTA_INEXISTENTE",
      );
    });
  });

  describe("login e sessão", () => {
    test("login certo abre sessão; no banco fica só o HMAC do token", async () => {
      const { id } = await criarContaAtiva(app, "login@teste.local", "Logado");
      const resposta = await login("login@teste.local", SENHA_PADRAO);
      assert.equal(resposta.statusCode, 200);
      assert.deepEqual(resposta.json(), {
        id,
        email: "login@teste.local",
        nome: "Logado",
        admin: false,
        avatar: null,
      });

      const token = cookieDeSessao(resposta);
      assert.ok(token);
      const hashes = (await sessoesDoBanco(id)).map((s) => s.token_hash.toString("hex"));
      assert.ok(hashes.includes(hashDoToken(token).toString("hex")));
      assert.ok(!hashes.some((hash) => hash.includes(Buffer.from(token).toString("hex"))));

      const quem = await eu(token);
      assert.equal(quem.statusCode, 200);
      assert.deepEqual(quem.json(), {
        id,
        email: "login@teste.local",
        nome: "Logado",
        admin: false,
        avatar: null,
      });
    });

    test("o e-mail do login não diferencia maiúsculas", async () => {
      await criarContaAtiva(app, "caixa@teste.local");
      assert.equal((await login("  CAIXA@Teste.Local ", SENHA_PADRAO)).statusCode, 200);
    });

    test("a sessão dura 30 dias", async () => {
      const { id } = await criarContaAtiva(app, "prazo@teste.local");
      const [sessao] = await sessoesDoBanco(id);
      assert.ok(sessao);
      assert.ok(Math.abs(sessao.expira_em.getTime() - Date.now() - 30 * DIA) < 60_000);
    });

    test("senha errada, e-mail inexistente e conta não ativada dão a mesma resposta", async () => {
      await criarContaAtiva(app, "existe@teste.local");
      await criarConta("pendente@teste.local", "Pendente");
      const respostas = await Promise.all([
        login("existe@teste.local", "senha-errada-000"),
        login("nao-existe@teste.local", SENHA_PADRAO),
        login("pendente@teste.local", SENHA_PADRAO),
      ]);
      for (const resposta of respostas) {
        assert.equal(resposta.statusCode, 401);
        assert.deepEqual(resposta.json(), {
          codigo: "CREDENCIAIS_INVALIDAS",
          mensagem: "e-mail ou senha incorretos",
        });
        assert.equal(cookieDeSessao(resposta), undefined);
      }
    });

    test("sem cookie ou com cookie desconhecido: 401 e o cookie é apagado", async () => {
      const semCookie = await eu(undefined);
      assert.equal(semCookie.statusCode, 401);
      assert.equal(semCookie.json<{ codigo: string }>().codigo, "NAO_AUTENTICADO");

      const desconhecido = await eu("A".repeat(43));
      assert.equal(desconhecido.statusCode, 401);
      const apagado = desconhecido.cookies.find((c) => c.name === "warii_sessao");
      assert.ok(apagado);
      assert.equal(apagado.value, "");

      assert.equal((await eu("formato-invalido")).statusCode, 401);
    });

    test("logout revoga a sessão e apaga o cookie", async () => {
      const { id, sessao } = await criarContaAtiva(app, "sai@teste.local");
      const resposta = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/logout",
        sessao,
      });
      assert.equal(resposta.statusCode, 204);
      assert.equal(cookieDeSessao(resposta), "");
      assert.equal((await eu(sessao)).statusCode, 401);
      const [linha] = await sessoesDoBanco(id);
      assert.ok(linha?.revogada_em instanceof Date);
    });

    test("logout sem sessão também responde 204", async () => {
      const resposta = await requisitar(app, { metodo: "POST", url: "/api/auth/logout" });
      assert.equal(resposta.statusCode, 204);
    });

    test("login num navegador com sessão anterior revoga a anterior", async () => {
      const { sessao } = await criarContaAtiva(app, "troca@teste.local");
      const resposta = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/login",
        corpo: { email: "troca@teste.local", senha: SENHA_PADRAO },
        sessao,
        ip: ipNovo(),
      });
      assert.equal(resposta.statusCode, 200);
      assert.equal((await eu(sessao)).statusCode, 401);
      assert.equal((await eu(cookieDeSessao(resposta))).statusCode, 200);
    });

    test("sessão expirada é recusada e a limpeza a apaga", async () => {
      const { id, sessao } = await criarContaAtiva(app, "velha@teste.local");
      await pool.query("UPDATE sessoes SET expira_em = now() - interval '1 second'");
      assert.equal((await eu(sessao)).statusCode, 401);
      const apagados = await limparVencidas();
      assert.ok(apagados.sessoes >= 1);
      assert.equal((await sessoesDoBanco(id)).length, 0);
    });

    test("sessão usada depois de metade do prazo é renovada para mais 30 dias", async () => {
      const { id, sessao } = await criarContaAtiva(app, "renova@teste.local");
      await pool.query("UPDATE sessoes SET expira_em = now() + interval '10 days'");
      const resposta = await eu(sessao);
      assert.equal(resposta.statusCode, 200);
      const cookie = resposta.cookies.find((c) => c.name === "warii_sessao");
      assert.equal(cookie?.value, sessao);
      const [linha] = await sessoesDoBanco(id);
      assert.ok(linha);
      assert.ok(Math.abs(linha.expira_em.getTime() - Date.now() - 30 * DIA) < 60_000);
    });

    test("sessão com mais de metade do prazo não é renovada", async () => {
      const { sessao } = await criarContaAtiva(app, "fresca@teste.local");
      const resposta = await eu(sessao);
      assert.equal(resposta.statusCode, 200);
      assert.equal(cookieDeSessao(resposta), undefined);
    });
  });

  describe("troca de senha e sair de todas", () => {
    test("PUT /senha confere a senha atual, troca e revoga só as outras sessões", async () => {
      const { sessao } = await criarContaAtiva(app, "trocar@teste.local");
      const outra = cookieDeSessao(await login("trocar@teste.local", SENHA_PADRAO));

      const errada = await requisitar(app, {
        metodo: "PUT",
        url: "/api/auth/senha",
        corpo: { senhaAtual: "nao-e-essa-000", novaSenha: "nova-senha-789" },
        sessao,
        ip: ipNovo(),
      });
      assert.equal(errada.statusCode, 400);
      assert.equal(errada.json<{ codigo: string }>().codigo, "SENHA_ATUAL_INCORRETA");

      const certa = await requisitar(app, {
        metodo: "PUT",
        url: "/api/auth/senha",
        corpo: { senhaAtual: SENHA_PADRAO, novaSenha: "nova-senha-789" },
        sessao,
        ip: ipNovo(),
      });
      assert.equal(certa.statusCode, 204);
      assert.equal((await eu(sessao)).statusCode, 200);
      assert.equal((await eu(outra)).statusCode, 401);
      assert.equal((await login("trocar@teste.local", SENHA_PADRAO)).statusCode, 401);
      assert.equal((await login("trocar@teste.local", "nova-senha-789")).statusCode, 200);
    });

    test("PUT /senha exige sessão", async () => {
      const resposta = await requisitar(app, {
        metodo: "PUT",
        url: "/api/auth/senha",
        corpo: { senhaAtual: SENHA_PADRAO, novaSenha: "nova-senha-789" },
        ip: ipNovo(),
      });
      assert.equal(resposta.statusCode, 401);
    });

    test("sair de todas revoga todas as sessões, inclusive a atual", async () => {
      const { sessao } = await criarContaAtiva(app, "todas@teste.local");
      const outra = cookieDeSessao(await login("todas@teste.local", SENHA_PADRAO));
      const resposta = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/sair-de-todas",
        sessao,
      });
      assert.equal(resposta.statusCode, 204);
      assert.equal((await eu(sessao)).statusCode, 401);
      assert.equal((await eu(outra)).statusCode, 401);
    });
  });

  describe("proteções", () => {
    test("POST com Origin de outro site é recusado; a origem do site passa", async () => {
      await criarContaAtiva(app, "origem@teste.local");
      const corpo = { email: "origem@teste.local", senha: SENHA_PADRAO };
      const outroSite = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/login",
        corpo,
        ip: ipNovo(),
        cabecalhos: { origin: "https://site-malicioso.example" },
      });
      assert.equal(outroSite.statusCode, 403);
      assert.equal(outroSite.json<{ codigo: string }>().codigo, "ORIGEM_RECUSADA");

      const mesmoSite = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/login",
        corpo,
        ip: ipNovo(),
        cabecalhos: { origin: "http://localhost:5173" },
      });
      assert.equal(mesmoSite.statusCode, 200);
    });

    test("corpo inválido ou JSON malformado: 400 no formato { codigo, mensagem }", async () => {
      const invalido = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/login",
        corpo: { email: "nao-e-email" },
        ip: ipNovo(),
      });
      assert.equal(invalido.statusCode, 400);
      assert.equal(invalido.json<{ codigo: string }>().codigo, "ENTRADA_INVALIDA");

      const malformado = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: ipNovo(),
        headers: { "content-type": "application/json" },
        payload: "{ isto não é json",
      });
      assert.equal(malformado.statusCode, 400);
      const corpo = malformado.json<{ codigo: unknown; mensagem: unknown }>();
      assert.equal(typeof corpo.codigo, "string");
      assert.equal(typeof corpo.mensagem, "string");
    });

    test("corpo grande demais é recusado com 413", async () => {
      const resposta = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/login",
        corpo: { email: "grande@teste.local", senha: "x".repeat(10_000) },
        ip: ipNovo(),
      });
      assert.equal(resposta.statusCode, 413);
    });

    test("o login tem limite de 20 requisições por IP em 15 min", async () => {
      const ip = ipNovo();
      for (let i = 0; i < 20; i += 1) {
        const resposta = await requisitar(app, {
          metodo: "POST",
          url: "/api/auth/login",
          corpo: {},
          ip,
        });
        assert.equal(resposta.statusCode, 400, `requisição ${i + 1}`);
      }
      const excedida = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/login",
        corpo: {},
        ip,
      });
      assert.equal(excedida.statusCode, 429);
      assert.equal(excedida.json<{ codigo: string }>().codigo, "LIMITE_EXCEDIDO");
      // Outro IP não é afetado.
      const outroIp = await requisitar(app, {
        metodo: "POST",
        url: "/api/auth/login",
        corpo: {},
        ip: ipNovo(),
      });
      assert.equal(outroIp.statusCode, 400);
    });

    test("rota inexistente: 404 no formato padrão; health responde", async () => {
      const inexistente = await requisitar(app, { url: "/api/nada" });
      assert.equal(inexistente.statusCode, 404);
      assert.equal(inexistente.json<{ codigo: string }>().codigo, "NAO_ENCONTRADO");
      const saude = await requisitar(app, { url: "/api/health" });
      assert.equal(saude.statusCode, 200);
    });
  });
});
