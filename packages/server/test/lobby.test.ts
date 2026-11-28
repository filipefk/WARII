// Rotas /api/partidas (lobby) de ponta a ponta (app.inject + banco de teste). Ver ambiente.ts.
import { motivoSemBanco } from "./ambiente.js";

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import { type EstadoPartida, rngDeReplay, type Sorteio } from "@warii/engine";
import type { ErroApi, PartidaLobbyDto, PartidaResumoDto } from "@warii/shared";
import type { FastifyInstance } from "fastify";

import { pool } from "../src/db/index.js";
import { type AcaoCriacao, montarPartida } from "../src/partidas/inicio.js";
import {
  criarContasAtivas,
  encerrarAppDeTeste,
  iniciarAppDeTeste,
  ipNovo,
  limparBanco,
  requisitar,
} from "./apoio.js";

interface Conta {
  id: string;
  sessao: string;
  nome: string;
}

function tokenDoConvite(lobby: PartidaLobbyDto): string {
  assert.ok(lobby.convite, "lobby sem convite");
  const token = new URL(lobby.convite).hash.replace(/^#token=/, "");
  assert.ok(token);
  return token;
}

describe("rotas /api/partidas", { skip: motivoSemBanco, concurrency: false }, () => {
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

  // IP novo a cada pedido, para o rate limit (por IP) não interferir nos testes.
  function pedir(
    conta: Conta,
    metodo: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    corpo?: Record<string, unknown>,
  ) {
    return requisitar(app, {
      metodo,
      url: `/api/partidas${url}`,
      corpo,
      sessao: conta.sessao,
      ip: ipNovo(),
    });
  }

  async function codigoDoErro(promessa: ReturnType<typeof pedir>, status: number): Promise<string> {
    const resposta = await promessa;
    assert.equal(resposta.statusCode, status, resposta.body);
    return resposta.json<ErroApi>().codigo;
  }

  async function criar(anfitriao: Conta, nome = "Partida de teste"): Promise<PartidaLobbyDto> {
    const resposta = await pedir(anfitriao, "POST", "/", { nome });
    assert.equal(resposta.statusCode, 201, resposta.body);
    return resposta.json<PartidaLobbyDto>();
  }

  async function entrar(conta: Conta, token: string) {
    return pedir(conta, "POST", "/entrar", { token });
  }

  // Partida com os jogadores dados já dentro e todos com cor (o primeiro é o anfitrião).
  async function salaPronta(contas: Conta[]): Promise<PartidaLobbyDto> {
    const [anfitriao, ...outros] = contas;
    assert.ok(anfitriao);
    const lobby = await criar(anfitriao);
    const token = tokenDoConvite(lobby);
    for (const conta of outros) assert.equal((await entrar(conta, token)).statusCode, 200);
    const cores = ["vermelho", "azul", "verde", "preto", "branco", "amarelo"];
    for (const [i, conta] of contas.entries()) {
      const r = await pedir(conta, "PUT", `/${lobby.id}/cor`, { cor: cores[i] });
      assert.equal(r.statusCode, 200, r.body);
    }
    return lobby;
  }

  test("exige login", async () => {
    const resposta = await requisitar(app, { url: "/api/partidas" });
    assert.equal(resposta.statusCode, 401);
  });

  test("fluxo completo: criar, entrar pelo convite, escolher cores, configurar e iniciar", async () => {
    const [a, b, c, d] = await criarContasAtivas(app, 4);
    assert.ok(a && b && c && d);

    const lobby = await criar(a, "  Sexta à noite ");
    assert.equal(lobby.nome, "Sexta à noite");
    assert.equal(lobby.status, "aguardando");
    assert.equal(lobby.anfitriao.id, a.id);
    assert.ok(lobby.convite?.startsWith("http://localhost:5173/convite#token="));
    assert.deepEqual(
      lobby.participantes.map((p) => [p.usuarioId, p.anfitriao, p.cor]),
      [[a.id, true, null]],
    );

    const token = tokenDoConvite(lobby);
    const entrouB = await entrar(b, token);
    assert.equal(entrouB.statusCode, 200);
    // Quem não é anfitrião não vê o convite.
    assert.equal(entrouB.json<PartidaLobbyDto>().convite, null);
    // Entrar de novo não duplica.
    assert.equal((await entrar(b, token)).statusCode, 200);
    assert.equal((await entrar(c, token)).statusCode, 200);

    for (const [conta, cor] of [
      [a, "vermelho"],
      [b, "azul"],
      [c, "verde"],
    ] as const) {
      assert.equal((await pedir(conta, "PUT", `/${lobby.id}/cor`, { cor })).statusCode, 200);
    }

    const configurada = await pedir(a, "PUT", `/${lobby.id}/parametros`, {
      parametros: { limiteMao: 6, somarBaseECaixa: false },
    });
    assert.equal(configurada.statusCode, 200, configurada.body);
    const parametros = configurada.json<PartidaLobbyDto>().parametros;
    assert.equal(parametros.limiteMao, 6);
    assert.equal(parametros.somarBaseECaixa, false);
    assert.equal(parametros.cartasPorConquista, 3);

    const lista = await pedir(b, "GET", "/");
    assert.equal(lista.statusCode, 200);
    const resumos = lista.json<PartidaResumoDto[]>();
    assert.equal(resumos.length, 1);
    assert.equal(resumos[0]?.quantidadeParticipantes, 3);

    const iniciada = await pedir(a, "POST", `/${lobby.id}/iniciar`);
    assert.equal(iniciada.statusCode, 200, iniciada.body);
    const final = iniciada.json<PartidaLobbyDto>();
    assert.equal(final.status, "em_andamento");
    assert.equal(final.convite, null);
    assert.ok(final.iniciadaEm);
    assert.deepEqual(
      final.participantes.map((p) => p.assento),
      [0, 1, 2],
    );

    // Depois de iniciar, o convite não vale mais e o lobby não muda.
    assert.equal(await codigoDoErro(entrar(d, token), 404), "CONVITE_INVALIDO");
    assert.equal(
      await codigoDoErro(pedir(b, "PUT", `/${lobby.id}/cor`, { cor: "preto" }), 409),
      "PARTIDA_JA_INICIADA",
    );
    assert.equal(
      await codigoDoErro(pedir(a, "POST", `/${lobby.id}/iniciar`), 409),
      "PARTIDA_JA_INICIADA",
    );
  });

  test("ao iniciar grava a ação seq 0 e o snapshot, e o replay reproduz o estado", async () => {
    const contas = await criarContasAtivas(app, 4);
    const lobby = await salaPronta(contas);
    const [anfitriao] = contas;
    assert.ok(anfitriao);
    const final = (await pedir(anfitriao, "POST", `/${lobby.id}/iniciar`)).json<PartidaLobbyDto>();

    const { rows: partidas } = await pool.query<{
      status: string;
      seq: number;
      convite: string | null;
    }>("SELECT status, seq, convite FROM partidas WHERE id = $1", [lobby.id]);
    assert.deepEqual(partidas, [{ status: "em_andamento", seq: 0, convite: null }]);

    const { rows: acoes } = await pool.query<{
      seq: number;
      usuario_id: string | null;
      tipo: string;
      acao: AcaoCriacao;
      sorteios: Sorteio[];
    }>("SELECT seq, usuario_id, tipo, acao, sorteios FROM acoes_partida WHERE partida_id = $1", [
      lobby.id,
    ]);
    assert.equal(acoes.length, 1);
    const [criacao] = acoes;
    assert.ok(criacao);
    assert.equal(criacao.seq, 0);
    assert.equal(criacao.usuario_id, null);
    assert.equal(criacao.tipo, "criarPartida");
    assert.ok(criacao.sorteios.length > 0);

    const { rows: snaps } = await pool.query<{ seq: number; estado: EstadoPartida }>(
      "SELECT seq, estado FROM snapshots WHERE partida_id = $1",
      [lobby.id],
    );
    assert.equal(snaps.length, 1);
    const [snapshot] = snaps;
    assert.ok(snapshot);
    assert.equal(snapshot.seq, 0);

    // A ordem da mesa no estado é a dos assentos do lobby.
    const porAssento = final.participantes.toSorted((x, y) => (x.assento ?? 0) - (y.assento ?? 0));
    assert.deepEqual(
      snapshot.estado.jogadores.map((j) => [j.id, j.cor]),
      porAssento.map((p) => [p.usuarioId, p.cor]),
    );

    const replay = rngDeReplay(criacao.sorteios);
    const { resultado } = montarPartida(criacao.acao, replay);
    assert.ok(resultado.ok);
    assert.equal(replay.restantes(), 0);
    assert.deepEqual(resultado.estado, snapshot.estado);
  });

  test("o log é só de inclusão: UPDATE e DELETE são recusados pelo banco", async () => {
    const contas = await criarContasAtivas(app, 3);
    const [anfitriao] = contas;
    assert.ok(anfitriao);
    const lobby = await salaPronta(contas);
    assert.equal((await pedir(anfitriao, "POST", `/${lobby.id}/iniciar`)).statusCode, 200);
    await assert.rejects(
      pool.query("UPDATE acoes_partida SET tipo = 'outro' WHERE partida_id = $1", [lobby.id]),
      /só de inclusão/,
    );
    await assert.rejects(
      pool.query("DELETE FROM acoes_partida WHERE partida_id = $1", [lobby.id]),
      /só de inclusão/,
    );
  });

  test("cor ocupada é recusada e trocar de cor libera a anterior", async () => {
    const [a, b] = await criarContasAtivas(app, 2);
    assert.ok(a && b);
    const lobby = await criar(a);
    await entrar(b, tokenDoConvite(lobby));
    assert.equal((await pedir(a, "PUT", `/${lobby.id}/cor`, { cor: "azul" })).statusCode, 200);
    assert.equal(
      await codigoDoErro(pedir(b, "PUT", `/${lobby.id}/cor`, { cor: "azul" }), 409),
      "COR_OCUPADA",
    );
    assert.equal((await pedir(a, "PUT", `/${lobby.id}/cor`, { cor: "preto" })).statusCode, 200);
    assert.equal((await pedir(b, "PUT", `/${lobby.id}/cor`, { cor: "azul" })).statusCode, 200);
    assert.equal(
      await codigoDoErro(pedir(b, "PUT", `/${lobby.id}/cor`, { cor: "rosa" }), 400),
      "ENTRADA_INVALIDA",
    );
  });

  test("só o anfitrião configura, renova o convite, remove, cancela e inicia", async () => {
    const contas = await criarContasAtivas(app, 3);
    const [a, b, c] = contas;
    assert.ok(a && b && c);
    const lobby = await salaPronta(contas);
    const proibidas = [
      pedir(b, "PUT", `/${lobby.id}/parametros`, { parametros: { limiteMao: 6 } }),
      pedir(b, "POST", `/${lobby.id}/convite`),
      pedir(b, "DELETE", `/${lobby.id}/participantes/${c.id}`),
      pedir(b, "POST", `/${lobby.id}/cancelar`),
      pedir(b, "POST", `/${lobby.id}/iniciar`),
    ];
    for (const proibida of proibidas) {
      assert.equal(await codigoDoErro(proibida, 403), "SOMENTE_ANFITRIAO");
    }
  });

  test("quem não participa recebe 404, como se a partida não existisse", async () => {
    const [a, estranho] = await criarContasAtivas(app, 2);
    assert.ok(a && estranho);
    const lobby = await criar(a);
    for (const pedido of [
      pedir(estranho, "GET", `/${lobby.id}`),
      pedir(estranho, "PUT", `/${lobby.id}/cor`, { cor: "azul" }),
      pedir(estranho, "POST", `/${lobby.id}/iniciar`),
      pedir(estranho, "GET", "/nao-e-uuid"),
      pedir(a, "GET", "/00000000-0000-4000-8000-000000000000"),
    ]) {
      assert.equal(await codigoDoErro(pedido, 404), "PARTIDA_INEXISTENTE");
    }
    assert.deepEqual((await pedir(estranho, "GET", "/")).json(), []);
  });

  test("iniciar exige de 3 a 6 jogadores, todos com cor", async () => {
    const [a, b, c] = await criarContasAtivas(app, 3);
    assert.ok(a && b && c);
    const lobby = await salaPronta([a, b]);
    assert.equal(
      await codigoDoErro(pedir(a, "POST", `/${lobby.id}/iniciar`), 409),
      "JOGADORES_INSUFICIENTES",
    );
    await entrar(c, tokenDoConvite(lobby));
    assert.equal(await codigoDoErro(pedir(a, "POST", `/${lobby.id}/iniciar`), 409), "COR_PENDENTE");
  });

  test("a partida aceita no máximo 6 jogadores", async () => {
    const contas = await criarContasAtivas(app, 7);
    const lobby = await salaPronta(contas.slice(0, 6));
    const setimo = contas[6];
    assert.ok(setimo);
    const token = tokenDoConvite(lobby);
    assert.equal(await codigoDoErro(entrar(setimo, token), 409), "PARTIDA_CHEIA");
  });

  test("partida pública: aparece para todos e qualquer um entra sem convite", async () => {
    const [a, b, c] = await criarContasAtivas(app, 3);
    assert.ok(a && b && c);
    const publicas = async (conta: Conta) => {
      const r = await pedir(conta, "GET", "/publicas");
      assert.equal(r.statusCode, 200, r.body);
      return r.json<PartidaResumoDto[]>().map((p) => p.id);
    };

    const privada = await criar(a, "Privada");
    assert.equal(privada.publica, false);
    const resposta = await pedir(a, "POST", "/", { nome: "Pública", publica: true });
    assert.equal(resposta.statusCode, 201, resposta.body);
    const publica = resposta.json<PartidaLobbyDto>();
    assert.equal(publica.publica, true);

    // Só a pública aparece, e não para quem já está nela.
    assert.deepEqual(await publicas(b), [publica.id]);
    assert.deepEqual(await publicas(a), []);

    const entrou = await pedir(b, "POST", `/${publica.id}/entrar`);
    assert.equal(entrou.statusCode, 200, entrou.body);
    assert.deepEqual(
      entrou.json<PartidaLobbyDto>().participantes.map((p) => p.usuarioId),
      [a.id, b.id],
    );
    assert.deepEqual(await publicas(b), []);
    assert.deepEqual(await publicas(c), [publica.id]);
    // Entrar de novo não duplica.
    assert.equal((await pedir(b, "POST", `/${publica.id}/entrar`)).statusCode, 200);

    // A privada não deixa entrar sem convite e não revela que existe.
    assert.equal(
      await codigoDoErro(pedir(c, "POST", `/${privada.id}/entrar`), 404),
      "PARTIDA_INEXISTENTE",
    );

    // Cancelada, some da lista e não aceita mais entradas.
    assert.equal((await pedir(a, "POST", `/${publica.id}/cancelar`)).statusCode, 204);
    assert.deepEqual(await publicas(c), []);
    assert.equal(
      await codigoDoErro(pedir(c, "POST", `/${publica.id}/entrar`), 409),
      "PARTIDA_JA_INICIADA",
    );
  });

  test("partida pública cheia some da lista e recusa a entrada", async () => {
    const contas = await criarContasAtivas(app, 7);
    const [anfitriao, ...outros] = contas;
    assert.ok(anfitriao);
    const resposta = await pedir(anfitriao, "POST", "/", { nome: "Cheia", publica: true });
    const lobby = resposta.json<PartidaLobbyDto>();
    for (const conta of outros.slice(0, 5)) {
      assert.equal((await pedir(conta, "POST", `/${lobby.id}/entrar`)).statusCode, 200);
    }
    const setimo = outros[5];
    assert.ok(setimo);
    const lista = await pedir(setimo, "GET", "/publicas");
    assert.deepEqual(lista.json<PartidaResumoDto[]>(), []);
    assert.equal(
      await codigoDoErro(pedir(setimo, "POST", `/${lobby.id}/entrar`), 409),
      "PARTIDA_CHEIA",
    );
  });

  test("renovar o convite invalida o anterior; quem já entrou continua", async () => {
    const [a, b, c] = await criarContasAtivas(app, 3);
    assert.ok(a && b && c);
    const lobby = await criar(a);
    const antigo = tokenDoConvite(lobby);
    await entrar(b, antigo);
    const renovado = (await pedir(a, "POST", `/${lobby.id}/convite`)).json<PartidaLobbyDto>();
    const novo = tokenDoConvite(renovado);
    assert.notEqual(novo, antigo);
    assert.equal(renovado.participantes.length, 2);
    assert.equal(await codigoDoErro(entrar(c, antigo), 404), "CONVITE_INVALIDO");
    assert.equal((await entrar(c, novo)).statusCode, 200);
    assert.equal(await codigoDoErro(entrar(c, "x".repeat(10)), 400), "ENTRADA_INVALIDA");
  });

  test("parâmetros inválidos são recusados (formato e regras do engine)", async () => {
    const [a] = await criarContasAtivas(app, 1);
    assert.ok(a);
    const lobby = await criar(a);
    assert.equal(
      await codigoDoErro(
        pedir(a, "PUT", `/${lobby.id}/parametros`, { parametros: { limiteMao: "6" } }),
        400,
      ),
      "ENTRADA_INVALIDA",
    );
    assert.equal(
      await codigoDoErro(
        pedir(a, "PUT", `/${lobby.id}/parametros`, { parametros: { centroInformacoes: true } }),
        400,
      ),
      "PARAMETROS_INVALIDOS",
    );
  });

  test("sair, remover e cancelar", async () => {
    const [a, b, c] = await criarContasAtivas(app, 3);
    assert.ok(a && b && c);
    const lobby = await criar(a);
    const token = tokenDoConvite(lobby);
    await entrar(b, token);
    await entrar(c, token);

    assert.equal((await pedir(b, "POST", `/${lobby.id}/sair`)).statusCode, 204);
    assert.equal(await codigoDoErro(pedir(b, "GET", `/${lobby.id}`), 404), "PARTIDA_INEXISTENTE");
    assert.equal(
      await codigoDoErro(pedir(a, "POST", `/${lobby.id}/sair`), 409),
      "ANFITRIAO_NAO_SAI",
    );

    const semC = await pedir(a, "DELETE", `/${lobby.id}/participantes/${c.id}`);
    assert.equal(semC.statusCode, 200);
    assert.deepEqual(
      semC.json<PartidaLobbyDto>().participantes.map((p) => p.usuarioId),
      [a.id],
    );
    assert.equal(
      await codigoDoErro(pedir(a, "DELETE", `/${lobby.id}/participantes/${c.id}`), 404),
      "PARTICIPANTE_INEXISTENTE",
    );

    assert.equal((await pedir(a, "POST", `/${lobby.id}/cancelar`)).statusCode, 204);
    assert.deepEqual((await pedir(a, "GET", "/")).json(), []);
    assert.equal(await codigoDoErro(entrar(b, token), 404), "CONVITE_INVALIDO");
  });

  test("um anfitrião tem no máximo 5 partidas aguardando", async () => {
    const [a] = await criarContasAtivas(app, 1);
    assert.ok(a);
    for (let i = 0; i < 5; i++) await criar(a, `Partida ${i}`);
    assert.equal(
      await codigoDoErro(pedir(a, "POST", "/", { nome: "Sexta" }), 409),
      "LIMITE_DE_PARTIDAS",
    );
  });

  test("robôs: só o anfitrião adiciona, escolhe a cor e remove; robô não faz login", async () => {
    const [a, b] = await criarContasAtivas(app, 2);
    assert.ok(a && b);
    const lobby = await criar(a);
    assert.equal(
      (await pedir(b, "POST", "/entrar", { token: tokenDoConvite(lobby) })).statusCode,
      200,
    );

    assert.equal(
      await codigoDoErro(pedir(b, "POST", `/${lobby.id}/robos`), 403),
      "SOMENTE_ANFITRIAO",
    );
    const comRobo = await pedir(a, "POST", `/${lobby.id}/robos`);
    assert.equal(comRobo.statusCode, 201, comRobo.body);
    const robo = comRobo.json<PartidaLobbyDto>().participantes.find((p) => p.robo);
    assert.ok(robo, "robô não entrou");
    assert.equal(robo.nome, "Robô Alfa");
    assert.ok(robo.cor !== null, "robô sem cor");

    // Cor do robô: só o anfitrião, e só de robô.
    const corDoRobo = `/${lobby.id}/participantes/${robo.usuarioId}/cor`;
    assert.equal(
      await codigoDoErro(pedir(b, "PUT", corDoRobo, { cor: "amarelo" }), 403),
      "SOMENTE_ANFITRIAO",
    );
    const amarelo = await pedir(a, "PUT", corDoRobo, { cor: "amarelo" });
    assert.equal(amarelo.statusCode, 200, amarelo.body);
    assert.equal(amarelo.json<PartidaLobbyDto>().participantes.find((p) => p.robo)?.cor, "amarelo");
    assert.equal(
      await codigoDoErro(
        pedir(a, "PUT", `/${lobby.id}/participantes/${b.id}/cor`, { cor: "verde" }),
        403,
      ),
      "SOMENTE_ROBO",
    );
    assert.equal(
      await codigoDoErro(pedir(b, "PUT", `/${lobby.id}/cor`, { cor: "amarelo" }), 409),
      "COR_OCUPADA",
    );

    // Até completar 6 jogadores; depois disso, partida cheia.
    for (let i = 0; i < 3; i++) {
      assert.equal((await pedir(a, "POST", `/${lobby.id}/robos`)).statusCode, 201);
    }
    assert.equal(await codigoDoErro(pedir(a, "POST", `/${lobby.id}/robos`), 409), "PARTIDA_CHEIA");

    const semRobo = await pedir(a, "DELETE", `/${lobby.id}/participantes/${robo.usuarioId}`);
    assert.equal(semRobo.statusCode, 200);
    assert.equal(semRobo.json<PartidaLobbyDto>().participantes.filter((p) => p.robo).length, 3);

    const login = await requisitar(app, {
      metodo: "POST",
      url: "/api/auth/login",
      corpo: { email: "robo1@robos.invalid", senha: "qualquer-senha-123" },
      ip: ipNovo(),
    });
    assert.equal(login.statusCode, 401);
  });
});
