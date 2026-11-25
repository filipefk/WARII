// Ligação entre os ids dos jogadores na visão (o id do usuário) e o que a tela mostra: nome
// (participantes do lobby) e cor. Também os totais de cada jogador no mapa.
import {
  type CorId,
  IDS_TERRITORIOS,
  type JogadorId,
  type VisaoJogador,
  type VisaoPartida,
} from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";

export interface Mesa {
  nome: (id: JogadorId | null) => string;
  cor: (id: JogadorId | null) => CorId | null;
  // Jogador controlado pelo servidor.
  robo: (id: JogadorId | null) => boolean;
  jogadorDaVez: VisaoJogador | undefined;
}

export function montarMesa(lobby: PartidaLobbyDto, visao: VisaoPartida): Mesa {
  const nomes = new Map(lobby.participantes.map((p) => [p.usuarioId, p.nome]));
  const cores = new Map(visao.jogadores.map((j) => [j.id, j.cor]));
  const robos = new Set(lobby.participantes.filter((p) => p.robo).map((p) => p.usuarioId));
  return {
    nome: (id) => (id === null ? "—" : (nomes.get(id) ?? "?")),
    cor: (id) => (id === null ? null : (cores.get(id) ?? null)),
    robo: (id) => id !== null && robos.has(id),
    jogadorDaVez: visao.jogadores[visao.vez],
  };
}

export interface TotaisDoJogador {
  territorios: number;
  exercitos: number;
}

export function totaisPorJogador(visao: VisaoPartida): Map<JogadorId, TotaisDoJogador> {
  const r = new Map<JogadorId, TotaisDoJogador>();
  for (const t of IDS_TERRITORIOS) {
    const { dono, exercitos } = visao.territorios[t];
    if (dono === null) continue;
    const atual = r.get(dono) ?? { territorios: 0, exercitos: 0 };
    r.set(dono, { territorios: atual.territorios + 1, exercitos: atual.exercitos + exercitos });
  }
  return r;
}
