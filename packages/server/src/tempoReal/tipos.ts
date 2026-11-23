// Tipos do Socket.IO do servidor e nomes das salas.
import type { ClientToServerEvents, ServerToClientEvents } from "@warii/shared";
import type { Server, Socket } from "socket.io";

// Preenchido no handshake (handshake.ts): quem é o dono da conexão.
export interface DadosDoSocket {
  usuarioId: string;
  sessaoId: string;
}

type EventosEntreServidores = Record<string, never>;

export type ServidorIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  EventosEntreServidores,
  DadosDoSocket
>;
export type SocketDoJogo = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  EventosEntreServidores,
  DadosDoSocket
>;

// Salas:
// - p:{partida}          todos que acompanham a partida (presença);
// - p:{partida}:u:{user} as conexões de um jogador numa partida (tudo que é privado vai por aqui);
// - s:{sessão} e u:{user} para desconectar no logout e na revogação de sessões.
const PREFIXO_PARTIDA = "p:";
export const salaDaPartida = (partidaId: string): string => `${PREFIXO_PARTIDA}${partidaId}`;
export const salaDoJogador = (partidaId: string, usuarioId: string): string =>
  `${PREFIXO_PARTIDA}${partidaId}:u:${usuarioId}`;
export const salaDaSessao = (sessaoId: string): string => `s:${sessaoId}`;
export const salaDoUsuario = (usuarioId: string): string => `u:${usuarioId}`;

// Partidas acompanhadas, a partir das salas de um socket.
export function partidasDasSalas(salas: Iterable<string>): string[] {
  const ids: string[] = [];
  for (const sala of salas) {
    if (sala.startsWith(PREFIXO_PARTIDA) && !sala.includes(":u:")) {
      ids.push(sala.slice(PREFIXO_PARTIDA.length));
    }
  }
  return ids;
}
