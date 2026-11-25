// Métricas básicas do processo, acumuladas desde que ele subiu (uma instância só): requisições por
// classe de status e faixa de tempo, ações do jogo, erros internos, sockets, partidas na memória,
// memória e atraso do event loop. Saem no log a cada INTERVALO_LOG_METRICAS_MS (index.ts) e em
// GET /api/metricas, que só existe com METRICAS_TOKEN e exige "Authorization: Bearer <token>".
import { createHash, timingSafeEqual } from "node:crypto";
import { monitorEventLoopDelay } from "node:perf_hooks";
import type { FastifyInstance } from "fastify";
import { config } from "./config.js";
import { responderErro } from "./erros.js";
import { quantidadeDeAtivas } from "./tempoReal/partidasAtivas.js";

export const INTERVALO_LOG_METRICAS_MS = 15 * 60 * 1000;

// Limites superiores (ms) das faixas de tempo de resposta; a última faixa é "acima".
const FAIXAS_MS = [50, 200, 1000] as const;

type ClasseStatus = "2xx" | "3xx" | "4xx" | "5xx";

const contadores = {
  requisicoes: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 } satisfies Record<ClasseStatus, number>,
  tempos: { ate50ms: 0, ate200ms: 0, ate1s: 0, acima: 0 },
  acoesAceitas: 0,
  acoesRecusadas: 0,
  errosInternos: 0,
};

export function contarAcao(aceita: boolean): void {
  if (aceita) contadores.acoesAceitas += 1;
  else contadores.acoesRecusadas += 1;
}

export function contarErroInterno(): void {
  contadores.errosInternos += 1;
}

function classeDoStatus(status: number): ClasseStatus {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  return "2xx";
}

function contarTempo(ms: number): void {
  const t = contadores.tempos;
  if (ms <= FAIXAS_MS[0]) t.ate50ms += 1;
  else if (ms <= FAIXAS_MS[1]) t.ate200ms += 1;
  else if (ms <= FAIXAS_MS[2]) t.ate1s += 1;
  else t.acima += 1;
}

// O histograma mede o intervalo entre disparos do timer, que já inclui a resolução: o atraso de
// verdade é o que passa dela.
const RESOLUCAO_LOOP_MS = 20;
const atrasoDoLoop = monitorEventLoopDelay({ resolution: RESOLUCAO_LOOP_MS });

const MB = 1024 * 1024;
const emMs = (nanos: number): number =>
  Math.max(0, Math.round((nanos / 1e6 - RESOLUCAO_LOOP_MS) * 10) / 10);

export interface Metricas {
  segundosNoAr: number;
  requisicoes: Record<ClasseStatus, number>;
  temposDeResposta: typeof contadores.tempos;
  acoesAceitas: number;
  acoesRecusadas: number;
  errosInternos: number;
  socketsConectados: number;
  partidasNaMemoria: number;
  memoriaMb: { rss: number; heapUsado: number };
  eventLoopMs: { media: number; p99: number; max: number };
}

export function lerMetricas(app: FastifyInstance): Metricas {
  const memoria = process.memoryUsage();
  return {
    segundosNoAr: Math.round(process.uptime()),
    requisicoes: { ...contadores.requisicoes },
    temposDeResposta: { ...contadores.tempos },
    acoesAceitas: contadores.acoesAceitas,
    acoesRecusadas: contadores.acoesRecusadas,
    errosInternos: contadores.errosInternos,
    socketsConectados: app.tempoReal.io.engine.clientsCount,
    partidasNaMemoria: quantidadeDeAtivas(),
    memoriaMb: { rss: Math.round(memoria.rss / MB), heapUsado: Math.round(memoria.heapUsed / MB) },
    eventLoopMs: {
      media: Number.isNaN(atrasoDoLoop.mean) ? 0 : emMs(atrasoDoLoop.mean),
      p99: emMs(atrasoDoLoop.percentile(99)),
      max: emMs(atrasoDoLoop.max),
    },
  };
}

const resumo = (texto: string): Buffer => createHash("sha256").update(texto).digest();

// Compara em tempo constante (os resumos têm o mesmo tamanho, seja qual for o recebido).
function tokenConfere(cabecalho: string | undefined, token: string): boolean {
  const recebido = cabecalho?.startsWith("Bearer ") ? cabecalho.slice("Bearer ".length) : "";
  return timingSafeEqual(resumo(recebido), resumo(token));
}

export function registrarMetricas(app: FastifyInstance): void {
  atrasoDoLoop.enable();
  app.addHook("onClose", async () => {
    atrasoDoLoop.disable();
  });

  app.addHook("onResponse", async (_requisicao, resposta) => {
    contadores.requisicoes[classeDoStatus(resposta.statusCode)] += 1;
    contarTempo(resposta.elapsedTime);
    if (resposta.statusCode >= 500) contarErroInterno();
  });

  const token = config.METRICAS_TOKEN;
  if (token === undefined) return;
  app.get(
    "/api/metricas",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (requisicao, resposta) => {
      if (!tokenConfere(requisicao.headers.authorization, token)) {
        return responderErro(resposta, 401, "NAO_AUTORIZADO", "token de métricas inválido");
      }
      resposta.header("cache-control", "no-store");
      return lerMetricas(app);
    },
  );
}
