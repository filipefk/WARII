// Rotas /api/partidas (lobby). Todas exigem login; as regras ficam em lobby.ts. Depois de cada
// alteração (já gravada), o socket avisa os participantes (app.tempoReal).
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  ConfigurarPartidaEntrada,
  CriarPartidaEntrada,
  EntrarPartidaEntrada,
  EscolherCorEntrada,
  esquemaIdPartida,
} from "@warii/shared";
import { z } from "zod";
import { auditar } from "../auditoria.js";
import { exigirSessao, sessaoDa } from "../auth/plugin.js";
import { responderEntradaInvalida, responderErro } from "../erros.js";
import {
  cancelarPartida,
  configurarParametros,
  criarPartidaNoLobby,
  entrarComConvite,
  ErroDeLobby,
  escolherCor,
  iniciarPartida,
  listarPartidas,
  obterLobby,
  removerDaPartida,
  renovarConvite,
  sairDaPartida,
} from "./lobby.js";

const LIMITE_CORPO = 8 * 1024;
const LIMITE_LEITURA = { max: 240, timeWindow: "1 minute" };
const LIMITE_ESCRITA = { max: 60, timeWindow: "1 minute" };
const LIMITE_ENTRAR = { max: 20, timeWindow: "15 minutes" };

const ParametroPartida = z.object({ id: esquemaIdPartida });
const ParametroParticipante = z.object({
  id: esquemaIdPartida,
  usuarioId: z.uuid({ error: "esse jogador não está na partida" }),
});

// Envia o resultado da operação (204 quando não há corpo) ou converte a recusa do lobby em
// { codigo, mensagem }; outros erros seguem para o tratamento global.
async function responder(
  resposta: FastifyReply,
  operacao: () => Promise<unknown>,
  status = 200,
): Promise<FastifyReply> {
  try {
    const corpo = await operacao();
    return corpo === undefined ? resposta.code(204).send() : resposta.code(status).send(corpo);
  } catch (erro) {
    if (erro instanceof ErroDeLobby) {
      return responderErro(resposta, erro.status, erro.codigo, erro.message);
    }
    throw erro;
  }
}

// Id inválido na URL é tratado como partida inexistente (404), igual a uma de que não participa.
function partidaInexistente(resposta: FastifyReply): FastifyReply {
  return responderErro(resposta, 404, "PARTIDA_INEXISTENTE", "partida inexistente");
}

export async function rotasDePartidas(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirSessao);

  const leitura = { config: { rateLimit: LIMITE_LEITURA } };
  const escrita = { bodyLimit: LIMITE_CORPO, config: { rateLimit: LIMITE_ESCRITA } };

  app.get("/", leitura, async (requisicao, resposta) =>
    responder(resposta, () => listarPartidas(sessaoDa(requisicao).usuario.id)),
  );

  app.post("/", escrita, async (requisicao, resposta) => {
    const entrada = CriarPartidaEntrada.safeParse(requisicao.body);
    if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(
      resposta,
      async () => {
        const lobby = await criarPartidaNoLobby(usuarioId, entrada.data.nome);
        auditar(requisicao.log, "partida_criada", { partidaId: lobby.id, usuarioId });
        return lobby;
      },
      201,
    );
  });

  app.post(
    "/entrar",
    { bodyLimit: LIMITE_CORPO, config: { rateLimit: LIMITE_ENTRAR } },
    async (requisicao, resposta) => {
      const entrada = EntrarPartidaEntrada.safeParse(requisicao.body);
      if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
      const usuarioId = sessaoDa(requisicao).usuario.id;
      return responder(resposta, async () => {
        const lobby = await entrarComConvite(usuarioId, entrada.data.token);
        auditar(requisicao.log, "partida_entrou", { partidaId: lobby.id, usuarioId });
        app.tempoReal.lobbyAlterado(lobby.id);
        return lobby;
      });
    },
  );

  app.get("/:id", leitura, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return partidaInexistente(resposta);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, () => obterLobby(params.data.id, usuarioId));
  });

  app.put("/:id/cor", escrita, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return partidaInexistente(resposta);
    const entrada = EscolherCorEntrada.safeParse(requisicao.body);
    if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      const lobby = await escolherCor(params.data.id, usuarioId, entrada.data.cor);
      app.tempoReal.lobbyAlterado(lobby.id);
      return lobby;
    });
  });

  app.put("/:id/parametros", escrita, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return partidaInexistente(resposta);
    const entrada = ConfigurarPartidaEntrada.safeParse(requisicao.body);
    if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      const lobby = await configurarParametros(params.data.id, usuarioId, entrada.data.parametros);
      app.tempoReal.lobbyAlterado(lobby.id);
      return lobby;
    });
  });

  app.post("/:id/convite", escrita, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return partidaInexistente(resposta);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      const lobby = await renovarConvite(params.data.id, usuarioId);
      auditar(requisicao.log, "convite_renovado", { partidaId: lobby.id, usuarioId });
      app.tempoReal.lobbyAlterado(lobby.id);
      return lobby;
    });
  });

  app.post("/:id/sair", escrita, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return partidaInexistente(resposta);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      await sairDaPartida(params.data.id, usuarioId);
      auditar(requisicao.log, "partida_saiu", { partidaId: params.data.id, usuarioId });
      app.tempoReal.saiuDoLobby(params.data.id, usuarioId);
    });
  });

  app.delete("/:id/participantes/:usuarioId", escrita, async (requisicao, resposta) => {
    const params = ParametroParticipante.safeParse(requisicao.params);
    if (!params.success) return partidaInexistente(resposta);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      const lobby = await removerDaPartida(params.data.id, usuarioId, params.data.usuarioId);
      auditar(requisicao.log, "participante_removido", {
        partidaId: lobby.id,
        usuarioId,
        removidoId: params.data.usuarioId,
      });
      app.tempoReal.saiuDoLobby(lobby.id, params.data.usuarioId);
      return lobby;
    });
  });

  app.post("/:id/cancelar", escrita, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return partidaInexistente(resposta);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      await cancelarPartida(params.data.id, usuarioId);
      auditar(requisicao.log, "partida_cancelada", { partidaId: params.data.id, usuarioId });
      app.tempoReal.lobbyAlterado(params.data.id);
    });
  });

  app.post("/:id/iniciar", escrita, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return partidaInexistente(resposta);
    const usuarioId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      const lobby = await iniciarPartida(params.data.id, usuarioId);
      auditar(requisicao.log, "partida_iniciada", {
        partidaId: lobby.id,
        usuarioId,
        jogadores: lobby.participantes.length,
      });
      app.tempoReal.partidaIniciada(lobby.id);
      return lobby;
    });
  });
}
