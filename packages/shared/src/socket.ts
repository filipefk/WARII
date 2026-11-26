// Eventos do Socket.IO entre servidor e front. O cliente envia só intenções (`acao`, validada com
// esquemaAcao); o servidor responde com a visão filtrada do jogador. Todo evento do servidor leva
// o id da partida, pois um mesmo socket pode acompanhar várias (uma sala de espera e um jogo).
import type { Acao, Evento, VisaoPartida } from "@warii/engine";
import type { ErroApi } from "./auth.js";
import type { PartidaLobbyDto } from "./partidas.js";

// Maior mensagem aceita pelo servidor (bytes); acima disso a conexão é derrubada.
export const TAMANHO_MAXIMO_MENSAGEM = 16 * 1024;

// Resposta (ack) de um pedido do cliente: ok, ou o erro com código estável.
export type Confirmacao = { ok: true } | { ok: false; erro: ErroApi };

export interface ServerToClientEvents {
  // Estado completo da partida na visão de quem recebe (ao entrar, reconectar ou ressincronizar).
  estado: (partidaId: string, visao: VisaoPartida, seq: number) => void;
  // Eventos de uma ação aplicada (já filtrados para quem recebe), a visão resultante e o seq. A
  // visão é a fonte do tabuleiro; os eventos servem para animar e para o log. Se o seq não for o
  // anterior + 1, o cliente perdeu algo e deve pedir `entrarNaPartida` de novo.
  eventos: (partidaId: string, eventos: Evento[], visao: VisaoPartida, seq: number) => void;
  // Sala de espera alterada (alguém entrou, saiu, trocou de cor; parâmetros; início; cancelamento).
  lobby: (partidaId: string, lobby: PartidaLobbyDto) => void;
  // O jogador saiu ou foi removido da sala de espera: deixa de receber os eventos dela.
  removido: (partidaId: string) => void;
  // A partida foi apagada pelo administrador: deixa de existir para todos.
  apagada: (partidaId: string) => void;
  // Ids dos usuários com ao menos uma conexão acompanhando a partida.
  presenca: (partidaId: string, conectados: string[]) => void;
  erro: (erro: ErroApi) => void;
}

export interface ClientToServerEvents {
  // Passa a acompanhar a partida: recebe `lobby` (aguardando) ou `estado` (em andamento/encerrada).
  entrarNaPartida: (partidaId: string, confirmar: (resposta: Confirmacao) => void) => void;
  // Para de acompanhar a partida (não sai dela).
  deixarPartida: (partidaId: string) => void;
  // O servidor valida o formato com esquemaAcao e a regra com o engine.
  acao: (partidaId: string, acao: Acao, confirmar: (resposta: Confirmacao) => void) => void;
}
