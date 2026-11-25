// Robô heurístico (src/robo): partidas inteiras só com robôs, e contra o robô aleatório dos
// testes. Confere que ele nunca manda ação recusada, que as partidas terminam e que joga melhor
// que o aleatório.

import { describe, test } from "node:test";

import {
  type Acao,
  aplicarAcao,
  criarPartida,
  decidirAcao,
  type EstadoPartida,
  jogadorDaVez,
  PARAMETROS_PADRAO,
  rngComSemente,
  visaoDoJogador,
} from "../src/index.js";
import { escolherAcao, jogadoresDe, verdade } from "./apoio.js";

const MAX_ACOES = 60000;

// `aleatorios`: ids que jogam com o robô aleatório; os demais, com o heurístico.
function jogar(
  n: number,
  semente: number,
  aleatorios: ReadonlySet<string> = new Set(),
): { estado: EstadoPartida; acoes: number } {
  const jogo = rngComSemente(semente);
  const decisao = rngComSemente(semente + 7);
  const criada = criarPartida(jogadoresDe(n), PARAMETROS_PADRAO, jogo);
  if (!criada.ok) throw new Error(criada.erro.mensagem);
  let estado = criada.estado;
  let acoes = 0;
  while (estado.fase !== "FIM" && acoes < MAX_ACOES) {
    const id = jogadorDaVez(estado).id;
    const acao: Acao = aleatorios.has(id)
      ? escolherAcao(estado, decisao)
      : decidirAcao(visaoDoJogador(estado, id), decisao);
    const r = aplicarAcao(estado, id, acao, jogo);
    if (!r.ok) {
      throw new Error(
        `ação ${acoes + 1} de ${id} ${JSON.stringify(acao)} recusada: ${r.erro.mensagem}`,
      );
    }
    estado = r.estado;
    acoes++;
  }
  return { estado, acoes };
}

describe("Robô heurístico", () => {
  for (let n = 3; n <= 6; n++) {
    for (const semente of [11, 22]) {
      test(`${n} robôs heurísticos terminam a partida (semente ${semente})`, (t) => {
        const { estado, acoes } = jogar(n, semente * n);
        verdade(estado.fase === "FIM", `a partida não terminou em ${acoes} ações`);
        t.diagnostic(`vitória de ${estado.vencedor}, ${estado.rodada} rodadas, ${acoes} ações`);
      });
    }
  }

  test("vence o robô aleatório na maioria das partidas", (t) => {
    const PARTIDAS = 12;
    let vitorias = 0;
    for (let i = 0; i < PARTIDAS; i++) {
      // J1 heurístico contra dois aleatórios.
      const { estado } = jogar(3, 300 + i, new Set(["J2", "J3"]));
      if (estado.vencedor === "J1") vitorias++;
    }
    t.diagnostic(`${vitorias} de ${PARTIDAS}`);
    verdade(vitorias > PARTIDAS / 2, `venceu só ${vitorias} de ${PARTIDAS}`);
  });

  test("decide igual sem ver as cartas e objetivos alheios", () => {
    const criada = criarPartida(jogadoresDe(4), PARAMETROS_PADRAO, rngComSemente(9));
    if (!criada.ok) throw new Error(criada.erro.mensagem);
    let estado = criada.estado;
    const jogo = rngComSemente(10);
    for (let k = 0; k < 400 && estado.fase !== "FIM"; k++) {
      const id = jogadorDaVez(estado).id;
      // A visão é a única entrada: trocar o que é oculto no estado não muda a decisão.
      const trocado = structuredClone(estado);
      for (const j of trocado.jogadores) {
        if (j.id === id) continue;
        j.objetivoId = "obj07";
        j.cartas = [];
      }
      const a = decidirAcao(visaoDoJogador(estado, id), rngComSemente(k));
      const b = decidirAcao(visaoDoJogador(trocado, id), rngComSemente(k));
      verdade(
        JSON.stringify(a) === JSON.stringify(b),
        `decisão ${k} dependeu de informação oculta`,
      );
      const r = aplicarAcao(estado, id, a, jogo);
      if (!r.ok) throw new Error(r.erro.mensagem);
      estado = r.estado;
    }
  });
});
