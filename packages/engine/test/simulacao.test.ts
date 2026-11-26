// Partidas completas com robôs aleatórios: confere invariantes, informação oculta e replay
// depois de cada ação. `pnpm test:simulacao` na raiz (PARTIDAS=N muda a quantidade; padrão 40).

import { describe, test } from "node:test";

import {
  type Acao,
  aplicarAcao,
  comParametros,
  criarPartida,
  type EstadoPartida,
  type Evento,
  eventosParaJogador,
  FACES_ANTIAEREO_MANUAL,
  gravarRng,
  IDS_TERRITORIOS,
  jogador,
  jogadorDaVez,
  jogadorQueAge,
  PARAMETROS_PADRAO,
  type Parametros,
  rngComSemente,
  rngDeReplay,
  visaoDoJogador,
} from "../src/index.js";
import { escolherAcao, jogadoresDe } from "./apoio.js";

const VARIANTES: readonly Parametros[] = [
  PARAMETROS_PADRAO,
  comParametros({
    facesAntiaereo: [...FACES_ANTIAEREO_MANUAL],
    sobreviventesAereoVoltamParaBase: false,
    somarBaseECaixa: false,
    interromperAtaqueAereo: false,
    cincoJogadoresRestricaoManual: true,
    objetivoTresCentros: true,
  }),
  comParametros({
    exercitosDaConquistaPodemDeslocar: true,
    transporteCartasContaMovimento: false,
    vitoriaAQualquerMomento: false,
  }),
];

function conferirInvariantes(e: EstadoPartida, evs: readonly Evento[], comVisao: boolean): void {
  const p = e.parametros;
  const prep = e.fase === "PREP_ESCOLHA_5J" || e.fase === "PREP_OCUPACAO";
  for (const t of IDS_TERRITORIOS) {
    const s = e.territorios[t];
    if (s.dono === null) {
      if (!prep) throw new Error(`${t} sem dono`);
    } else if (s.exercitos < 1) {
      throw new Error(`${t} com ${s.exercitos} exércitos`);
    } else if (jogador(e, s.dono)?.eliminado !== false) {
      throw new Error(`${t} com dono eliminado ou inexistente`);
    }
  }
  const daVez = jogadorDaVez(e);
  for (const j of e.jogadores) {
    const emCombate =
      e.turno.ataqueAereo !== null && daVez.id === j.id ? e.turno.ataqueAereo.emCombate : 0;
    const total = j.bombardeirosBase + j.bombardeirosCaixa + emCombate;
    const esperado = j.eliminado ? 0 : p.bombardeirosPorJogador;
    if (total !== esperado)
      throw new Error(`${j.id} com ${total} bombardeiros (esperado ${esperado})`);
    if (j.eliminado && j.cartas.length > 0 && e.fase !== "FIM")
      throw new Error(`${j.id} eliminado com cartas`);
    if (j.cartas.length > p.limiteMao && j.id !== daVez.id)
      throw new Error(`${j.id} acima do limite da mão`);
  }
  if (e.fase !== "PREP_ESCOLHA_5J") {
    const todas = [...e.monte, ...e.descarte, ...e.jogadores.flatMap((j) => j.cartas)];
    if (todas.length !== 61 || new Set(todas).size !== 61)
      throw new Error(`${todas.length} cartas no jogo`);
  }
  if (e.descarte.length >= p.tamanhoDescarteReembaralhar)
    throw new Error("descarte não reembaralhado");
  if (e.fase !== "FIM" && daVez.eliminado) throw new Error("vez de jogador eliminado");
  for (const j of e.jogadores) {
    for (const ev of eventosParaJogador(evs, j.id)) {
      if (
        (ev.tipo === "objetivoSorteado" || ev.tipo === "objetivoAlterado") &&
        ev.jogador !== j.id
      ) {
        throw new Error(`${j.id} recebeu objetivo de ${ev.jogador}`);
      }
      if (
        (ev.tipo === "cartasCompradas" || ev.tipo === "cartasHerdadas") &&
        ev.jogador !== j.id &&
        ev.cartas.length > 0
      ) {
        throw new Error(`${j.id} recebeu cartas de ${ev.jogador}`);
      }
    }
    if (!comVisao) continue;
    const v = visaoDoJogador(e, j.id);
    if ("monte" in v) throw new Error("visão com a ordem do monte");
    for (const o of v.jogadores) {
      if (o.id === j.id) continue;
      if (o.cartas !== null) throw new Error(`${j.id} vê as cartas de ${o.id}`);
      if (o.objetivoId !== null && !(e.fase === "FIM" && o.id === e.vencedor)) {
        throw new Error(`${j.id} vê o objetivo de ${o.id}`);
      }
    }
  }
}

const MAX_ACOES = 40000;
const MAX_RODADAS = 150;

interface Jogada {
  readonly jogador: string;
  readonly acao: Acao;
}

function simular(indice: number): { vencedor: string | null; rodadas: number; acoes: number } {
  const n = 3 + (indice % 4);
  const parametros = VARIANTES[indice % VARIANTES.length] ?? PARAMETROS_PADRAO;
  const jogadores = jogadoresDe(n);
  const gravado = gravarRng(rngComSemente(1000 + indice));
  const robo = rngComSemente(5000 + indice);
  const criada = criarPartida(jogadores, parametros, gravado.rng);
  if (!criada.ok) throw new Error(criada.erro.mensagem);
  let estado = criada.estado;
  conferirInvariantes(estado, criada.eventos, true);
  const jogadas: Jogada[] = [];
  while (estado.fase !== "FIM" && jogadas.length < MAX_ACOES && estado.rodada <= MAX_RODADAS) {
    const id = jogadorQueAge(estado);
    const acao = escolherAcao(estado, robo);
    const r = aplicarAcao(estado, id, acao, gravado.rng);
    if (!r.ok) {
      throw new Error(
        `ação ${jogadas.length + 1} ${JSON.stringify(acao)} recusada: ${r.erro.codigo} — ${r.erro.mensagem}`,
      );
    }
    jogadas.push({ jogador: id, acao });
    estado = r.estado;
    try {
      conferirInvariantes(estado, r.eventos, jogadas.length % 10 === 0 || estado.fase === "FIM");
    } catch (e) {
      throw new Error(
        `depois da ação ${jogadas.length} ${JSON.stringify(acao)}: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      );
    }
  }

  // Replay: os mesmos sorteios e as mesmas ações dão o mesmo estado final.
  const replay = rngDeReplay(gravado.sorteios);
  const recriada = criarPartida(jogadores, parametros, replay);
  if (!recriada.ok) throw new Error("replay: criação recusada");
  let repetido = recriada.estado;
  for (const j of jogadas) {
    const r = aplicarAcao(repetido, j.jogador, j.acao, replay);
    if (!r.ok) throw new Error(`replay: ${j.acao.tipo} recusada`);
    repetido = r.estado;
  }
  if (replay.restantes() !== 0) throw new Error(`replay: sobraram ${replay.restantes()} sorteios`);
  if (JSON.stringify(repetido) !== JSON.stringify(estado))
    throw new Error("replay: estado final diferente");
  return { vencedor: estado.vencedor, rodadas: estado.rodada, acoes: jogadas.length };
}

const PARTIDAS = Number(process.env["PARTIDAS"] ?? 40);

describe(`Simulação: ${PARTIDAS} partidas com robôs aleatórios`, () => {
  for (let i = 0; i < PARTIDAS; i++) {
    test(`partida ${i} (${3 + (i % 4)} jogadores, variante ${i % VARIANTES.length})`, (t) => {
      const r = simular(i);
      const fim =
        r.vencedor === null ? `limite de ${MAX_RODADAS} rodadas` : `vitória de ${r.vencedor}`;
      t.diagnostic(`${fim}, ${r.rodadas} rodadas, ${r.acoes} ações`);
    });
  }
});
