import Fastify from "fastify";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@warii/shared";
import { config } from "./config.js";
import { opcoesDoLogger } from "./logger.js";

const app = Fastify({ logger: opcoesDoLogger });

app.get("/api/health", async () => ({ ok: true }));

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  path: "/socket.io",
});

io.on("connection", (socket) => {
  app.log.info({ socketId: socket.id }, "cliente conectado");
  socket.emit("boasVindas", "Conectado ao servidor do War II");
});

await app.listen({ port: config.PORT, host: config.HOST });
