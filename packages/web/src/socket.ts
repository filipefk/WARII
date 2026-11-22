import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@warii/shared";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  path: "/socket.io",
  autoConnect: false,
});
