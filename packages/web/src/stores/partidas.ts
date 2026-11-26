// Dados das partidas acompanhadas, alimentados pelas respostas REST e pelos eventos do socket.
// A visão do jogo chega inteira (no `estado` e junto de cada lote de `eventos`); os eventos servem
// para o log e para as animações do tabuleiro.
import type { Evento, VisaoPartida } from "@warii/engine";
import type { Escolha, PartidaLobbyDto } from "@warii/shared";
import { create } from "zustand";
import { type AvioesRecebidos, avioesRecebidos } from "../jogo/avioesRecebidos";
import { type CartasDoFimDaVez, cartasDoFimDaVez } from "../jogo/cartasDoFimDaVez";

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
  // Último lote com dados rolados (ataque terrestre, defesa, antiaérea ou ataque aéreo) ou com o
  // início de um combate, para a janela de combate.
  combate: { seq: number; eventos: Evento[] } | null;
  // Cartas recebidas (ou não) no fim da última jogada encerrada pelo próprio jogador.
  fimDaVez: CartasDoFimDaVez | null;
  // Bombardeiros recebidos pelo próprio jogador no início da vez mais recente dele.
  inicioDaVez: AvioesRecebidos | null;
  // Último lote em que alguém usou cartas (reforço, transporte, descarte ou bombardeiros), para o
  // aviso que toda a mesa vê.
  cartasUsadas: { seq: number; eventos: Evento[] } | null;
}

// Usos de cartas (as cartas usadas são públicas — §9.3).
export const USOU_CARTAS = (e: Evento): boolean =>
  e.tipo === "reforcoComCartas" ||
  e.tipo === "transporteComCartas" ||
  e.tipo === "cartasDescartadas" ||
  (e.tipo === "ataqueAereoIniciado" && e.cartas.length > 0);

// O início de um combate também troca o lote: a janela do combate novo começa sem dados.
const TEM_COMBATE = (e: Evento) =>
  e.tipo === "ataqueTerrestreIniciado" ||
  e.tipo === "ataqueAereoIniciado" ||
  e.tipo === "dadosDeAtaqueRolados" ||
  e.tipo === "ataqueTerrestre" ||
  e.tipo === "antiaereoRolado" ||
  e.tipo === "cicloAereo";

export interface DadosPartida {
  lobby: PartidaLobbyDto | null;
  presenca: string[];
  jogo: JogoRecebido | null;
  // O jogador saiu ou foi removido da sala de espera.
  removido: boolean;
  // A partida foi apagada pelo administrador.
  apagada: boolean;
  // Escolhas em andamento de quem age (valem só se `escolha.seq` for o seq do jogo).
  escolha: Escolha | null;
}

const VAZIO: DadosPartida = {
  lobby: null,
  presenca: [],
  jogo: null,
  removido: false,
  apagada: false,
  escolha: null,
};

interface EstadoPartidas {
  porId: Record<string, DadosPartida>;
  gravarLobby: (lobby: PartidaLobbyDto) => void;
  gravarPresenca: (partidaId: string, conectados: string[]) => void;
  gravarEscolha: (partidaId: string, escolha: Escolha) => void;
  gravarEstado: (partidaId: string, visao: VisaoPartida, seq: number) => void;
  // Devolve false se houve buraco na sequência (quem chamou pede o estado de novo).
  gravarEventos: (
    partidaId: string,
    eventos: Evento[],
    visao: VisaoPartida,
    seq: number,
  ) => boolean;
  marcarRemovido: (partidaId: string) => void;
  marcarApagada: (partidaId: string) => void;
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
    gravarEscolha: (partidaId, escolha) => alterar(partidaId, { escolha }),
    gravarEstado: (partidaId, visao, seq) =>
      alterar(partidaId, {
        jogo: {
          visao,
          seq,
          eventos: [],
          seqEventos: 0,
          ultimos: [],
          combate: null,
          fimDaVez: null,
          inicioDaVez: null,
          cartasUsadas: null,
        },
      }),
    gravarEventos(partidaId, eventos, visao, seq) {
      const jogo = get().porId[partidaId]?.jogo;
      if (!jogo || seq !== jogo.seq + 1) return false;
      const todos = [...jogo.eventos, ...eventos].slice(-MAXIMO_EVENTOS_GUARDADOS);
      const combate = eventos.some(TEM_COMBATE) ? { seq, eventos } : jogo.combate;
      const fimDaVez = cartasDoFimDaVez(jogo.visao, eventos, seq) ?? jogo.fimDaVez;
      const inicioDaVez = avioesRecebidos(visao, eventos, seq) ?? jogo.inicioDaVez;
      const cartasUsadas = eventos.some(USOU_CARTAS) ? { seq, eventos } : jogo.cartasUsadas;
      alterar(partidaId, {
        jogo: {
          visao,
          seq,
          eventos: todos,
          seqEventos: seq,
          ultimos: eventos,
          combate,
          fimDaVez,
          inicioDaVez,
          cartasUsadas,
        },
      });
      return true;
    },
    marcarRemovido: (partidaId) => alterar(partidaId, { removido: true }),
    marcarApagada: (partidaId) => alterar(partidaId, { apagada: true }),
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
