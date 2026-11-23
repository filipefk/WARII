// Formato único das respostas de erro da API: { codigo, mensagem } (ErroApi, em @warii/shared).
import type { FastifyInstance, FastifyReply } from "fastify";
import type { ErroApi } from "@warii/shared";
import type { ZodError } from "zod";

export function responderErro(
  resposta: FastifyReply,
  status: number,
  codigo: string,
  mensagem: string,
): FastifyReply {
  const corpo: ErroApi = { codigo, mensagem };
  return resposta.code(status).send(corpo);
}

// Mensagem do primeiro problema de uma validação zod ("campo: motivo").
export function mensagemDaEntradaInvalida(erro: ZodError): string {
  const primeiro = erro.issues[0];
  const campo = primeiro?.path.join(".");
  const mensagem = primeiro ? (campo ? `${campo}: ${primeiro.message}` : primeiro.message) : "";
  return mensagem || "dados inválidos";
}

export function responderEntradaInvalida(resposta: FastifyReply, erro: ZodError): FastifyReply {
  return responderErro(resposta, 400, "ENTRADA_INVALIDA", mensagemDaEntradaInvalida(erro));
}

function statusDoErro(erro: unknown): number | undefined {
  if (typeof erro === "object" && erro !== null && "statusCode" in erro) {
    const { statusCode } = erro;
    if (typeof statusCode === "number") return statusCode;
  }
  return undefined;
}

function codigoDoErro(erro: unknown): string | undefined {
  if (typeof erro === "object" && erro !== null && "code" in erro) {
    const { code } = erro;
    if (typeof code === "string") return code;
  }
  return undefined;
}

export function registrarTratamentoDeErros(app: FastifyInstance): void {
  app.setErrorHandler((erro, requisicao, resposta) => {
    const status = statusDoErro(erro) ?? 500;
    if (status === 429) {
      return responderErro(
        resposta,
        429,
        "LIMITE_EXCEDIDO",
        "muitas requisições; aguarde um pouco e tente de novo",
      );
    }
    if (status >= 400 && status < 500) {
      // Erros do próprio Fastify (JSON malformado, corpo grande demais etc.): seguros de mostrar.
      const mensagem = erro instanceof Error ? erro.message : "requisição inválida";
      return responderErro(resposta, status, codigoDoErro(erro) ?? "REQUISICAO_INVALIDA", mensagem);
    }
    requisicao.log.error({ err: erro }, "erro não tratado na requisição");
    return responderErro(resposta, 500, "ERRO_INTERNO", "erro interno do servidor");
  });

  app.setNotFoundHandler((_requisicao, resposta) =>
    responderErro(resposta, 404, "NAO_ENCONTRADO", "rota não encontrada"),
  );
}
