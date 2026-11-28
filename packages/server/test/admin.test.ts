// Rotas /api/admin (usuários e partidas) de ponta a ponta (app.inject + banco de teste).
import { motivoSemBanco } from "./ambiente.js";

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import type {
  ErroApi,
  LinkSenhaDto,
  LogUsuarioDto,
  PartidaAdminDto,
  PartidaLobbyDto,
  UsuarioAdminDto,
  UsuarioDto,
} from "@warii/shared";
import type { FastifyInstance } from "fastify";

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

type Metodo = "GET" | "POST" | "PUT" | "DELETE";

describe("rotas /api/admin", { skip: motivoSemBanco, concurrency: false }, () => {
  let app: FastifyInstance;
  let admin: { id: string; sessao: string };

  before(async () => {
    app = await iniciarAppDeTeste();
  });
  after(async () => {
    await encerrarAppDeTeste(app);
  });
  beforeEach(async () => {
    await limparBanco();
    admin = await criarContaAtiva(app, "chefe@teste.local", "Chefe");
    await pool.query("UPDATE usuarios SET admin = true WHERE id = $1", [admin.id]);
  });

  function pedir(sessao: string, metodo: Metodo, url: string, corpo?: Record<string, unknown>) {
    return requisitar(app, { metodo, url, corpo, sessao, ip: ipNovo() });
  }

  async function codigoDoErro(promessa: ReturnType<typeof pedir>, status: number): Promise<string> {
    const resposta = await promessa;
    assert.equal(resposta.statusCode, status, resposta.body);
    return resposta.json<ErroApi>().codigo;
  }

  async function criarUsuario(email: string, nome: string, extra = {}): Promise<UsuarioAdminDto> {
    const r = await pedir(admin.sessao, "POST", "/api/admin/usuarios", { email, nome, ...extra });
    assert.equal(r.statusCode, 201, r.body);
    return r.json<UsuarioAdminDto>();
  }

  // Partida do admin com dois robôs, já iniciada (os robôs jogam sozinhos na vez deles).
  async function partidaComRobos(iniciar: boolean): Promise<string> {
    const criada = await pedir(admin.sessao, "POST", "/api/partidas", { nome: "Teste" });
    const lobby = criada.json<PartidaLobbyDto>();
    await pedir(admin.sessao, "PUT", `/api/partidas/${lobby.id}/cor`, { cor: "vermelho" });
    for (let i = 0; i < 2; i++) {
      assert.equal(
        (await pedir(admin.sessao, "POST", `/api/partidas/${lobby.id}/robos`)).statusCode,
        201,
      );
    }
    if (iniciar) {
      const r = await pedir(admin.sessao, "POST", `/api/partidas/${lobby.id}/iniciar`);
      assert.equal(r.statusCode, 200, r.body);
    }
    return lobby.id;
  }

  test("só o administrador entra; /eu diz quem é", async () => {
    const comum = await criarContaAtiva(app, "comum@teste.local", "Comum");
    assert.equal(
      await codigoDoErro(pedir(comum.sessao, "GET", "/api/admin/usuarios"), 403),
      "SOMENTE_ADMIN",
    );
    assert.equal(
      await codigoDoErro(pedir(comum.sessao, "GET", "/api/admin/partidas"), 403),
      "SOMENTE_ADMIN",
    );
    assert.equal((await requisitar(app, { url: "/api/admin/usuarios" })).statusCode, 401);

    const eu = (await pedir(admin.sessao, "GET", "/api/auth/eu")).json<UsuarioDto>();
    assert.equal(eu.admin, true);
    assert.equal(
      (await pedir(comum.sessao, "GET", "/api/auth/eu")).json<UsuarioDto>().admin,
      false,
    );
  });

  test("CRUD de usuários, sem robôs na lista", async () => {
    const novo = await criarUsuario("novo@teste.local", "Novo");
    assert.deepEqual(
      { ...novo, id: undefined, criadoEm: undefined },
      {
        id: undefined,
        criadoEm: undefined,
        email: "novo@teste.local",
        nome: "Novo",
        admin: false,
        ativa: false,
        partidas: 0,
        avatar: null,
      },
    );
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "POST", "/api/admin/usuarios", {
          email: "NOVO@teste.local",
          nome: "Outro",
        }),
        409,
      ),
      "EMAIL_EM_USO",
    );
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "POST", "/api/admin/usuarios", {
          email: "x@robos.invalid",
          nome: "Robô",
        }),
        400,
      ),
      "EMAIL_RESERVADO",
    );

    const editado = await pedir(admin.sessao, "PUT", `/api/admin/usuarios/${novo.id}`, {
      nome: "Renomeado",
      email: "renomeado@teste.local",
      admin: true,
    });
    assert.equal(editado.statusCode, 200, editado.body);
    assert.equal(editado.json<UsuarioAdminDto>().nome, "Renomeado");
    assert.equal(editado.json<UsuarioAdminDto>().admin, true);
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "PUT", `/api/admin/usuarios/${novo.id}`, {
          email: "chefe@teste.local",
        }),
        409,
      ),
      "EMAIL_EM_USO",
    );

    await partidaComRobos(false);
    const lista = (await pedir(admin.sessao, "GET", "/api/admin/usuarios")).json<
      UsuarioAdminDto[]
    >();
    assert.deepEqual(lista.map((u) => u.nome).toSorted(), ["Chefe", "Renomeado"]);
    assert.equal(lista.find((u) => u.id === admin.id)?.partidas, 1);

    assert.equal(
      (await pedir(admin.sessao, "DELETE", `/api/admin/usuarios/${novo.id}`)).statusCode,
      204,
    );
    assert.equal(
      await codigoDoErro(pedir(admin.sessao, "DELETE", `/api/admin/usuarios/${novo.id}`), 404),
      "USUARIO_INEXISTENTE",
    );
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "PUT", "/api/admin/usuarios/nao-e-uuid", { nome: "Xx" }),
        404,
      ),
      "USUARIO_INEXISTENTE",
    );
  });

  test("o administrador não se tranca fora; usuário com partidas não é apagado", async () => {
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "PUT", `/api/admin/usuarios/${admin.id}`, { admin: false }),
        409,
      ),
      "PROPRIO_ADMIN",
    );
    assert.equal(
      await codigoDoErro(pedir(admin.sessao, "DELETE", `/api/admin/usuarios/${admin.id}`), 409),
      "PROPRIA_CONTA",
    );
    const jogador = await criarContaAtiva(app, "jogador@teste.local", "Jogador");
    await pedir(jogador.sessao, "POST", "/api/partidas", { nome: "Dele" });
    assert.equal(
      await codigoDoErro(pedir(admin.sessao, "DELETE", `/api/admin/usuarios/${jogador.id}`), 409),
      "USUARIO_COM_PARTIDAS",
    );
    // Robôs não podem ser alterados por aqui.
    await partidaComRobos(false);
    const { rows } = await pool.query<{ id: string }>("SELECT id FROM usuarios WHERE robo LIMIT 1");
    const roboId = rows[0]?.id;
    assert.ok(roboId);
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "PUT", `/api/admin/usuarios/${roboId}`, { nome: "Hack" }),
        404,
      ),
      "USUARIO_INEXISTENTE",
    );
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "POST", `/api/admin/usuarios/${roboId}/link-senha`),
        404,
      ),
      "USUARIO_INEXISTENTE",
    );
  });

  test("link de senha: ativação e depois redefinição", async () => {
    const novo = await criarUsuario("novo@teste.local", "Novo");
    const r1 = await pedir(admin.sessao, "POST", `/api/admin/usuarios/${novo.id}/link-senha`);
    assert.equal(r1.statusCode, 200, r1.body);
    const link1 = r1.json<LinkSenhaDto>();
    assert.equal(link1.finalidade, "ativacao");
    assert.ok(link1.link.startsWith("http://localhost:5173/definir-senha#token="));

    const ativou = await requisitar(app, {
      metodo: "POST",
      url: "/api/auth/senha/definir",
      corpo: { token: tokenDoLink(link1.link), senha: SENHA_PADRAO },
      ip: ipNovo(),
    });
    assert.equal(ativou.statusCode, 200, ativou.body);

    const r2 = await pedir(admin.sessao, "POST", `/api/admin/usuarios/${novo.id}/link-senha`);
    assert.equal(r2.json<LinkSenhaDto>().finalidade, "redefinicao");
  });

  test("senha definida pelo administrador encerra as sessões do usuário", async () => {
    const jogador = await criarContaAtiva(app, "jogador@teste.local", "Jogador");
    const r = await pedir(admin.sessao, "PUT", `/api/admin/usuarios/${jogador.id}/senha`, {
      senha: "nova-senha-escolhida",
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json<UsuarioAdminDto>().ativa, true);
    assert.equal((await pedir(jogador.sessao, "GET", "/api/auth/eu")).statusCode, 401);

    const login = await requisitar(app, {
      metodo: "POST",
      url: "/api/auth/login",
      corpo: { email: "jogador@teste.local", senha: "nova-senha-escolhida" },
      ip: ipNovo(),
    });
    assert.equal(login.statusCode, 200, login.body);
    assert.ok(cookieDeSessao(login));
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "PUT", `/api/admin/usuarios/${jogador.id}/senha`, { senha: "" }),
        400,
      ),
      "ENTRADA_INVALIDA",
    );

    // A própria senha: a sessão atual continua.
    const propria = await pedir(admin.sessao, "PUT", `/api/admin/usuarios/${admin.id}/senha`, {
      senha: "outra-senha-do-chefe",
    });
    assert.equal(propria.statusCode, 200, propria.body);
    assert.equal((await pedir(admin.sessao, "GET", "/api/auth/eu")).statusCode, 200);
  });

  test("encerrar: a que aguarda é cancelada, a em andamento fica encerrada e para", async () => {
    const aguardando = await partidaComRobos(false);
    assert.equal(
      (await pedir(admin.sessao, "POST", `/api/admin/partidas/${aguardando}/encerrar`)).statusCode,
      204,
    );

    const emJogo = await partidaComRobos(true);
    assert.equal(
      (await pedir(admin.sessao, "POST", `/api/admin/partidas/${emJogo}/encerrar`)).statusCode,
      204,
    );
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "POST", `/api/admin/partidas/${emJogo}/encerrar`),
        409,
      ),
      "PARTIDA_JA_ENCERRADA",
    );

    const lista = (await pedir(admin.sessao, "GET", "/api/admin/partidas")).json<
      PartidaAdminDto[]
    >();
    const porId = new Map(lista.map((p) => [p.id, p]));
    assert.equal(porId.get(aguardando)?.status, "cancelada");
    const encerrada = porId.get(emJogo);
    assert.equal(encerrada?.status, "encerrada");
    assert.equal(encerrada?.vencedor, null);
    assert.equal(encerrada?.participantes.length, 3);
    assert.ok(encerrada?.encerradaEm);

    // Os robôs param: o log não cresce mais.
    await new Promise((r) => setTimeout(r, 200));
    const { rows: antes } = await pool.query<{ seq: number }>(
      "SELECT seq FROM partidas WHERE id = $1",
      [emJogo],
    );
    await new Promise((r) => setTimeout(r, 200));
    const { rows: depois } = await pool.query<{ seq: number }>(
      "SELECT seq FROM partidas WHERE id = $1",
      [emJogo],
    );
    assert.equal(depois[0]?.seq, antes[0]?.seq);
  });

  test("apagar: a partida some com log, snapshots e participantes", async () => {
    const emJogo = await partidaComRobos(true);
    assert.equal(
      (await pedir(admin.sessao, "DELETE", `/api/admin/partidas/${emJogo}`)).statusCode,
      204,
    );
    assert.equal(
      await codigoDoErro(pedir(admin.sessao, "DELETE", `/api/admin/partidas/${emJogo}`), 404),
      "PARTIDA_INEXISTENTE",
    );
    for (const tabela of ["acoes_partida", "snapshots", "participantes"]) {
      const { rows } = await pool.query<{ total: string }>(
        `SELECT count(*) AS total FROM ${tabela} WHERE partida_id = $1`,
        [emJogo],
      );
      assert.equal(rows[0]?.total, "0", tabela);
    }
    // Fora dessa transação o log continua só de inclusão.
    const outra = await partidaComRobos(true);
    await assert.rejects(pool.query("DELETE FROM acoes_partida WHERE partida_id = $1", [outra]));
    assert.equal(
      await codigoDoErro(pedir(admin.sessao, "GET", `/api/partidas/${emJogo}`), 404),
      "PARTIDA_INEXISTENTE",
    );
  });

  test("log do jogador: entradas, partidas criadas e jogadas, mesmo depois de apagada", async () => {
    const emJogo = await partidaComRobos(true);
    await partidaComRobos(false);
    const r = await pedir(admin.sessao, "GET", `/api/admin/usuarios/${admin.id}/log`);
    assert.equal(r.statusCode, 200, r.body);
    const log = r.json<LogUsuarioDto[]>();
    assert.deepEqual(
      log.map((l) => l.tipo),
      ["partida_criada", "partida_iniciada", "partida_criada", "login"],
    );
    const jogou = log.find((l) => l.tipo === "partida_iniciada");
    assert.deepEqual(jogou?.partida, { id: emJogo, nome: "Teste" });
    assert.equal(jogou?.adversarios.length, 2);
    assert.ok(jogou?.adversarios.every((a) => a.robo));

    await pedir(admin.sessao, "DELETE", `/api/admin/partidas/${emJogo}`);
    const depois = (await pedir(admin.sessao, "GET", `/api/admin/usuarios/${admin.id}/log`)).json<
      LogUsuarioDto[]
    >();
    assert.deepEqual(depois.find((l) => l.tipo === "partida_iniciada")?.partida, {
      id: null,
      nome: "Teste",
    });

    // Robôs não têm log; só o administrador o vê.
    const { rows } = await pool.query<{ total: string }>(
      "SELECT count(*) AS total FROM log_usuarios l JOIN usuarios u ON u.id = l.usuario_id WHERE u.robo",
    );
    assert.equal(rows[0]?.total, "0");
    const comum = await criarUsuario("comum@teste.local", "Comum");
    assert.equal(
      await codigoDoErro(
        pedir(admin.sessao, "GET", "/api/admin/usuarios/00000000-0000-4000-8000-000000000000/log"),
        404,
      ),
      "USUARIO_INEXISTENTE",
    );
    assert.equal(
      (await pedir(admin.sessao, "GET", `/api/admin/usuarios/${comum.id}/log`)).json<
        LogUsuarioDto[]
      >().length,
      0,
    );
  });
});
