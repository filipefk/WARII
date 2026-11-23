// Criação da partida (WARII.md §4.1–4.3): sorteio do distribuidor, distribuição das cartas de CE
// e, com 5 jogadores, a fase de escolha. As cores já vêm escolhidas do lobby, na ordem da mesa.

import { CARTAS_DE_TROCA, type CartaId } from "../data/cartas.js";
import { IDS_CORES, type CorId } from "../data/cores.js";
import { FACES_D6 } from "../data/dados.js";
import type { TerritorioId } from "../data/territorios.js";
import { type Contexto, emitir } from "./contexto.js";
import { type EstadoPartida, type EstadoTerritorio, type JogadorId, turnoVazio } from "./estado.js";
import { type Parametros, validarParametros } from "./parametros.js";
import { iniciarOcupacao } from "./preparacao.js";
import { exigir, RecusaRegra, type Resultado } from "./resultado.js";
import { embaralhar, rolar, type Rng } from "./rng.js";
import { copiaJson, porTerritorio } from "./util.js";

export interface JogadorInicial {
  readonly id: JogadorId;
  readonly cor: CorId;
}

export const MINIMO_JOGADORES = 3;
export const MAXIMO_JOGADORES = 6;

export function criarPartida(
  jogadores: readonly JogadorInicial[],
  parametros: Parametros,
  rng: Rng,
): Resultado {
  try {
    validarEntrada(jogadores, parametros);
    const ctx: Contexto = { estado: estadoInicial(jogadores, parametros), eventos: [], rng };
    sortearDistribuidor(ctx);
    distribuirCentros(ctx);
    return { ok: true, estado: ctx.estado, eventos: ctx.eventos };
  } catch (e) {
    if (e instanceof RecusaRegra)
      return { ok: false, erro: { codigo: e.codigo, mensagem: e.message } };
    throw e;
  }
}

function validarEntrada(jogadores: readonly JogadorInicial[], parametros: Parametros): void {
  exigir(
    jogadores.length >= MINIMO_JOGADORES && jogadores.length <= MAXIMO_JOGADORES,
    "JOGADORES_INVALIDOS",
    `A partida precisa de ${MINIMO_JOGADORES} a ${MAXIMO_JOGADORES} jogadores`,
  );
  const ids = jogadores.map((j) => j.id);
  exigir(
    ids.every((id) => typeof id === "string" && id.length > 0) && new Set(ids).size === ids.length,
    "JOGADORES_INVALIDOS",
    "Ids de jogador vazios ou repetidos",
  );
  const cores = jogadores.map((j) => j.cor);
  exigir(
    cores.every((c) => (IDS_CORES as readonly string[]).includes(c)) &&
      new Set(cores).size === cores.length,
    "JOGADORES_INVALIDOS",
    "Cores inválidas ou repetidas",
  );
  const erros = validarParametros(parametros);
  exigir(erros.length === 0, "PARAMETROS_INVALIDOS", `Parâmetros inválidos: ${erros.join("; ")}`);
}

function estadoInicial(
  jogadores: readonly JogadorInicial[],
  parametros: Parametros,
): EstadoPartida {
  const territorios = porTerritorio<EstadoTerritorio>(() => ({
    dono: null,
    exercitos: 0,
    chegaramNoTurno: 0,
  }));
  return {
    versao: 1,
    fase: "PREP_OCUPACAO",
    rodada: 0,
    etapaPrimeiraRodada: null,
    jogadores: jogadores.map((j) => ({
      id: j.id,
      cor: j.cor,
      objetivoId: null,
      objetivoOriginalId: null,
      cartas: [],
      bombardeirosBase: 0,
      bombardeirosCaixa: parametros.bombardeirosPorJogador,
      eliminado: false,
      eliminadoPor: null,
    })),
    vez: 0,
    distribuidor: 0,
    primeiroJogador: -1,
    territorios,
    monte: [],
    descarte: [],
    turno: turnoVazio(),
    preparacao: null,
    vencedor: null,
    // Cópia, para o estado não compartilhar arrays com quem chamou.
    parametros: copiaJson(parametros),
  };
}

// Cada um rola um dado; empatados no maior valor rolam de novo (§4.1).
function sortearDistribuidor(ctx: Contexto): void {
  const estado = ctx.estado;
  let candidatos = estado.jogadores.map((_, i) => i);
  const rolagens: { jogador: JogadorId; valor: number }[][] = [];
  while (candidatos.length > 1) {
    const rodada = candidatos.map((i) => ({ i, valor: rolar(ctx.rng, FACES_D6) }));
    rolagens.push(
      rodada.map((r) => ({ jogador: estado.jogadores[r.i]?.id ?? "", valor: r.valor })),
    );
    const maior = Math.max(...rodada.map((r) => r.valor));
    candidatos = rodada.filter((r) => r.valor === maior).map((r) => r.i);
  }
  estado.distribuidor = candidatos[0] ?? 0;
  estado.vez = estado.distribuidor;
  emitir(ctx, {
    tipo: "distribuidorSorteado",
    rolagens,
    distribuidor: estado.jogadores[estado.distribuidor]?.id ?? "",
  });
}

// As cartas de CE são distribuídas uma a uma a partir do distribuidor, 2 exércitos em cada CE
// (§4.2). Com 5 jogadores só 10 são distribuídas e as 2 restantes vão para a escolha (§4.3).
function distribuirCentros(ctx: Contexto): void {
  const estado = ctx.estado;
  const n = estado.jogadores.length;
  const cartasCe = embaralhar(
    ctx.rng,
    CARTAS_DE_TROCA.filter((c) => c.tipo === "territorio" && c.centro !== undefined),
  );
  const aDistribuir = n === 5 ? 10 : cartasCe.length;
  const recebidas = new Map<number, { cartas: CartaId[]; territorios: TerritorioId[] }>();
  cartasCe.slice(0, aDistribuir).forEach((carta, k) => {
    const i = (estado.distribuidor + k) % n;
    const ce = carta.tipo === "territorio" ? carta.centro : undefined;
    const j = estado.jogadores[i];
    if (ce === undefined || j === undefined) throw new Error("Carta de CE sem centro");
    estado.territorios[ce] = { dono: j.id, exercitos: 2, chegaramNoTurno: 0 };
    const r = recebidas.get(i) ?? { cartas: [], territorios: [] };
    r.cartas.push(carta.id);
    r.territorios.push(ce);
    recebidas.set(i, r);
  });
  for (let k = 0; k < n; k++) {
    const i = (estado.distribuidor + k) % n;
    const r = recebidas.get(i);
    const j = estado.jogadores[i];
    if (r !== undefined && j !== undefined) {
      emitir(ctx, { tipo: "centrosDistribuidos", jogador: j.id, ...r });
    }
  }
  if (n === 5) {
    estado.fase = "PREP_ESCOLHA_5J";
    estado.vez = estado.distribuidor;
    estado.preparacao = {
      centrosExtras: cartasCe.slice(aDistribuir).map((c) => c.id),
      escolhasB: 0,
      escolhasFeitas: 0,
    };
  } else {
    estado.preparacao = { centrosExtras: [], escolhasB: 0, escolhasFeitas: 0 };
    iniciarOcupacao(ctx);
  }
}
