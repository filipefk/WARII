// Dados das partidas acompanhadas, alimentados pelas respostas REST e pelos eventos do socket.
// A visão do jogo chega inteira (no `estado` e junto de cada lote de `eventos`); os eventos servem
// para o log e para as animações do tabuleiro.
import type { Evento, VisaoPartida } from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";
import { create } from "zustand";

const MAXIMO_EVENTOS_GUARDADOS = 100;

export interface JogoRecebido {
  visao: VisaoPartida;
  seq: number;
  // Últimos eventos recebidos desde o último `estado` (log da partida).
  eventos: Evento[];
  // Seq do lote mais recente de eventos (0 = nenhum desde o último `estado`). As animações
  // comparam com o último lote que já mostraram.
  seqEventos: number;
  // Eventos do lote mais recente.
  ultimos: Evento[];
}

export interface DadosPartida {
  lobby: PartidaLobbyDto | null;
  presenca: string[];
  jogo: JogoRecebido | null;
  // O jogador saiu ou foi removido da sala de espera.
  removido: boolean;
}

const VAZIO: DadosPartida = { lobby: null, presenca: [], jogo: null, removido: false };

interface EstadoPartidas {
  porId: Record<string, DadosPartida>;
  gravarLobby: (lobby: PartidaLobbyDto) => void;
  gravarPresenca: (partidaId: string, conectados: string[]) => void;
  gravarEstado: (partidaId: string, visao: VisaoPartida, seq: number) => void;
  // Devolve false se houve buraco na sequência (quem chamou pede o estado de novo).
  gravarEventos: (
    partidaId: string,
    eventos: Evento[],
    visao: VisaoPartida,
    seq: number,
  ) => boolean;
  marcarRemovido: (partidaId: string) => void;
  esquecer: (partidaId: string) => void;
  limpar: () => void;
}

export const usePartidas = create<EstadoPartidas>()((set, get) => {
  const alterar = (partidaId: string, mudanca: Partial<DadosPartida>) =>
    set((s) => ({
      porId: { ...s.porId, [partidaId]: { ...(s.porId[partidaId] ?? VAZIO), ...mudanca } },
    }));

  return {
    porId: {},
    gravarLobby: (lobby) => alterar(lobby.id, { lobby }),
    gravarPresenca: (partidaId, presenca) => alterar(partidaId, { presenca }),
    gravarEstado: (partidaId, visao, seq) =>
      alterar(partidaId, { jogo: { visao, seq, eventos: [], seqEventos: 0, ultimos: [] } }),
    gravarEventos(partidaId, eventos, visao, seq) {
      const jogo = get().porId[partidaId]?.jogo;
      if (!jogo || seq !== jogo.seq + 1) return false;
      const todos = [...jogo.eventos, ...eventos].slice(-MAXIMO_EVENTOS_GUARDADOS);
      alterar(partidaId, {
        jogo: { visao, seq, eventos: todos, seqEventos: seq, ultimos: eventos },
      });
      return true;
    },
    marcarRemovido: (partidaId) => alterar(partidaId, { removido: true }),
    esquecer: (partidaId) =>
      set((s) => {
        const resto = { ...s.porId };
        delete resto[partidaId];
        return { porId: resto };
      }),
    limpar: () => set({ porId: {} }),
  };
});

export function useDadosPartida(partidaId: string): DadosPartida {
  return usePartidas((s) => s.porId[partidaId] ?? VAZIO);
}
