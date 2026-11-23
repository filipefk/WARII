import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@warii/shared";
import { config } from "./config.js";
import { bancoResponde, pool } from "./db/index.js";
import { prepararBanco } from "./db/preparar.js";
import { opcoesDoLogger } from "./logger.js";

// Pasta gerada pelo `drizzle-kit generate`. Resolvida a partir deste arquivo de propósito:
// em dev ele é src/index.ts e em produção o tsup gera um único dist/index.js — ambos um nível
// abaixo da raiz do pacote, então "../drizzle" aponta para packages/server/drizzle nos dois casos.
const pastaDeMigrations = fileURLToPath(new URL("../drizzle", import.meta.url));

// Tempo máximo para fechar tudo ao receber SIGTERM/SIGINT antes de forçar a saída.
const PRAZO_ENCERRAMENTO_MS = 10_000;

const app = Fastify({ logger: opcoesDoLogger });

// Conexões ociosas que caem (ex.: Postgres reiniciou) não podem derrubar o processo.
pool.on("error", (erro) => {
  app.log.error({ err: erro }, "erro em conexão ociosa do pool do banco");
});

app.get("/api/health", async (_requisicao, resposta) => {
  if (await bancoResponde()) return { ok: true, banco: "ok" };
  return resposta.code(503).send({ ok: false, banco: "indisponivel" });
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  path: "/socket.io",
});

io.on("connection", (socket) => {
  app.log.info({ socketId: socket.id }, "cliente conectado");
  socket.emit("boasVindas", "Conectado ao servidor do War II");
});

// Sockets saem primeiro (senão o fechamento do HTTP esperaria as conexões abertas);
// o pool fecha por último, depois que nenhuma requisição pode mais usá-lo.
app.addHook("preClose", async () => {
  await io.close();
});
app.addHook("onClose", async () => {
  await pool.end();
});

let encerrando = false;
async function encerrar(sinal: NodeJS.Signals): Promise<void> {
  if (encerrando) return;
  encerrando = true;
  app.log.info({ sinal }, "encerrando o servidor");
  setTimeout(() => {
    app.log.error("encerramento demorou demais; saindo à força");
    process.exit(1);
  }, PRAZO_ENCERRAMENTO_MS).unref();
  try {
    await app.close();
  } catch (erro) {
    app.log.error({ err: erro }, "erro ao encerrar o servidor");
    process.exitCode = 1;
  }
}

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.once(sinal, () => void encerrar(sinal));
}

try {
  await prepararBanco(app.log, pastaDeMigrations);
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (erro) {
  app.log.fatal({ err: erro }, "falha ao iniciar o servidor");
  process.exitCode = 1;
  // Fecha o pool e o socket para o processo terminar sozinho (e o log ser escrito).
  await app.close().catch(() => undefined);
}
