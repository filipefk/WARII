// Contrato de comunicação entre servidor e front (eventos do Socket.IO e DTOs da API REST).

// Primeiro: configura o zod antes de os schemas serem criados (ver zod.ts).
// oxlint-disable-next-line import/no-unassigned-import
import "./zod.js";

export * from "./acoes.js";
export * from "./admin.js";
export * from "./avatar.js";
export * from "./auth.js";
export * from "./escolha.js";
export * from "./parametros.js";
export * from "./partidas.js";
export * from "./socket.js";
