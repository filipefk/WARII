// Avatar (enviar, ler, remover; pelo próprio usuário e pelo administrador) e convite direto a
// usuários online na sala de espera (lista de online e entrega pelo socket).
import { motivoSemBanco } from "./ambiente.js";

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import type {
  ConviteDto,
  ErroApi,
  PartidaLobbyDto,
  UsuarioAdminDto,
  UsuarioDto,
  UsuarioResumoDto,
} from "@warii/shared";
import type { FastifyInstance } from "fastify";

import { pool } from "../src/db/index.js";
import { criarContasAtivas, encerrarAppDeTeste, ipNovo, limparBanco, requisitar } from "./apoio.js";
import {
  type Cliente,
  type Conta,
  conectar,
  criarSala,
  iniciarAppComPorta,
  novoCliente,
  PRAZO_MS,
} from "./apoioSocket.js";

// PNG de 1×1 pixel.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const dataUrl = (bytes: Buffer, tipo = "image/png") =>
  `data:${tipo};base64,${bytes.toString("base64")}`;

type Metodo = "GET" | "POST" | "PUT" | "DELETE";

describe("avatar e convite direto", { skip: motivoSemBanco, concurrency: false }, () => {
  let app: FastifyInstance;
  let url: string;
  let contas: Conta[];
  const clientes: Cliente[] = [];

  before(async () => {
    ({ app, url } = await iniciarAppComPorta());
  });
  after(async () => {
    await encerrarAppDeTeste(app);
  });
  beforeEach(async () => {
    for (const c of clientes.splice(0)) c.disconnect();
    await limparBanco();
    contas = await criarContasAtivas(app, 3);
  });

  function pedir(conta: Conta, metodo: Metodo, caminho: string, corpo?: Record<string, unknown>) {
    return requisitar(app, { metodo, url: caminho, corpo, sessao: conta.sessao, ip: ipNovo() });
  }

  async function online(conta: Conta): Promise<Cliente> {
    const cliente = novoCliente(url, { sessao: conta.sessao });
    clientes.push(cliente);
    assert.equal(await conectar(cliente), null);
    return cliente;
  }

  const conta = (i: number): Conta => {
    const c = contas[i];
    if (!c) throw new Error("sem conta");
    return c;
  };

  test("o usuário envia, vê e remove o próprio avatar", async () => {
    const eu = conta(0);
    const enviado = await pedir(eu, "PUT", "/api/auth/avatar", { imagem: dataUrl(PNG) });
    assert.equal(enviado.statusCode, 200, enviado.body);
    assert.deepEqual(enviado.json(), { avatar: 1 });

    const perfil = (await pedir(eu, "GET", "/api/auth/eu")).json<UsuarioDto>();
    assert.equal(perfil.avatar, 1);

    // Outro usuário logado lê a foto; a URL leva a versão e fica em cache.
    const foto = await pedir(conta(1), "GET", `/api/usuarios/${eu.id}/avatar?v=1`);
    assert.equal(foto.statusCode, 200);
    assert.equal(foto.headers["content-type"], "image/png");
    assert.match(String(foto.headers["cache-control"]), /immutable/);
    assert.deepEqual(foto.rawPayload, PNG);

    // Sem login, não.
    const anonimo = await requisitar(app, { url: `/api/usuarios/${eu.id}/avatar`, ip: ipNovo() });
    assert.equal(anonimo.statusCode, 401);

    const segundo = await pedir(eu, "PUT", "/api/auth/avatar", { imagem: dataUrl(PNG) });
    assert.deepEqual(segundo.json(), { avatar: 2 });

    const removido = await pedir(eu, "DELETE", "/api/auth/avatar");
    assert.deepEqual(removido.json(), { avatar: null });
    assert.equal((await pedir(eu, "GET", `/api/usuarios/${eu.id}/avatar?v=2`)).statusCode, 404);
  });

  test("recusa o que não é imagem e o que passa do tamanho", async () => {
    const eu = conta(0);
    const texto = await pedir(eu, "PUT", "/api/auth/avatar", {
      imagem: dataUrl(Buffer.from("isto não é uma imagem"), "image/png"),
    });
    assert.equal(texto.statusCode, 400);
    assert.equal(texto.json<ErroApi>().codigo, "IMAGEM_INVALIDA");

    const formato = await pedir(eu, "PUT", "/api/auth/avatar", { imagem: "http://x/y.png" });
    assert.equal(formato.statusCode, 400);
    assert.equal(formato.json<ErroApi>().codigo, "ENTRADA_INVALIDA");

    const grande = Buffer.concat([PNG, Buffer.alloc(50 * 1024)]);
    const r = await pedir(eu, "PUT", "/api/auth/avatar", { imagem: dataUrl(grande) });
    assert.equal(r.statusCode, 400);
  });

  test("o administrador define e remove o avatar de outro usuário", async () => {
    const admin = conta(0);
    const alvo = conta(1);
    assert.equal(
      (await pedir(alvo, "PUT", `/api/admin/usuarios/${admin.id}/avatar`, { imagem: dataUrl(PNG) }))
        .statusCode,
      403,
    );
    await pool.query("UPDATE usuarios SET admin = true WHERE id = $1", [admin.id]);
    const definido = await pedir(admin, "PUT", `/api/admin/usuarios/${alvo.id}/avatar`, {
      imagem: dataUrl(PNG),
    });
    assert.equal(definido.statusCode, 200, definido.body);
    assert.equal(definido.json<UsuarioAdminDto>().avatar, 1);

    const lobby = (await criarSala(app, alvo)) satisfies PartidaLobbyDto;
    assert.equal(lobby.anfitriao.avatar, 1);
    assert.equal(lobby.participantes[0]?.avatar, 1);

    const removido = await pedir(admin, "DELETE", `/api/admin/usuarios/${alvo.id}/avatar`);
    assert.equal(removido.json<UsuarioAdminDto>().avatar, null);
  });

  test("o anfitrião vê quem está online e o convidado recebe o convite", async () => {
    const [anfitriao, convidado, longe] = [conta(0), conta(1), conta(2)];
    const lobby = await criarSala(app, anfitriao);
    await online(anfitriao);
    const socketDoConvidado = await online(convidado);

    const lista = await pedir(anfitriao, "GET", `/api/partidas/${lobby.id}/online`);
    assert.equal(lista.statusCode, 200, lista.body);
    // O próprio anfitrião (já na partida) e quem está desconectado ficam de fora.
    assert.deepEqual(
      lista.json<UsuarioResumoDto[]>().map((u) => u.id),
      [convidado.id],
    );

    // Só o anfitrião convida.
    const naoAnfitriao = await pedir(convidado, "GET", `/api/partidas/${lobby.id}/online`);
    assert.equal(naoAnfitriao.statusCode, 404);

    const recebido = new Promise<ConviteDto>((resolver, rejeitar) => {
      const prazo = setTimeout(() => rejeitar(new Error("convite não chegou")), PRAZO_MS);
      socketDoConvidado.once("convite", (convite) => {
        clearTimeout(prazo);
        resolver(convite);
      });
    });
    const enviado = await pedir(anfitriao, "POST", `/api/partidas/${lobby.id}/convidar`, {
      usuarioId: convidado.id,
    });
    assert.equal(enviado.statusCode, 204, enviado.body);
    const convite = await recebido;
    assert.equal(convite.partidaId, lobby.id);
    assert.equal(convite.anfitriao.id, anfitriao.id);

    // Aceitar é entrar com o token do convite.
    const entrou = await pedir(convidado, "POST", "/api/partidas/entrar", { token: convite.token });
    assert.equal(entrou.statusCode, 200, entrou.body);
    const depois = await pedir(anfitriao, "GET", `/api/partidas/${lobby.id}/online`);
    assert.deepEqual(depois.json<UsuarioResumoDto[]>(), []);

    // Quem não está online não recebe convite.
    const offline = await pedir(anfitriao, "POST", `/api/partidas/${lobby.id}/convidar`, {
      usuarioId: longe.id,
    });
    assert.equal(offline.statusCode, 409);
    assert.equal(offline.json<ErroApi>().codigo, "USUARIO_OFFLINE");

    // Nem quem já está na partida.
    const repetido = await pedir(anfitriao, "POST", `/api/partidas/${lobby.id}/convidar`, {
      usuarioId: convidado.id,
    });
    assert.equal(repetido.json<ErroApi>().codigo, "JA_NA_PARTIDA");
  });
});
