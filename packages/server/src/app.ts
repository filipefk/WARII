// Montagem da aplicação HTTP (rotas, plugins e o Socket.IO), sem abrir porta nem preparar o banco.
// O index.ts usa para subir o servidor; os testes usam com `app.inject`.
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { registrarAutenticacao } from "./auth/plugin.js";
import { rotasDeAutenticacao } from "./auth/rotas.js";
import { config } from "./config.js";
import { bancoResponde } from "./db/index.js";
import { registrarTratamentoDeErros } from "./erros.js";
import { rotasDePartidas } from "./partidas/rotas.js";
import { registrarTempoReal } from "./tempoReal/servidor.js";

export async function criarApp(
  logger: FastifyServerOptions["logger"] = false,
): Promise<FastifyInstance> {
  const app = Fastify({ logger, trustProxy: config.TRUST_PROXY });

  registrarTratamentoDeErros(app);
  await registrarAutenticacao(app);
  // Antes das rotas: elas avisam o socket por app.tempoReal.
  registrarTempoReal(app);
  await app.register(rotasDeAutenticacao, { prefix: "/api/auth" });
  await app.register(rotasDePartidas, { prefix: "/api/partidas" });

  app.get("/api/health", async (_requisicao, resposta) => {
    if (await bancoResponde()) return { ok: true, banco: "ok" };
    return resposta.code(503).send({ ok: false, banco: "indisponivel" });
  });

  return app;
}
