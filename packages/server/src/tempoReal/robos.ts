// Faz os robôs jogarem: quando a vez é de um jogador controlado pelo servidor, espera um pouco
// (para quem acompanha ver o combate), pede a ação ao robô do engine (`decidirAcao`, que só vê a
// visão dele) e a aplica pelo mesmo caminho das ações humanas (`aplicarEGravar`, na fila da
// partida). Repete até a vez ser de um humano ou a partida acabar.
import { decidirAcao, jogadorDaVez, visaoDoJogador } from "@warii/engine";
import type { FastifyBaseLogger } from "fastify";
import { auditar } from "../auditoria.js";
import { config } from "../config.js";
import { contarErroInterno } from "../metricas.js";
import { rngCrypto } from "../partidas/rng.js";
import { aplicarEGravar } from "./acoes.js";
import { naFila, partidaAtiva } from "./partidasAtivas.js";
import type { ServidorIo } from "./tipos.js";

// Ações no máximo numa mesma vez de um robô; passou disso, ele é dado como travado.
export const LIMITE_ACOES_POR_VEZ = 400;

interface Piloto {
  readonly io: ServidorIo;
  readonly log: FastifyBaseLogger;
}

let piloto: Piloto | null = null;
const agendados = new Map<string, NodeJS.Timeout>();
// Contagem de ações da vez atual de cada partida ("rodada:vez" → quantidade).
const contagens = new Map<string, { vez: string; acoes: number }>();
const travadas = new Set<string>();

export function iniciarRobos(io: ServidorIo, log: FastifyBaseLogger): void {
  piloto = { io, log };
}

export function pararRobos(): void {
  piloto = null;
  for (const t of agendados.values()) clearTimeout(t);
  agendados.clear();
  contagens.clear();
  travadas.clear();
}

// Agenda a próxima jogada se a vez for de um robô. Pode ser chamada à vontade: há no máximo um
// agendamento por partida, e a conferência da vez é feita na hora de jogar.
export function agendarRobo(partidaId: string): void {
  if (piloto === null || agendados.has(partidaId) || travadas.has(partidaId)) return;
  const temporizador = setTimeout(() => {
    agendados.delete(partidaId);
    void jogar(partidaId);
  }, config.ROBO_ATRASO_MS);
  temporizador.unref();
  agendados.set(partidaId, temporizador);
}

function travar(partidaId: string, motivo: string, dados: Record<string, unknown> = {}): void {
  travadas.add(partidaId);
  if (piloto === null) return;
  contarErroInterno();
  auditar(piloto.log, "robo_travado", { partidaId, motivo, ...dados });
}

async function jogar(partidaId: string): Promise<void> {
  const atual = piloto;
  if (atual === null) return;
  const { io, log } = atual;
  try {
    const continuar = await naFila(partidaId, async () => {
      const partida = await partidaAtiva(partidaId);
      const estado = partida.estado;
      if (estado.fase === "FIM") return false;
      const roboId = jogadorDaVez(estado).id;
      if (!partida.robos.has(roboId)) return false;

      const vez = `${estado.rodada}:${estado.vez}`;
      const contagem = contagens.get(partidaId);
      const acoes = contagem?.vez === vez ? contagem.acoes + 1 : 1;
      contagens.set(partidaId, { vez, acoes });
      if (acoes > LIMITE_ACOES_POR_VEZ) {
        travar(partidaId, "limite de ações na vez", { roboId, acoes });
        return false;
      }

      const acao = decidirAcao(visaoDoJogador(estado, roboId), rngCrypto());
      const confirmacao = await aplicarEGravar(io, log, partidaId, roboId, acao);
      if (confirmacao.ok) return true;
      // O estado mudou por fora: foi recarregado, então tenta de novo.
      if (confirmacao.erro.codigo === "ESTADO_DESATUALIZADO") return true;
      travar(partidaId, "ação recusada", {
        roboId,
        acao: acao.tipo,
        erro: confirmacao.erro.codigo,
      });
      return false;
    });
    if (continuar) agendarRobo(partidaId);
    else contagens.delete(partidaId);
  } catch (erro) {
    log.error({ err: erro, partidaId }, "falha na jogada do robô");
    travar(partidaId, "erro na jogada");
  }
}
