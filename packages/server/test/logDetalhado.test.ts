// Log detalhado da partida (partidas/logDetalhado.ts): monta o texto a partir de um log gravado
// de uma partida jogada por robôs. Sem banco.
import "./ambiente.js";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  type Acao,
  aplicarAcao,
  decidirAcao,
  type EstadoPartida,
  gravarRng,
  jogadorQueAge,
  PARAMETROS_PADRAO,
  rngComSemente,
  visaoDoJogador,
} from "@warii/engine";

import { type AcaoCriacao, montarPartida, TIPO_ACAO_CRIACAO } from "../src/partidas/inicio.js";
import { type EntradaDoLog, escreverLogDetalhado } from "../src/partidas/logDetalhado.js";

type Linha = EntradaDoLog["linhas"][number];

// Joga com a IA dos robôs até o início da rodada `ate`, gravando o log como o servidor grava.
function jogar(ate: number): { linhas: Linha[]; estado: EstadoPartida } {
  const criacao: AcaoCriacao = {
    participantes: [
      { id: "id-ana", cor: "azul" },
      { id: "id-bia", cor: "vermelho" },
      { id: "id-caio", cor: "verde" },
    ],
    parametros: PARAMETROS_PADRAO,
  };
  const g0 = gravarRng(rngComSemente(7));
  const r0 = montarPartida(criacao, g0.rng).resultado;
  assert.ok(r0.ok);
  const linhas: Linha[] = [
    {
      seq: 0,
      usuarioId: null,
      tipo: TIPO_ACAO_CRIACAO,
      acao: criacao,
      sorteios: g0.sorteios,
      criadaEm: new Date(0),
    },
  ];
  let estado = r0.estado;
  const robo = rngComSemente(11);
  for (let seq = 1; seq < 3000 && estado.fase !== "FIM" && estado.rodada < ate; seq++) {
    const quem = jogadorQueAge(estado);
    const acao: Acao = decidirAcao(visaoDoJogador(estado, quem), robo);
    const g = gravarRng(rngComSemente(1000 + seq));
    const r = aplicarAcao(estado, quem, acao, g.rng);
    assert.ok(r.ok, `ação seq ${seq} recusada`);
    linhas.push({
      seq,
      usuarioId: quem,
      tipo: acao.tipo,
      acao,
      sorteios: g.sorteios,
      criadaEm: new Date(seq * 1000),
    });
    estado = r.estado;
  }
  return { linhas, estado };
}

const pessoas = new Map([
  ["id-ana", { nome: "Ana", robo: false }],
  ["id-bia", { nome: "Bia", robo: false }],
  ["id-caio", { nome: "Caio", robo: true }],
]);

describe("log detalhado", () => {
  const { linhas } = jogar(2);
  const partida = {
    id: "00000000-0000-0000-0000-000000000000",
    nome: "Mesa de Sábado",
    status: "em_andamento" as const,
    seq: linhas.length - 1,
    vencedorId: null,
    criadaEm: new Date(0),
    iniciadaEm: new Date(0),
    encerradaEm: null,
  };

  test("repete a partida e explica as fases de cada vez", () => {
    const { texto, nomeArquivo } = escreverLogDetalhado({
      partida,
      pessoas,
      linhas,
      usuarioId: "id-ana",
      completo: true,
    });
    assert.equal(nomeArquivo, "warii-log-mesa-de-sabado-1970-01-01.txt");
    assert.ok(!texto.includes("ERRO NA REPETIÇÃO"));
    assert.ok(texto.includes(`[seq ${linhas.length - 1}]`));
    assert.ok(texto.includes(">>> INÍCIO DA VEZ"));
    // Etapa 2 da 1ª rodada: começa no ataque, com o motivo.
    assert.match(texto, /etapa 2 da 1ª rodada · começa na fase ATACAR/);
    assert.ok(texto.includes("WARII.md §5.1"));
    assert.ok(texto.includes("AN América do Norte"));
    // Ids trocados pelos nomes.
    assert.ok(!texto.includes("id-bia"));
    assert.ok(texto.includes("sorteios ("));
  });

  test("na visão de um jogador, esconde o que é dos outros", () => {
    const { texto } = escreverLogDetalhado({
      partida,
      pessoas,
      linhas,
      usuarioId: "id-ana",
      completo: false,
    });
    assert.ok(!texto.includes("sorteios ("));
    assert.ok(texto.includes("Visão: de Ana"));
    // Só o objetivo da própria Ana aparece na mesa.
    const objetivos = texto.split("\n").filter((l) => l.trim().startsWith("objetivo:"));
    const blocosDeMesa = texto
      .split("\n")
      .filter((l) => l.includes("SITUAÇÃO") || l.includes("MESA NO INÍCIO")).length;
    assert.ok(objetivos.length <= blocosDeMesa);
  });
});
