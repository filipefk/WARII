// Montagem da aplicação HTTP (rotas, plugins e o Socket.IO), sem abrir porta nem preparar o banco.
// O index.ts usa para subir o servidor; os testes usam com `app.inject`.
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { rotasDeAdmin } from "./admin/rotas.js";
import { registrarAutenticacao } from "./auth/plugin.js";
import { rotasDeAutenticacao } from "./auth/rotas.js";
import { config } from "./config.js";
import { bancoResponde } from "./db/index.js";
import { registrarTratamentoDeErros } from "./erros.js";
import { registrarMetricas } from "./metricas.js";
import { rotasDePartidas } from "./partidas/rotas.js";
import { LIMITE_CORPO_GLOBAL, registrarSeguranca } from "./seguranca.js";
import { registrarTempoReal } from "./tempoReal/servidor.js";

// Prazo para o cliente terminar de enviar a requisição (cabeçalhos e corpo): corta conexões
// que mandam devagar de propósito. Não limita a resposta (o polling do Socket.IO segue igual).
const PRAZO_REQUISICAO_MS = 30_000;

// O Fastify aceita o número de proxies em tempo de execução, mas os tipos dele não: vira a função
// equivalente do proxy-addr (o salto 0 é o endereço da conexão; confia nos `n` primeiros).
function confiancaNoProxy(valor: boolean | number | string): FastifyServerOptions["trustProxy"] {
  if (typeof valor !== "number") return valor;
  return (_endereco: string, salto: number) => salto < valor;
}

export async function criarApp(
  logger: FastifyServerOptions["logger"] = false,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger,
    trustProxy: confiancaNoProxy(config.TRUST_PROXY),
    bodyLimit: LIMITE_CORPO_GLOBAL,
    requestTimeout: PRAZO_REQUISICAO_MS,
  });

  registrarTratamentoDeErros(app);
  await registrarSeguranca(app);
  await registrarAutenticacao(app);
  // Antes das rotas: elas avisam o socket por app.tempoReal.
  registrarTempoReal(app);
  registrarMetricas(app);
  await app.register(rotasDeAutenticacao, { prefix: "/api/auth" });
  await app.register(rotasDePartidas, { prefix: "/api/partidas" });
  await app.register(rotasDeAdmin, { prefix: "/api/admin" });

  app.get("/api/health", async (_requisicao, resposta) => {
    resposta.header("cache-control", "no-store");
    if (await bancoResponde()) return { ok: true, banco: "ok" };
    return resposta.code(503).send({ ok: false, banco: "indisponivel" });
  });

  return app;
}
