// Eventos do Socket.IO entre servidor e front (implementados na etapa 7). O cliente envia só
// intenções (`acao`, validada com esquemaAcao); o servidor responde com a visão filtrada do jogador.
import type { Evento, VisaoPartida } from "@warii/engine";
import type { AcaoEntrada } from "./acoes.js";
import type { ErroApi } from "./auth.js";

// Resposta (ack) de um pedido do cliente: ok, ou o erro com código estável.
export type Confirmacao = { ok: true } | { ok: false; erro: ErroApi };

export interface ServerToClientEvents {
  // Estado completo da partida na visão de quem recebe (ao entrar, reconectar ou ressincronizar).
  estado: (visao: VisaoPartida, seq: number) => void;
  // Eventos de uma ação aplicada (já filtrados para quem recebe) e o seq resultante.
  eventos: (eventos: Evento[], seq: number) => void;
  erro: (erro: ErroApi) => void;
}

export interface ClientToServerEvents {
  entrarNaPartida: (partidaId: string, confirmar: (resposta: Confirmacao) => void) => void;
  acao: (partidaId: string, acao: AcaoEntrada, confirmar: (resposta: Confirmacao) => void) => void;
}
