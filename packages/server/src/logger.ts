// Opções do logger (pino) do Fastify: JSON estruturado em produção, legível em desenvolvimento.
// Campos sensíveis são substituídos antes de qualquer saída.
import type { FastifyServerOptions } from "fastify";
import { config } from "./config.js";

const CAMPOS_SENSIVEIS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
  "*.senha",
  "*.password",
  "*.token",
  "*.segredo",
  "*.cookie",
];

export const opcoesDoLogger: FastifyServerOptions["logger"] = {
  level: config.LOG_LEVEL,
  redact: { paths: CAMPOS_SENSIVEIS, censor: "[oculto]" },
  ...(config.NODE_ENV === "development" && {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
};
