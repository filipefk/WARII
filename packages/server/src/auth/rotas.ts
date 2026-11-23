// Rotas /api/auth. Não há cadastro público: contas nascem pela CLI (ver contas.ts).
import type { FastifyInstance } from "fastify";
import {
  DefinirSenhaEntrada,
  LoginEntrada,
  TrocarSenhaEntrada,
  type UsuarioDto,
} from "@warii/shared";
import { responderEntradaInvalida, responderErro } from "../erros.js";
import { autenticar, definirSenhaComToken, ErroDeConta, trocarSenha } from "./contas.js";
import {
  apagarCookieSessao,
  exigirSessao,
  gravarCookieSessao,
  NOME_COOKIE_SESSAO,
  origemDaRequisicao,
  sessaoDa,
} from "./plugin.js";
import { criarSessao, revogarSessao, revogarSessoesDoUsuario, sessaoPorToken } from "./sessoes.js";
import {
  atrasoAntesDaTentativa,
  bloqueioRestante,
  esperar,
  registrarFalha,
  registrarSucesso,
} from "./tentativas.js";

// Corpos das rotas de auth são pequenos: recusa cedo qualquer coisa maior.
const LIMITE_CORPO = 4 * 1024;

const LIMITE_LOGIN = { max: 20, timeWindow: "15 minutes" };
const LIMITE_SENHA = { max: 10, timeWindow: "15 minutes" };
const LIMITE_GERAL = { max: 120, timeWindow: "1 minute" };

const CREDENCIAIS_INVALIDAS = "e-mail ou senha incorretos";

function paraDto(usuario: { id: string; email: string; nome: string }): UsuarioDto {
  return { id: usuario.id, email: usuario.email, nome: usuario.nome };
}

export async function rotasDeAutenticacao(app: FastifyInstance): Promise<void> {
  app.post(
    "/login",
    { bodyLimit: LIMITE_CORPO, config: { rateLimit: LIMITE_LOGIN } },
    async (requisicao, resposta) => {
      const entrada = LoginEntrada.safeParse(requisicao.body);
      if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
      const { email, senha } = entrada.data;
      const ip = requisicao.ip;

      const bloqueio = bloqueioRestante(email, ip);
      if (bloqueio > 0) {
        resposta.header("retry-after", String(Math.ceil(bloqueio / 1000)));
        return responderErro(
          resposta,
          429,
          "MUITAS_TENTATIVAS",
          "muitas tentativas de login; aguarde alguns minutos",
        );
      }
      await esperar(atrasoAntesDaTentativa(email, ip));

      const conta = await autenticar(email, senha);
      if (!conta) {
        registrarFalha(email, ip);
        return responderErro(resposta, 401, "CREDENCIAIS_INVALIDAS", CREDENCIAIS_INVALIDAS);
      }
      registrarSucesso(email, ip);

      // Um cookie de sessão anterior neste navegador deixa de valer.
      const anterior = requisicao.cookies[NOME_COOKIE_SESSAO];
      if (anterior) {
        const sessaoAnterior = await sessaoPorToken(anterior);
        if (sessaoAnterior) {
          await revogarSessao(sessaoAnterior.sessaoId);
          app.tempoReal.sessaoEncerrada(sessaoAnterior.sessaoId);
        }
      }

      const { token, expiraEm } = await criarSessao(conta.id, origemDaRequisicao(requisicao));
      gravarCookieSessao(resposta, token, expiraEm);
      return paraDto(conta);
    },
  );

  app.post("/logout", { config: { rateLimit: LIMITE_GERAL } }, async (requisicao, resposta) => {
    const token = requisicao.cookies[NOME_COOKIE_SESSAO];
    if (token) {
      const sessao = await sessaoPorToken(token);
      if (sessao) {
        await revogarSessao(sessao.sessaoId);
        app.tempoReal.sessaoEncerrada(sessao.sessaoId);
      }
    }
    apagarCookieSessao(resposta);
    return resposta.code(204).send();
  });

  app.get(
    "/eu",
    { preHandler: exigirSessao, config: { rateLimit: LIMITE_GERAL } },
    async (requisicao) => paraDto(sessaoDa(requisicao).usuario),
  );

  // Ativação da conta ou redefinição de senha pelo link gerado na CLI. Já entra logado.
  app.post(
    "/senha/definir",
    { bodyLimit: LIMITE_CORPO, config: { rateLimit: LIMITE_SENHA } },
    async (requisicao, resposta) => {
      const entrada = DefinirSenhaEntrada.safeParse(requisicao.body);
      if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
      try {
        const { conta, token, expiraEm } = await definirSenhaComToken(
          entrada.data.token,
          entrada.data.senha,
          origemDaRequisicao(requisicao),
        );
        // As sessões anteriores foram revogadas; a nova ainda não tem socket.
        app.tempoReal.sessoesDoUsuarioEncerradas(conta.id);
        gravarCookieSessao(resposta, token, expiraEm);
        return paraDto(conta);
      } catch (erro) {
        if (erro instanceof ErroDeConta) {
          return responderErro(resposta, 400, erro.codigo, erro.message);
        }
        throw erro;
      }
    },
  );

  // Troca de senha de quem está logado: as outras sessões são revogadas, a atual continua.
  app.put(
    "/senha",
    { bodyLimit: LIMITE_CORPO, preHandler: exigirSessao, config: { rateLimit: LIMITE_SENHA } },
    async (requisicao, resposta) => {
      const entrada = TrocarSenhaEntrada.safeParse(requisicao.body);
      if (!entrada.success) return responderEntradaInvalida(resposta, entrada.error);
      const sessao = sessaoDa(requisicao);
      const trocou = await trocarSenha(
        sessao.usuario.id,
        sessao.sessaoId,
        entrada.data.senhaAtual,
        entrada.data.novaSenha,
      );
      if (!trocou)
        return responderErro(resposta, 400, "SENHA_ATUAL_INCORRETA", "senha atual incorreta");
      app.tempoReal.sessoesDoUsuarioEncerradas(sessao.usuario.id, sessao.sessaoId);
      return resposta.code(204).send();
    },
  );

  // Encerra todas as sessões do usuário, inclusive a atual (ex.: esqueceu logado em outro lugar).
  app.post(
    "/sair-de-todas",
    { preHandler: exigirSessao, config: { rateLimit: LIMITE_GERAL } },
    async (requisicao, resposta) => {
      const usuarioId = sessaoDa(requisicao).usuario.id;
      await revogarSessoesDoUsuario(usuarioId);
      app.tempoReal.sessoesDoUsuarioEncerradas(usuarioId);
      apagarCookieSessao(resposta);
      return resposta.code(204).send();
    },
  );
}
