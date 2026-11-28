// Rotas /api/admin: cadastro de usuários e administração das partidas. Exigem login e `admin`
// (403 SOMENTE_ADMIN). As regras ficam em usuarios.ts e partidas.ts; o socket é avisado do que
// mudou por app.tempoReal.
import {
  CriarUsuarioEntrada,
  DefinirAvatarEntrada,
  DefinirSenhaDoUsuarioEntrada,
  EditarUsuarioEntrada,
  esquemaIdPartida,
  esquemaIdUsuario,
  type LinkSenhaDto,
} from "@warii/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { auditar } from "../auditoria.js";
import { ErroDeConta, gerarLinkSenhaPorId } from "../auth/contas.js";
import { exigirAdmin, exigirSessao, sessaoDa } from "../auth/plugin.js";
import { responderEntradaInvalida, responderErro } from "../erros.js";
import { listarLogDoUsuario } from "../logUsuarios.js";
import {
  decodificarAvatar,
  ErroDeAvatar,
  gravarAvatar,
  LIMITE_CORPO_AVATAR,
  removerAvatar,
} from "../usuarios/avatar.js";
import { apagarPartida, encerrarPartida, listarTodasAsPartidas } from "./partidas.js";
import {
  apagarUsuario,
  criarUsuario,
  definirSenhaDoUsuario,
  editarUsuario,
  ErroDeAdmin,
  listarUsuarios,
  obterUsuario,
} from "./usuarios.js";

const LIMITE_CORPO = 4 * 1024;
const LIMITE_LEITURA = { max: 240, timeWindow: "1 minute" };
const LIMITE_ESCRITA = { max: 60, timeWindow: "1 minute" };

const ParametroUsuario = z.object({ id: esquemaIdUsuario });
const ParametroPartida = z.object({ id: esquemaIdPartida });

async function responder(
  resposta: FastifyReply,
  operacao: () => Promise<unknown>,
  status = 200,
): Promise<FastifyReply> {
  try {
    const corpo = await operacao();
    return corpo === undefined ? resposta.code(204).send() : resposta.code(status).send(corpo);
  } catch (erro) {
    if (erro instanceof ErroDeAvatar)
      return responderErro(resposta, 400, erro.codigo, erro.message);
    if (erro instanceof ErroDeAdmin) {
      return responderErro(resposta, erro.status, erro.codigo, erro.message);
    }
    // Do link de senha: conta inexistente ou robô.
    if (erro instanceof ErroDeConta) {
      return responderErro(resposta, 404, "USUARIO_INEXISTENTE", "usuário inexistente");
    }
    throw erro;
  }
}

const inexistente = (resposta: FastifyReply, oque: "USUARIO" | "PARTIDA") =>
  responderErro(
    resposta,
    404,
    `${oque}_INEXISTENTE`,
    oque === "USUARIO" ? "usuário inexistente" : "partida inexistente",
  );

export async function rotasDeAdmin(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirSessao);
  app.addHook("preHandler", exigirAdmin);

  const leitura = { config: { rateLimit: LIMITE_LEITURA } };
  const escrita = { bodyLimit: LIMITE_CORPO, config: { rateLimit: LIMITE_ESCRITA } };

  // ---- Usuários ----

  app.get("/usuarios", leitura, async (_requisicao, resposta) =>
    responder(resposta, () => listarUsuarios()),
  );

  app.post("/usuarios", escrita, async (requisicao, resposta) => {
    const entrada = CriarUsuarioEntrada.safeParse(requisicao.body);
    if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
    const adminId = sessaoDa(requisicao).usuario.id;
    return responder(
      resposta,
      async () => {
        const { email, nome, admin } = entrada.data;
        const conta = await criarUsuario(email, nome, admin);
        auditar(requisicao.log, "usuario_criado", { adminId, usuarioId: conta.id, admin });
        return obterUsuario(conta.id);
      },
      201,
    );
  });

  app.put("/usuarios/:id", escrita, async (requisicao, resposta) => {
    const params = ParametroUsuario.safeParse(requisicao.params);
    if (!params.success) return inexistente(resposta, "USUARIO");
    const entrada = EditarUsuarioEntrada.safeParse(requisicao.body);
    if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
    const adminId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      await editarUsuario(params.data.id, adminId, entrada.data);
      auditar(requisicao.log, "usuario_editado", {
        adminId,
        usuarioId: params.data.id,
        campos: Object.keys(entrada.data),
      });
      return obterUsuario(params.data.id);
    });
  });

  app.delete("/usuarios/:id", escrita, async (requisicao, resposta) => {
    const params = ParametroUsuario.safeParse(requisicao.params);
    if (!params.success) return inexistente(resposta, "USUARIO");
    const adminId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      await apagarUsuario(params.data.id, adminId);
      auditar(requisicao.log, "usuario_apagado", { adminId, usuarioId: params.data.id });
      app.tempoReal.sessoesDoUsuarioEncerradas(params.data.id);
    });
  });

  // Log do jogador: entradas, partidas criadas e partidas jogadas.
  // Foto do avatar de qualquer usuário (não de robôs). Responde o usuário atualizado.
  app.put(
    "/usuarios/:id/avatar",
    { bodyLimit: LIMITE_CORPO_AVATAR, config: { rateLimit: LIMITE_ESCRITA } },
    async (requisicao, resposta) => {
      const params = ParametroUsuario.safeParse(requisicao.params);
      if (!params.success) return inexistente(resposta, "USUARIO");
      const entrada = DefinirAvatarEntrada.safeParse(requisicao.body);
      if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
      const adminId = sessaoDa(requisicao).usuario.id;
      return responder(resposta, async () => {
        await obterUsuario(params.data.id);
        const { tipo, imagem } = decodificarAvatar(entrada.data.imagem);
        await gravarAvatar(params.data.id, tipo, imagem);
        auditar(requisicao.log, "avatar_definido", { adminId, usuarioId: params.data.id });
        return obterUsuario(params.data.id);
      });
    },
  );

  app.delete("/usuarios/:id/avatar", escrita, async (requisicao, resposta) => {
    const params = ParametroUsuario.safeParse(requisicao.params);
    if (!params.success) return inexistente(resposta, "USUARIO");
    const adminId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      await obterUsuario(params.data.id);
      await removerAvatar(params.data.id);
      auditar(requisicao.log, "avatar_removido", { adminId, usuarioId: params.data.id });
      return obterUsuario(params.data.id);
    });
  });

  app.get("/usuarios/:id/log", leitura, async (requisicao, resposta) => {
    const params = ParametroUsuario.safeParse(requisicao.params);
    if (!params.success) return inexistente(resposta, "USUARIO");
    return responder(resposta, async () => {
      await obterUsuario(params.data.id);
      return listarLogDoUsuario(params.data.id);
    });
  });

  // Link de uso único para o próprio usuário definir a senha (invalida os anteriores).
  app.post("/usuarios/:id/link-senha", escrita, async (requisicao, resposta) => {
    const params = ParametroUsuario.safeParse(requisicao.params);
    if (!params.success) return inexistente(resposta, "USUARIO");
    const adminId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      const { link, finalidade, expiraEm } = await gerarLinkSenhaPorId(params.data.id);
      auditar(requisicao.log, "link_senha_gerado", {
        adminId,
        usuarioId: params.data.id,
        finalidade,
      });
      const dto: LinkSenhaDto = { link, finalidade, expiraEm: expiraEm.toISOString() };
      return dto;
    });
  });

  app.put("/usuarios/:id/senha", escrita, async (requisicao, resposta) => {
    const params = ParametroUsuario.safeParse(requisicao.params);
    if (!params.success) return inexistente(resposta, "USUARIO");
    const entrada = DefinirSenhaDoUsuarioEntrada.safeParse(requisicao.body);
    if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
    const sessao = sessaoDa(requisicao);
    const alvoId = params.data.id;
    // Trocando a própria senha por aqui, a sessão atual continua.
    const manter = alvoId === sessao.usuario.id ? sessao.sessaoId : undefined;
    return responder(resposta, async () => {
      await definirSenhaDoUsuario(alvoId, entrada.data.senha, manter);
      auditar(requisicao.log, "senha_definida_pelo_admin", {
        adminId: sessao.usuario.id,
        usuarioId: alvoId,
      });
      app.tempoReal.sessoesDoUsuarioEncerradas(alvoId, manter);
      return obterUsuario(alvoId);
    });
  });

  // ---- Partidas ----

  app.get("/partidas", leitura, async (_requisicao, resposta) =>
    responder(resposta, () => listarTodasAsPartidas()),
  );

  app.post("/partidas/:id/encerrar", escrita, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return inexistente(resposta, "PARTIDA");
    const adminId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      const status = await encerrarPartida(params.data.id);
      auditar(requisicao.log, "partida_encerrada_pelo_admin", {
        adminId,
        partidaId: params.data.id,
        status,
      });
      app.tempoReal.partidaEncerrada(params.data.id);
    });
  });

  app.delete("/partidas/:id", escrita, async (requisicao, resposta) => {
    const params = ParametroPartida.safeParse(requisicao.params);
    if (!params.success) return inexistente(resposta, "PARTIDA");
    const adminId = sessaoDa(requisicao).usuario.id;
    return responder(resposta, async () => {
      const { status } = await apagarPartida(params.data.id);
      auditar(requisicao.log, "partida_apagada", { adminId, partidaId: params.data.id, status });
      app.tempoReal.partidaApagada(params.data.id);
    });
  });
}
