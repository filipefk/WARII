// Servidor de partida em tempo real (Socket.IO) de ponta a ponta: app escutando numa porta livre,
// clientes socket.io-client e banco de teste. Ver ambiente.ts.
import { motivoSemBanco } from "./ambiente.js";

import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";

import {
  type Acao,
  type EstadoPartida,
  IDS_TERRITORIOS,
  OBJETIVO_SUBSTITUTO_DESTRUIR,
  type Rng,
  rngComSemente,
  visaoDoJogador,
} from "@warii/engine";
import type { Confirmacao } from "@warii/shared";
import { asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { escolherAcao } from "../../engine/test/apoio.js";
import { db, pool } from "../src/db/index.js";
import { acoesPartida } from "../src/db/schema.js";
import { LIMITES_DO_SOCKET } from "../src/tempoReal/limite.js";
import {
  carregarDoBanco,
  descartarPartida,
  naFila,
  type PartidaAtiva,
  partidaAtiva,
  repetirLog,
} from "../src/tempoReal/partidasAtivas.js";
import { criarContaAtiva, criarContasAtivas, ipNovo, limparBanco, requisitar } from "./apoio.js";
import {
  type Cliente,
  type Conta,
  conectar,
  conferirSemSegredosAlheios,
  Escuta,
  esperarDesconexao,
  iniciar,
  iniciarAppComPorta,
  criarSala,
  montarLobby,
  novoCliente,
  pedir,
  PRAZO_MS,
  semTipo,
  tokenDoConvite,
} from "./apoioSocket.js";

const LIMITES_PADRAO = { ...LIMITES_DO_SOCKET };

interface Jogador {
  conta: Conta;
  cliente: Cliente;
  escuta: Escuta;
}

function obter<T>(valor: T | undefined, oque: string): T {
  if (valor === undefined) throw new Error(`faltou ${oque}`);
  return valor;
}

function entrar(c: Cliente, partidaId: string): Promise<Confirmacao> {
  return c.timeout(PRAZO_MS).emitWithAck("entrarNaPartida", partidaId);
}

function agir(c: Cliente, partidaId: string, acao: Acao): Promise<Confirmacao> {
  return c.timeout(PRAZO_MS).emitWithAck("acao", partidaId, acao);
}

const codigo = (r: Confirmacao): string => (r.ok ? "ok" : r.erro.codigo);

// Estado autoritativo (o da memória do servidor), lido pela fila da partida.
const verPartida = (partidaId: string): Promise<PartidaAtiva> =>
  naFila(partidaId, () => partidaAtiva(partidaId));

function daVez(estado: EstadoPartida, jogadores: readonly Jogador[]): Jogador {
  const id = obter(estado.jogadores[estado.vez], "jogador da vez").id;
  return obter(
    jogadores.find((j) => j.conta.id === id),
    "cliente do jogador da vez",
  );
}

async function seqNoBanco(partidaId: string): Promise<number> {
  const r = await pool.query<{ seq: number }>("SELECT seq FROM partidas WHERE id = $1", [
    partidaId,
  ]);
  return obter(r.rows[0], "partida").seq;
}

// Joga com o robô aleatório do engine, pelo socket de quem tem a vez, até `parar` ou `maximo`.
async function jogar(
  partidaId: string,
  jogadores: readonly Jogador[],
  robo: Rng,
  maximo: number,
  parar: (e: EstadoPartida) => boolean = (e) => e.fase === "FIM",
): Promise<number> {
  let feitas = 0;
  while (feitas < maximo) {
    const { estado } = await verPartida(partidaId);
    if (parar(estado)) break;
    const acao = escolherAcao(estado, robo);
    const resposta = await agir(daVez(estado, jogadores).cliente, partidaId, acao);
    assert.ok(resposta.ok, `${JSON.stringify(acao)}: ${JSON.stringify(resposta)}`);
    feitas++;
  }
  return feitas;
}

describe("servidor de partida (Socket.IO)", { skip: motivoSemBanco, concurrency: false }, () => {
  let app: FastifyInstance;
  let url: string;
  let clientes: Cliente[] = [];

  before(async () => {
    ({ app, url } = await iniciarAppComPorta());
  });
  after(async () => {
    await app.close();
    await pool.end();
  });
  beforeEach(async () => {
    await limparBanco();
  });
  afterEach(() => {
    for (const c of clientes) c.disconnect();
    clientes = [];
    Object.assign(LIMITES_DO_SOCKET, LIMITES_PADRAO);
  });

  function cliente(
    sessao?: string,
    origem?: string | null,
    cabecalhos?: Record<string, string>,
  ): Cliente {
    const c = novoCliente(url, { sessao, origem, cabecalhos });
    clientes.push(c);
    return c;
  }

  async function conectarJogador(conta: Conta, partidaId?: string): Promise<Jogador> {
    const c = cliente(conta.sessao);
    const escuta = new Escuta(c);
    assert.equal(await conectar(c), null);
    if (partidaId !== undefined) assert.deepEqual(await entrar(c, partidaId), { ok: true });
    return { conta, cliente: c, escuta };
  }

  async function partidaEmJogo(n = 3) {
    const contas = await criarContasAtivas(app, n);
    const partidaId = await montarLobby(app, contas);
    await iniciar(app, obter(contas[0], "anfitrião"), partidaId);
    const jogadores: Jogador[] = [];
    for (const conta of contas) jogadores.push(await conectarJogador(conta, partidaId));
    return { contas, partidaId, jogadores };
  }

  test("handshake: exige o cookie de sessão válido e a origem do site", async () => {
    const [conta] = await criarContasAtivas(app, 1);
    const { sessao } = obter(conta, "conta");
    assert.equal(await conectar(cliente()), "NAO_AUTENTICADO");
    assert.equal(await conectar(cliente("A".repeat(43))), "NAO_AUTENTICADO");
    assert.equal(await conectar(cliente(sessao, "https://outro.example")), "ORIGEM_RECUSADA");
    assert.equal(await conectar(cliente(sessao, null)), null);
    // Sem Origin, o Sec-Fetch-Site do navegador decide (como no polling da mesma origem).
    const doOutroSite = { "sec-fetch-site": "cross-site" };
    assert.equal(await conectar(cliente(sessao, null, doOutroSite)), "ORIGEM_RECUSADA");
    const doSite = { "sec-fetch-site": "same-origin" };
    assert.equal(await conectar(cliente(sessao, null, doSite)), null);
    assert.equal(await conectar(cliente(sessao)), null);

    await requisitar(app, { metodo: "POST", url: "/api/auth/logout", sessao, ip: ipNovo() });
    assert.equal(await conectar(cliente(sessao)), "NAO_AUTENTICADO");
  });

  test("entrar: só participantes, cada um com a sua visão", async () => {
    const { partidaId, jogadores } = await partidaEmJogo(3);
    const intruso = await conectarJogador(
      await criarContaAtiva(app, "estranho@teste.local", "Estranho").then((c) => ({
        ...c,
        nome: "Estranho",
      })),
    );
    assert.deepEqual(await entrar(intruso.cliente, partidaId), {
      ok: false,
      erro: { codigo: "PARTIDA_INEXISTENTE", mensagem: "partida inexistente" },
    });
    assert.equal(codigo(await entrar(intruso.cliente, "nao-e-uuid")), "PARTIDA_INEXISTENTE");

    for (const j of jogadores) {
      const { visao, seq } = await j.escuta.esperarEstado(partidaId);
      assert.equal(seq, 0);
      assert.equal(visao.voce, j.conta.id);
      assert.ok(visao.jogadores.find((x) => x.id === j.conta.id)?.cartas !== null);
      conferirSemSegredosAlheios(j.escuta.mensagens, j.conta.id);
    }
    assert.equal(intruso.escuta.mensagens.length, 0);
  });

  test("ações: validação, vez, gravação no log e eventos para todos", async () => {
    const { partidaId, jogadores, contas } = await partidaEmJogo(3);
    const { estado } = await verPartida(partidaId);
    const daVezAgora = daVez(estado, jogadores);
    const outro = obter(
      jogadores.find((j) => j !== daVezAgora),
      "outro jogador",
    );
    const acao = escolherAcao(estado, rngComSemente(7));

    assert.equal(codigo(await agir(outro.cliente, partidaId, acao)), "NAO_E_SUA_VEZ");
    for (const ruim of [
      { tipo: "ocupar", territorio: "atlantida" },
      { ...acao, extra: 1 },
      { tipo: "inexistente" },
      "texto",
    ]) {
      const r = await agir(daVezAgora.cliente, partidaId, semTipo(ruim));
      assert.equal(codigo(r), "ENTRADA_INVALIDA", JSON.stringify(ruim));
    }
    // Conectado, mas sem ter entrado na partida.
    const semEntrar = await conectarJogador(obter(contas[0], "conta"));
    assert.equal(codigo(await agir(semEntrar.cliente, partidaId, acao)), "FORA_DA_PARTIDA");
    assert.equal(await seqNoBanco(partidaId), 0);

    assert.deepEqual(await agir(daVezAgora.cliente, partidaId, acao), { ok: true });
    assert.equal(await seqNoBanco(partidaId), 1);
    const log = await pool.query<{ usuario_id: string; tipo: string }>(
      "SELECT usuario_id, tipo FROM acoes_partida WHERE partida_id = $1 AND seq = 1",
      [partidaId],
    );
    assert.deepEqual(log.rows, [{ usuario_id: daVezAgora.conta.id, tipo: acao.tipo }]);
    for (const j of jogadores) assert.ok((await j.escuta.esperarEventos(partidaId, 1)).length > 0);
    assert.equal(semEntrar.escuta.mensagens.filter((m) => m.nome === "eventos").length, 0);
  });

  test("ações simultâneas são serializadas, sem buraco no log", async () => {
    const { partidaId, jogadores } = await partidaEmJogo(3);
    const { estado } = await verPartida(partidaId);
    const acao = escolherAcao(estado, rngComSemente(3));
    const quem = daVez(estado, jogadores).cliente;
    const respostas = await Promise.all([
      agir(quem, partidaId, acao),
      agir(quem, partidaId, acao),
      agir(quem, partidaId, acao),
    ]);
    assert.equal(respostas.filter((r) => r.ok).length, 1, JSON.stringify(respostas));
    assert.equal(await seqNoBanco(partidaId), 1);
  });

  test("partida jogada com robôs: ninguém recebe segredos alheios e a recarga bate", async () => {
    Object.assign(LIMITES_DO_SOCKET, { capacidade: 1e6, porSegundo: 1e6 });
    const { partidaId, jogadores } = await partidaEmJogo(4);
    const feitas = await jogar(partidaId, jogadores, rngComSemente(42), 400);
    assert.ok(feitas > 50, `só ${feitas} ações`);

    const memoria = await verPartida(partidaId);
    assert.equal(await seqNoBanco(partidaId), memoria.seq);
    for (const j of jogadores) {
      await j.escuta.esperarEventos(partidaId, memoria.seq);
      const seqs = j.escuta.mensagens.flatMap((m) => (m.nome === "eventos" ? [m.seq] : []));
      assert.deepEqual(
        seqs,
        Array.from({ length: memoria.seq }, (_, i) => i + 1),
        "eventos fora de ordem ou faltando",
      );
      conferirSemSegredosAlheios(j.escuta.mensagens, j.conta.id);
      // A visão que chega com o último lote de eventos é a do estado atual.
      const ultima = j.escuta.mensagens.findLast(
        (m) => m.nome === "eventos" && m.seq === memoria.seq,
      );
      assert.ok(ultima?.nome === "eventos");
      assert.deepEqual(ultima.visao, visaoDoJogador(memoria.estado, j.conta.id));
    }

    // Recarga do banco (último snapshot + repetição do log) dá o mesmo estado da memória.
    const snapshots = await pool.query("SELECT seq FROM snapshots WHERE partida_id = $1", [
      partidaId,
    ]);
    assert.ok(snapshots.rows.length > 1, "nenhum snapshot depois do inicial");
    const recarregada = await carregarDoBanco(partidaId);
    assert.equal(recarregada.seq, memoria.seq);
    assert.deepEqual(recarregada.estado, memoria.estado);

    // Log adulterado não é aceito.
    const linhas = await db
      .select()
      .from(acoesPartida)
      .where(eq(acoesPartida.partidaId, partidaId))
      .orderBy(asc(acoesPartida.seq));
    assert.deepEqual(repetirLog(null, -1, linhas, memoria.seq), memoria.estado);
    const comSorteio = obter(
      linhas.find((l) => l.seq > 0 && l.sorteios.length > 0),
      "ação com sorteio",
    );
    const sobrando = linhas.map((l) =>
      l === comSorteio ? { ...l, sorteios: [...l.sorteios, { max: 6, valor: 0 }] } : l,
    );
    assert.throws(() => repetirLog(null, -1, sobrando, memoria.seq), /sem usar/);
    const comBuraco = linhas.filter((l) => l !== comSorteio);
    assert.throws(() => repetirLog(null, -1, comBuraco, memoria.seq), /buraco/);

    // Reconexão: um cliente novo recebe o estado atual, igual ao da memória.
    await naFila(partidaId, async () => descartarPartida(partidaId));
    const primeiro = obter(jogadores[0], "jogador");
    primeiro.cliente.disconnect();
    const reconectado = await conectarJogador(primeiro.conta, partidaId);
    const { visao, seq } = await reconectado.escuta.esperarEstado(partidaId);
    assert.equal(seq, memoria.seq);
    assert.deepEqual(visao.territorios, memoria.estado.territorios);
  });

  test("fim de jogo encerra a partida no banco", async () => {
    Object.assign(LIMITES_DO_SOCKET, { capacidade: 1e6, porSegundo: 1e6 });
    const { partidaId, jogadores } = await partidaEmJogo(3);
    const robo = rngComSemente(9);
    await jogar(partidaId, jogadores, robo, 200, (e) => e.rodada >= 1 && e.fase === "RECEBER");

    // Monta um estado à beira da vitória: o da vez com o objetivo de 24 territórios e quase todos
    // eles (os outros ficam com um cada), gravado como snapshot do seq atual.
    const { estado: atual, seq } = await verPartida(partidaId);
    assert.equal(atual.fase, "RECEBER");
    const estado = structuredClone(atual);
    const vencedor = obter(estado.jogadores[estado.vez], "jogador da vez");
    vencedor.objetivoId = OBJETIVO_SUBSTITUTO_DESTRUIR.id;
    const mantidos = new Set<string>();
    for (const t of IDS_TERRITORIOS) {
      const dono = estado.territorios[t].dono;
      if (dono === null || dono === vencedor.id) continue;
      if (!mantidos.has(dono)) mantidos.add(dono);
      else estado.territorios[t].dono = vencedor.id;
    }
    await pool.query(
      `INSERT INTO snapshots (partida_id, seq, estado) VALUES ($1, $2, $3)
       ON CONFLICT (partida_id, seq) DO UPDATE SET estado = EXCLUDED.estado`,
      [partidaId, seq, JSON.stringify(estado)],
    );
    await naFila(partidaId, async () => descartarPartida(partidaId));

    const acao = escolherAcao(estado, robo);
    const daVezAgora = daVez(estado, jogadores);
    assert.deepEqual(await agir(daVezAgora.cliente, partidaId, acao), { ok: true });
    const eventos = await daVezAgora.escuta.esperarEventos(partidaId, seq + 1);
    assert.ok(eventos.some((e) => e.tipo === "vitoria"));
    const linha = await pool.query<{ status: string; vencedor_id: string | null }>(
      "SELECT status, vencedor_id FROM partidas WHERE id = $1",
      [partidaId],
    );
    assert.deepEqual(linha.rows[0], { status: "encerrada", vencedor_id: vencedor.id });

    assert.equal(codigo(await agir(daVezAgora.cliente, partidaId, acao)), "PARTIDA_ENCERRADA");
    // No fim, o objetivo do vencedor é revelado a todos (e só o dele).
    for (const j of jogadores) {
      const r = await entrar(j.cliente, partidaId);
      assert.deepEqual(r, { ok: true });
      conferirSemSegredosAlheios(j.escuta.mensagens, j.conta.id);
    }
  });

  test("robôs jogam sozinhos até a vez do humano, pelo mesmo log", async () => {
    Object.assign(LIMITES_DO_SOCKET, { capacidade: 1e6, porSegundo: 1e6 });
    const [conta] = await criarContasAtivas(app, 1);
    const humano = obter(conta, "conta");
    const lobby = await criarSala(app, humano);
    assert.equal(
      (await pedir(app, humano, "PUT", `/${lobby.id}/cor`, { cor: "branco" })).statusCode,
      200,
    );
    for (let i = 0; i < 2; i++) {
      assert.equal((await pedir(app, humano, "POST", `/${lobby.id}/robos`)).statusCode, 201);
    }
    const partidaId = lobby.id;
    await iniciar(app, humano, partidaId);
    const jogador = await conectarJogador(humano, partidaId);
    const { robos } = await verPartida(partidaId);
    assert.equal(robos.size, 2);

    // O humano joga com o robô aleatório quando é a vez dele; os robôs jogam sozinhos.
    const aleatorio = rngComSemente(3);
    const prazo = Date.now() + 20_000;
    let vezesDoHumano = 0;
    for (;;) {
      const { estado } = await verPartida(partidaId);
      if (estado.fase === "FIM" || (estado.rodada >= 3 && vezesDoHumano >= 3)) break;
      assert.ok(
        Date.now() < prazo,
        `robôs parados na fase ${estado.fase}, rodada ${estado.rodada}`,
      );
      const daVezId = obter(estado.jogadores[estado.vez], "jogador da vez").id;
      if (daVezId !== humano.id) {
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }
      const resposta = await agir(jogador.cliente, partidaId, escolherAcao(estado, aleatorio));
      assert.ok(resposta.ok, JSON.stringify(resposta));
      if (estado.fase === "RECEBER") vezesDoHumano++;
    }

    const linhas = await db
      .select()
      .from(acoesPartida)
      .where(eq(acoesPartida.partidaId, partidaId))
      .orderBy(asc(acoesPartida.seq));
    const dosRobos = linhas.filter((l) => l.usuarioId !== null && robos.has(l.usuarioId));
    assert.ok(dosRobos.length > 0, "nenhuma ação de robô no log");
    const memoria = await verPartida(partidaId);
    const repetido = repetirLog(null, -1, linhas.slice(0, memoria.seq + 1), memoria.seq);
    assert.deepEqual(repetido, memoria.estado);
    conferirSemSegredosAlheios(jogador.escuta.mensagens, humano.id);
  });

  test("lobby em tempo real: entrada, cor, remoção e início", async () => {
    const [anfitriaoConta, segundaConta, terceiraConta] = await criarContasAtivas(app, 3);
    const anfConta = obter(anfitriaoConta, "anfitrião");
    const seg = obter(segundaConta, "segunda");
    const ter = obter(terceiraConta, "terceira");
    const criada = await criarSala(app, anfConta);
    const partidaId = criada.id;
    const token = tokenDoConvite(criada);

    const anf = await conectarJogador(anfConta, partidaId);
    const inicial = await anf.escuta.esperarLobby(partidaId);
    assert.equal(inicial.participantes.length, 1);
    assert.ok(inicial.convite);

    await pedir(app, seg, "POST", "/entrar", { token });
    await anf.escuta.esperarLobby(partidaId, (l) => l.participantes.length === 2);
    const segundo = await conectarJogador(seg, partidaId);
    const visto = await segundo.escuta.esperarLobby(partidaId);
    assert.equal(visto.convite, null);

    await pedir(app, seg, "PUT", `/${partidaId}/cor`, { cor: "azul" });
    await anf.escuta.esperarLobby(partidaId, (l) =>
      l.participantes.some((p) => p.usuarioId === seg.id && p.cor === "azul"),
    );

    await pedir(app, anfConta, "DELETE", `/${partidaId}/participantes/${seg.id}`);
    await segundo.escuta.esperarRemovido(partidaId);
    await anf.escuta.esperarLobby(partidaId, (l) => l.participantes.length === 1);
    const recusado = await agir(segundo.cliente, partidaId, { tipo: "encerrarJogada" });
    assert.equal(codigo(recusado), "FORA_DA_PARTIDA");
    assert.equal(codigo(await entrar(segundo.cliente, partidaId)), "PARTIDA_INEXISTENTE");

    for (const conta of [seg, ter]) await pedir(app, conta, "POST", "/entrar", { token });
    await pedir(app, anfConta, "PUT", `/${partidaId}/cor`, { cor: "branco" });
    await pedir(app, seg, "PUT", `/${partidaId}/cor`, { cor: "azul" });
    await pedir(app, ter, "PUT", `/${partidaId}/cor`, { cor: "verde" });
    assert.deepEqual(await entrar(segundo.cliente, partidaId), { ok: true });
    const desde = segundo.escuta.mensagens.length;
    await iniciar(app, anfConta, partidaId);
    for (const j of [anf, segundo]) {
      await j.escuta.esperarLobby(partidaId, (l) => l.status === "em_andamento", desde);
      const { seq, visao } = await j.escuta.esperarEstado(partidaId);
      assert.equal(seq, 0);
      assert.equal(visao.voce, j.conta.id);
    }
  });

  test("presença: quem está conectado na partida", async () => {
    const { partidaId, jogadores } = await partidaEmJogo(3);
    const [a, b, c] = jogadores;
    const ja = obter(a, "a");
    await ja.escuta.esperarPresenca(
      partidaId,
      jogadores.map((j) => j.conta.id),
    );
    const desde = ja.escuta.mensagens.length;
    obter(b, "b").cliente.disconnect();
    await ja.escuta.esperarPresenca(partidaId, [ja.conta.id, obter(c, "c").conta.id], desde);
    obter(c, "c").cliente.emit("deixarPartida", partidaId);
    await ja.escuta.esperarPresenca(partidaId, [ja.conta.id], desde);
  });

  test("limites: rajada de mensagens e mensagem grande demais", async () => {
    Object.assign(LIMITES_DO_SOCKET, { capacidade: 5, porSegundo: 1, recusasAteDesconectar: 6 });
    const { partidaId, contas } = await partidaEmJogo(3);
    const j = await conectarJogador(obter(contas[1], "conta"), partidaId);
    const respostas = await Promise.all(
      Array.from({ length: 8 }, () => agir(j.cliente, partidaId, semTipo({ tipo: "x" }))),
    );
    const codigos = respostas.map(codigo);
    assert.ok(codigos.includes("LIMITE_EXCEDIDO"), codigos.join(","));
    // Insistir derruba a conexão.
    for (let i = 0; i < 6; i++) j.cliente.emit("deixarPartida", partidaId);
    await esperarDesconexao(j.cliente);

    Object.assign(LIMITES_DO_SOCKET, LIMITES_PADRAO);
    const grande = await conectarJogador(obter(contas[2], "conta"));
    grande.cliente.emit("deixarPartida", "x".repeat(20 * 1024));
    await esperarDesconexao(grande.cliente);
  });

  test("sessão encerrada desconecta o socket", async () => {
    const [primeira, segunda] = await criarContasAtivas(app, 2);
    const um = await conectarJogador(obter(primeira, "conta"));
    await requisitar(app, {
      metodo: "POST",
      url: "/api/auth/logout",
      sessao: um.conta.sessao,
      ip: ipNovo(),
    });
    await esperarDesconexao(um.cliente);

    // Revogada por fora (outra instância, CLI): cai no próximo pedido.
    const dois = await conectarJogador(obter(segunda, "conta"));
    await pool.query("UPDATE sessoes SET revogada_em = now() WHERE usuario_id = $1", [
      dois.conta.id,
    ]);
    const desconexao = esperarDesconexao(dois.cliente);
    dois.cliente.emit("entrarNaPartida", crypto.randomUUID(), () => undefined);
    await desconexao;
  });
});
