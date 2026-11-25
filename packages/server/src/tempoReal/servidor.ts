// Servidor de partida em tempo real (Socket.IO sobre o mesmo servidor HTTP do Fastify).
// Pedidos do cliente: entrarNaPartida, deixarPartida e acao. As rotas REST avisam por
// `app.tempoReal` o que mudou no lobby e quais sessões foram encerradas.
import { visaoDoJogador } from "@warii/engine";
import {
  type Confirmacao,
  esquemaAcao,
  esquemaIdPartida,
  TAMANHO_MAXIMO_MENSAGEM,
} from "@warii/shared";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { auditar } from "../auditoria.js";
import { sessaoAtiva } from "../auth/sessoes.js";
import { mensagemDaEntradaInvalida } from "../erros.js";
import { contarErroInterno } from "../metricas.js";
import { ErroDeLobby, obterLobby } from "../partidas/lobby.js";
import { processarAcao } from "./acoes.js";
import { agendarRobo, iniciarRobos, pararRobos } from "./robos.js";
import { emitirEstado, emitirLobby, emitirPresenca } from "./emissao.js";
import { ErroDeTempoReal, partidaInexistente } from "./erros.js";
import { autenticarSocket } from "./handshake.js";
import { LimiteDeMensagens } from "./limite.js";
import {
  agendarDespejo,
  cancelarDespejo,
  esquecerTodas,
  naFila,
  partidaAtiva,
} from "./partidasAtivas.js";
import {
  partidasDasSalas,
  salaDaPartida,
  salaDaSessao,
  salaDoJogador,
  salaDoUsuario,
  type ServidorIo,
  type SocketDoJogo,
} from "./tipos.js";

// Avisos das rotas REST. Não esperam o envio: falhas vão só para o log.
export interface TempoReal {
  readonly io: ServidorIo;
  lobbyAlterado(partidaId: string): void;
  // Saiu por conta própria ou foi removido pelo anfitrião.
  saiuDoLobby(partidaId: string, usuarioId: string): void;
  partidaIniciada(partidaId: string): void;
  sessaoEncerrada(sessaoId: string): void;
  sessoesDoUsuarioEncerradas(usuarioId: string, exceto?: string): void;
}

declare module "fastify" {
  interface FastifyInstance {
    tempoReal: TempoReal;
  }
}

function falha(codigo: string, mensagem: string): Confirmacao {
  return { ok: false, erro: { codigo, mensagem } };
}

function converterErro(log: FastifyBaseLogger, erro: unknown): Confirmacao {
  if (erro instanceof ErroDeTempoReal) {
    if (erro.grave) {
      contarErroInterno();
      if (erro.codigo === "PARTIDA_CORROMPIDA") auditar(log, "partida_corrompida");
      log.error({ err: erro.cause ?? erro }, erro.message);
    }
    return falha(erro.codigo, erro.message);
  }
  if (erro instanceof ErroDeLobby) return falha(erro.codigo, erro.message);
  contarErroInterno();
  log.error({ err: erro }, "erro não tratado no socket");
  return falha("ERRO_INTERNO", "erro interno do servidor");
}

// O ack vem do cliente: pode faltar ou não ser função.
function ehAck(valor: unknown): valor is (resposta: Confirmacao) => void {
  return typeof valor === "function";
}

function responderPedido(
  log: FastifyBaseLogger,
  confirmar: unknown,
  pedido: () => Promise<Confirmacao>,
): void {
  const responder = (resposta: Confirmacao): void => {
    if (ehAck(confirmar)) confirmar(resposta);
  };
  void pedido().then(responder, (erro: unknown) => responder(converterErro(log, erro)));
}

// A conexão pode durar mais que a sessão: confere de novo a cada pedido.
async function exigirSessaoAtiva(socket: SocketDoJogo): Promise<void> {
  if (await sessaoAtiva(socket.data.sessaoId)) return;
  socket.disconnect(true);
  throw new ErroDeTempoReal("NAO_AUTENTICADO", "faça login para continuar");
}

function idDaPartida(bruto: unknown): string {
  const id = esquemaIdPartida.safeParse(bruto);
  if (!id.success) throw partidaInexistente();
  return id.data;
}

export function registrarTempoReal(app: FastifyInstance): void {
  const log = app.log;
  const io: ServidorIo = new Server(app.server, {
    path: "/socket.io",
    serveClient: false,
    maxHttpBufferSize: TAMANHO_MAXIMO_MENSAGEM,
  });
  iniciarRobos(io, log);

  const estaVazia = (partidaId: string) =>
    (io.sockets.adapter.rooms.get(salaDaPartida(partidaId))?.size ?? 0) === 0;

  const emSegundoPlano = (oque: string, tarefa: () => Promise<void>): void => {
    tarefa().catch((erro: unknown) => log.error({ err: erro }, `falha ao avisar ${oque}`));
  };

  async function entrar(socket: SocketDoJogo, bruto: unknown): Promise<Confirmacao> {
    const partidaId = idDaPartida(bruto);
    await exigirSessaoAtiva(socket);
    const { usuarioId } = socket.data;
    return naFila(partidaId, async () => {
      const lobby = await obterLobby(partidaId, usuarioId);
      if (lobby.status === "cancelada") throw partidaInexistente();
      const partida = lobby.status === "aguardando" ? null : await partidaAtiva(partidaId);
      await socket.join([salaDaPartida(partidaId), salaDoJogador(partidaId, usuarioId)]);
      cancelarDespejo(partidaId);
      if (partida === null) socket.emit("lobby", partidaId, lobby);
      else {
        socket.emit("estado", partidaId, visaoDoJogador(partida.estado, usuarioId), partida.seq);
      }
      await emitirPresenca(io, partidaId);
      // Retoma a vez de um robô parada (ex.: o servidor reiniciou no meio dela).
      if (partida !== null) agendarRobo(partidaId);
      return { ok: true };
    });
  }

  async function agir(
    socket: SocketDoJogo,
    brutoId: unknown,
    brutoAcao: unknown,
  ): Promise<Confirmacao> {
    const partidaId = idDaPartida(brutoId);
    const acao = esquemaAcao.safeParse(brutoAcao);
    if (!acao.success) {
      throw new ErroDeTempoReal("ENTRADA_INVALIDA", mensagemDaEntradaInvalida(acao.error));
    }
    const { usuarioId } = socket.data;
    if (!socket.rooms.has(salaDoJogador(partidaId, usuarioId))) {
      throw new ErroDeTempoReal("FORA_DA_PARTIDA", "entre na partida antes de jogar");
    }
    await exigirSessaoAtiva(socket);
    return processarAcao(io, log, partidaId, usuarioId, acao.data);
  }

  function aoDeixar(partidaId: string): void {
    emSegundoPlano("a presença", () => naFila(partidaId, () => emitirPresenca(io, partidaId)));
    agendarDespejo(partidaId, () => estaVazia(partidaId));
  }

  io.use((socket, next) => {
    void autenticarSocket(socket, log).then((erro) => next(erro));
  });

  io.on("connection", (socket) => {
    const { usuarioId, sessaoId } = socket.data;
    void socket.join([salaDaSessao(sessaoId), salaDoUsuario(usuarioId)]);

    const limite = new LimiteDeMensagens();
    socket.use((pacote, next) => {
      const veredito = limite.avaliar();
      if (veredito === "ok") return next();
      const confirmar: unknown = pacote.at(-1);
      if (ehAck(confirmar))
        confirmar(falha("LIMITE_EXCEDIDO", "muitas mensagens; aguarde um pouco"));
      if (veredito === "desconectar") {
        auditar(log, "socket_excesso_de_mensagens", { usuarioId });
        socket.disconnect(true);
      }
    });

    socket.on("entrarNaPartida", (partidaId: unknown, confirmar: unknown) => {
      responderPedido(log, confirmar, () => entrar(socket, partidaId));
    });

    socket.on("acao", (partidaId: unknown, acao: unknown, confirmar: unknown) => {
      responderPedido(log, confirmar, () => agir(socket, partidaId, acao));
    });

    socket.on("deixarPartida", (bruto: unknown) => {
      const id = esquemaIdPartida.safeParse(bruto);
      if (!id.success) return;
      emSegundoPlano("a saída da sala", async () => {
        await socket.leave(salaDaPartida(id.data));
        await socket.leave(salaDoJogador(id.data, usuarioId));
        aoDeixar(id.data);
      });
    });

    let acompanhadas: string[] = [];
    socket.on("disconnecting", () => {
      acompanhadas = partidasDasSalas(socket.rooms);
    });
    socket.on("disconnect", () => {
      for (const partidaId of acompanhadas) aoDeixar(partidaId);
    });
  });

  const tempoReal: TempoReal = {
    io,
    lobbyAlterado(partidaId) {
      emSegundoPlano("o lobby", () => naFila(partidaId, () => emitirLobby(io, partidaId)));
    },
    saiuDoLobby(partidaId, alvoId) {
      emSegundoPlano("a saída do lobby", () =>
        naFila(partidaId, async () => {
          const sala = salaDoJogador(partidaId, alvoId);
          io.to(sala).emit("removido", partidaId);
          io.in(sala).socketsLeave([salaDaPartida(partidaId), sala]);
          await emitirLobby(io, partidaId);
          await emitirPresenca(io, partidaId);
        }),
      );
    },
    partidaIniciada(partidaId) {
      emSegundoPlano("o início da partida", () =>
        naFila(partidaId, async () => {
          await emitirLobby(io, partidaId);
          emitirEstado(io, partidaId, await partidaAtiva(partidaId));
          agendarRobo(partidaId);
        }),
      );
    },
    sessaoEncerrada(sessaoId) {
      io.in(salaDaSessao(sessaoId)).disconnectSockets(true);
    },
    sessoesDoUsuarioEncerradas(usuarioId, exceto) {
      emSegundoPlano("o encerramento das sessões", async () => {
        const sockets = await io.in(salaDoUsuario(usuarioId)).fetchSockets();
        for (const s of sockets) if (s.data.sessaoId !== exceto) s.disconnect(true);
      });
    },
  };
  app.decorate("tempoReal", tempoReal);

  // Sockets saem primeiro (senão o fechamento do HTTP esperaria as conexões abertas).
  app.addHook("preClose", async () => {
    pararRobos();
    await io.close();
    esquecerTodas();
  });
}
