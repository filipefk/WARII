import Fastify from "fastify";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@warii/shared";

const app = Fastify({ logger: true });

app.get("/api/health", async () => ({ ok: true }));

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  path: "/socket.io",
});

io.on("connection", (socket) => {
  app.log.info({ socketId: socket.id }, "cliente conectado");
  socket.emit("boasVindas", "Conectado ao servidor do War II");
});

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
