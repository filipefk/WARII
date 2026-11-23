// Apoio aos testes do engine: asserções, montagem de estados à mão e o robô aleatório
// usado na simulação e na preparação automática.

import assert from "node:assert/strict";

import {
  type Acao,
  aplicarAcao,
  CARTAS_DE_TROCA,
  cartaDeTroca,
  type CartaDeTroca,
  type CartaId,
  centrosDe,
  comParametros,
  type CorId,
  type EstadoPartida,
  type Evento,
  exercitosMoviveis,
  type Fase,
  IDS_CORES,
  IDS_TERRITORIOS,
  jogador,
  jogadorDaVez,
  type Parametros,
  type Resultado,
  type Rng,
  rngComSemente,
  rngRoteirizado,
  saoVizinhos,
  territorio,
  type TerritorioId,
  territoriosDaCarta,
  territoriosDe,
  territoriosVagos,
  vizinhos,
} from "../src/index.js";
import { turnoVazio } from "../src/regras/estado.js";
import { porTerritorio } from "../src/regras/util.js";

// ───────────────────────── utilitários ─────────────────────────

export function igual(obtido: unknown, esperado: unknown, oque: string): void {
  assert.deepStrictEqual(obtido, esperado, oque);
}

export function verdade(condicao: boolean, oque: string): void {
  assert.ok(condicao, oque);
}

// Faces do d6 → índices para a RNG roteirizada.
export const d6 = (...faces: number[]): number[] => faces.map((f) => f - 1);

export type Aceita = Extract<Resultado, { ok: true }>;

export function rodar(
  e: EstadoPartida,
  quem: string,
  acao: Acao,
  roteiro: readonly number[] = [],
): Aceita {
  const rng = rngRoteirizado(roteiro);
  const r = aplicarAcao(e, quem, acao, rng);
  if (!r.ok) throw new Error(`${acao.tipo} recusada: ${r.erro.codigo} — ${r.erro.mensagem}`);
  if (rng.restantes() !== 0) throw new Error(`${acao.tipo}: sobraram ${rng.restantes()} sorteios`);
  return r;
}

export function recusa(e: EstadoPartida, quem: string, acao: Acao, codigo: string): void {
  const r = aplicarAcao(e, quem, acao, rngRoteirizado([]));
  if (r.ok) throw new Error(`${acao.tipo} deveria ser recusada (${codigo})`);
  if (r.erro.codigo !== codigo) {
    throw new Error(
      `${acao.tipo}: esperado ${codigo}, obtido ${r.erro.codigo} — ${r.erro.mensagem}`,
    );
  }
}

export const eventos = <T extends Evento["tipo"]>(
  r: Aceita,
  tipo: T,
): Extract<Evento, { tipo: T }>[] =>
  r.eventos.filter((e): e is Extract<Evento, { tipo: T }> => e.tipo === tipo);

export function jog(e: EstadoPartida, id: string): NonNullable<ReturnType<typeof jogador>> {
  const j = jogador(e, id);
  if (j === undefined) throw new Error(`jogador ${id} inexistente`);
  return j;
}

// Primeiros sorteios roteirizados, o resto com semente.
export function rngMisto(roteiro: readonly number[], semente: number): Rng {
  const resto = rngComSemente(semente);
  let i = 0;
  return {
    inteiro(max) {
      if (i < roteiro.length) return roteiro[i++] ?? 0;
      return resto.inteiro(max);
    },
  };
}

// ───────────────────── montagem de estados ─────────────────────

export interface Montagem {
  donos: Partial<Record<TerritorioId, readonly [string, number]>>;
  // Dono dos territórios não listados (1 exército cada).
  resto?: string;
  fase?: Fase;
  vez?: number;
  parametros?: Partial<Parametros>;
  cartas?: Record<string, CartaId[]>;
  descarte?: CartaId[];
  base?: Record<string, number>;
  caixa?: Record<string, number>;
  // Padrão: obj13 (50 exércitos no Oriente Médio), para ninguém vencer por acaso.
  objetivos?: Record<string, string>;
}

export const MESA: readonly (readonly [string, CorId])[] = [
  ["A", "vermelho"],
  ["B", "azul"],
  ["C", "verde"],
];

export function montar(m: Montagem): EstadoPartida {
  const parametros = comParametros(m.parametros);
  const maos = MESA.flatMap(([id]) => m.cartas?.[id] ?? []);
  const descarte = m.descarte ?? [];
  const fora = new Set<string>([...maos, ...descarte]);
  return {
    versao: 1,
    fase: m.fase ?? "ATACAR",
    rodada: 2,
    etapaPrimeiraRodada: null,
    jogadores: MESA.map(([id, cor]) => ({
      id,
      cor,
      objetivoId: m.objetivos?.[id] ?? "obj13",
      objetivoOriginalId: m.objetivos?.[id] ?? "obj13",
      cartas: [...(m.cartas?.[id] ?? [])],
      bombardeirosBase: m.base?.[id] ?? 0,
      bombardeirosCaixa: m.caixa?.[id] ?? parametros.bombardeirosPorJogador - (m.base?.[id] ?? 0),
      eliminado: false,
      eliminadoPor: null,
    })),
    vez: m.vez ?? 0,
    distribuidor: 0,
    primeiroJogador: 0,
    territorios: porTerritorio((t) => {
      const [dono, exercitos] = m.donos[t] ?? [m.resto ?? "C", 1];
      return { dono, exercitos, chegaramNoTurno: 0 };
    }),
    monte: CARTAS_DE_TROCA.map((c) => c.id).filter((id) => !fora.has(id)),
    descarte: [...descarte],
    turno: turnoVazio(),
    preparacao: null,
    vencedor: null,
    parametros,
  };
}

export const deA = (ts: readonly TerritorioId[], exercitos = 1): Montagem["donos"] =>
  Object.fromEntries(ts.map((t) => [t, ["A", exercitos] as const])) as Montagem["donos"];

// ───────────────────── robô aleatório ─────────────────────

export const sortear = <T>(r: Rng, itens: readonly T[]): T => {
  const item = itens[r.inteiro(itens.length)];
  if (item === undefined) throw new Error("sorteio em lista vazia");
  return item;
};
export const chance = (r: Rng, p: number): boolean => r.inteiro(1000) < p * 1000;

export function cartasDeTerritorio(ids: readonly CartaId[]): CartaDeTroca[] {
  return ids.flatMap((id) => {
    const c = cartaDeTroca(id);
    return c !== undefined && c.tipo !== "numerica" ? [c] : [];
  });
}

export function acaoDeReforco(e: EstadoPartida, r: Rng): Acao | null {
  const j = jogadorDaVez(e);
  for (const c of cartasDeTerritorio(j.cartas)) {
    const meus = territoriosDaCarta(c).filter((t) => e.territorios[t].dono === j.id);
    if (meus.length === 0) continue;
    const numericas = j.cartas.filter((id) => cartaDeTroca(id)?.tipo === "numerica");
    return { tipo: "reforcarComCartas", carta: c.id, territorio: sortear(r, meus), numericas };
  }
  return null;
}

export function acaoDeTransporte(e: EstadoPartida, r: Rng): Acao | null {
  const j = jogadorDaVez(e);
  const conta = e.parametros.transporteCartasContaMovimento;
  const cartas = cartasDeTerritorio(j.cartas);
  for (const c1 of cartas) {
    for (const c2 of cartas) {
      if (c1.id === c2.id) continue;
      for (const o of territoriosDaCarta(c1)) {
        if (e.territorios[o].dono !== j.id) continue;
        const maximo = conta ? exercitosMoviveis(e, o) : e.territorios[o].exercitos - 1;
        if (maximo < 1) continue;
        const destinos = territoriosDaCarta(c2).filter(
          (d) => d !== o && e.territorios[d].dono === j.id,
        );
        if (destinos.length === 0) continue;
        return {
          tipo: "transportarComCartas",
          cartas: [c1.id, c2.id],
          origem: o,
          destino: sortear(r, destinos),
          quantidade: 1 + r.inteiro(maximo),
        };
      }
    }
  }
  return null;
}

export function acaoAerea(e: EstadoPartida, r: Rng): Acao | null {
  const j = jogadorDaVez(e);
  const alvos = IDS_TERRITORIOS.filter((t) => {
    const s = e.territorios[t];
    return s.dono !== null && s.dono !== j.id && s.exercitos >= 2;
  });
  if (alvos.length === 0) return null;
  if (j.bombardeirosCaixa >= 1 && chance(r, 0.5)) {
    for (const c of cartasDeTerritorio(j.cartas)) {
      const alvo = territoriosDaCarta(c).find((t) => alvos.includes(t));
      if (alvo === undefined) continue;
      const daBase =
        e.parametros.somarBaseECaixa && j.bombardeirosBase > 0
          ? r.inteiro(j.bombardeirosBase + 1)
          : 0;
      return { tipo: "iniciarAtaqueAereo", alvo, daBase, cartas: { carta: c.id, numericas: [] } };
    }
  }
  if (j.bombardeirosBase === 0) return null;
  return {
    tipo: "iniciarAtaqueAereo",
    alvo: sortear(r, alvos),
    daBase: 1 + r.inteiro(j.bombardeirosBase),
  };
}

export function escolhaCincoJogadores(e: EstadoPartida, r: Rng, preferirB = 0.5): Acao {
  const prep = e.preparacao;
  const extras = prep?.centrosExtras ?? [];
  const bBloqueada =
    e.parametros.cincoJogadoresRestricaoManual && (prep?.escolhasB ?? 0) >= 3 && extras.length > 0;
  if (extras.length > 0 && (bBloqueada || !chance(r, preferirB))) {
    return { tipo: "pegarCentroExtra", carta: sortear(r, extras) };
  }
  const vagos = territoriosVagos(e).filter((t) => !territorio(t).centroEstrategico);
  const a = sortear(r, vagos);
  const b = sortear(
    r,
    vagos.filter((t) => territorio(t).continente !== territorio(a).continente),
  );
  return { tipo: "ocuparDoisVagos", territorios: [a, b] };
}

export function escolherAcao(e: EstadoPartida, r: Rng): Acao {
  const j = jogadorDaVez(e);
  const p = e.parametros;
  if (e.fase === "PREP_ESCOLHA_5J") return escolhaCincoJogadores(e, r);
  if (e.fase === "PREP_OCUPACAO")
    return { tipo: "ocupar", territorio: sortear(r, territoriosVagos(e)) };
  const t = e.turno;
  if (t.conquistaPendente !== null) {
    return { tipo: "moverAposConquista", quantidade: 1 + r.inteiro(t.conquistaPendente.maximo) };
  }
  if (t.ataqueAereo !== null) {
    return chance(r, 0.7) ? { tipo: "continuarAtaqueAereo" } : { tipo: "encerrarAtaqueAereo" };
  }
  if (j.cartas.length > p.limiteMao) return { tipo: "descartar", cartas: [sortear(r, j.cartas)] };
  if (chance(r, 0.1)) {
    const reforco = acaoDeReforco(e, r);
    if (reforco !== null) return reforco;
  }
  const meus = territoriosDe(e, j.id);
  switch (e.fase) {
    case "RECEBER": {
      const rec = t.recebimento;
      if (rec === null) throw new Error("RECEBER sem recebimento");
      for (const [c, v] of Object.entries(rec.porContinente)) {
        if (v === undefined || v <= 0) continue;
        const ali = meus.filter((x) => territorio(x).continente === c);
        return { tipo: "posicionar", territorio: sortear(r, ali), quantidade: 1 + r.inteiro(v) };
      }
      if (rec.livres > 0) {
        return {
          tipo: "posicionar",
          territorio: sortear(r, meus),
          quantidade: 1 + r.inteiro(rec.livres),
        };
      }
      return { tipo: "encerrarRecebimento" };
    }
    case "ATACAR": {
      if (chance(r, 0.08)) {
        const aerea = acaoAerea(e, r);
        if (aerea !== null) return aerea;
      }
      const opcoes = meus.flatMap((o) =>
        e.territorios[o].exercitos >= 2
          ? [...vizinhos(o)]
              .filter((a) => e.territorios[a].dono !== j.id)
              .map((a) => [o, a] as const)
          : [],
      );
      if (opcoes.length > 0 && chance(r, 0.9)) {
        const [o, a] = sortear(r, opcoes);
        return {
          tipo: "atacar",
          origem: o,
          alvo: a,
          dados: Math.min(3, e.territorios[o].exercitos - 1),
        };
      }
      return chance(r, 0.1) ? { tipo: "encerrarJogada" } : { tipo: "encerrarAtaques" };
    }
    case "DESLOCAR": {
      if (chance(r, 0.05)) {
        const transporte = acaoDeTransporte(e, r);
        if (transporte !== null) return transporte;
      }
      if (chance(r, 0.6)) {
        const centros = centrosDe(e, j.id);
        const movimentos = meus.flatMap((o) => {
          if (exercitosMoviveis(e, o) < 1) return [];
          const terrestres = [...vizinhos(o)].filter((d) => e.territorios[d].dono === j.id);
          const aereos = territorio(o).centroEstrategico
            ? centros.filter((d) => d !== o && !saoVizinhos(o, d))
            : [];
          return [...terrestres, ...aereos].map((d) => [o, d] as const);
        });
        if (movimentos.length > 0) {
          const [o, d] = sortear(r, movimentos);
          return {
            tipo: "deslocar",
            origem: o,
            destino: d,
            quantidade: 1 + r.inteiro(exercitosMoviveis(e, o)),
          };
        }
      }
      return { tipo: "encerrarJogada" };
    }
    default:
      throw new Error(`fase sem ação do robô: ${e.fase}`);
  }
}

// Joga a preparação inteira com o robô; devolve o estado e o último a ocupar.
export function prepararAutomatico(
  estado: EstadoPartida,
  rngJogo: Rng,
  rngRobo: Rng,
  escolha5 = (e: EstadoPartida) => escolhaCincoJogadores(e, rngRobo),
): { estado: EstadoPartida; ultimoAOcupar: string } {
  let e = estado;
  let ultimo = "";
  while (e.fase === "PREP_ESCOLHA_5J" || e.fase === "PREP_OCUPACAO") {
    const acao = e.fase === "PREP_ESCOLHA_5J" ? escolha5(e) : escolherAcao(e, rngRobo);
    const id = jogadorDaVez(e).id;
    const r = aplicarAcao(e, id, acao, rngJogo);
    if (!r.ok) throw new Error(`preparação: ${acao.tipo} recusada: ${r.erro.mensagem}`);
    if (acao.tipo === "ocupar") ultimo = id;
    e = r.estado;
  }
  return { estado: e, ultimoAOcupar: ultimo };
}

export const jogadoresDe = (n: number) =>
  IDS_CORES.slice(0, n).map((cor, i) => ({ id: `J${i + 1}`, cor }));
