// Schemas zod do contrato do jogo (@warii/shared): ações, parâmetros e entradas do lobby. Sem banco.
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PARAMETROS_PADRAO } from "@warii/engine";
import {
  ConfigurarPartidaEntrada,
  CriarPartidaEntrada,
  EscolherCorEntrada,
  esquemaAcao,
  esquemaParametros,
  esquemaParametrosParciais,
} from "@warii/shared";

function aceita(esquema: { safeParse: (valor: unknown) => { success: boolean } }, valor: unknown) {
  return esquema.safeParse(valor).success;
}

// Uma ação válida (no formato) de cada tipo.
const ACOES_VALIDAS = [
  { tipo: "ocupar", territorio: "alasca" },
  { tipo: "posicionar", territorio: "brasil", quantidade: 3 },
  { tipo: "encerrarRecebimento" },
  { tipo: "atacar", origem: "brasil", alvo: "argentina", dados: 3 },
  { tipo: "rolarDefesa" },
  { tipo: "moverAposConquista", quantidade: 2 },
  { tipo: "iniciarAtaqueAereo", alvo: "egito", daBase: 4 },
  {
    tipo: "iniciarAtaqueAereo",
    alvo: "egito",
    daBase: 0,
    cartas: { carta: "moscou", numericas: ["num2-01"] },
  },
  { tipo: "rolarAntiaereo" },
  { tipo: "rolarAtaqueAereo" },
  { tipo: "continuarAtaqueAereo" },
  { tipo: "encerrarAtaqueAereo" },
  { tipo: "encerrarAtaques" },
  { tipo: "deslocar", origem: "brasil", destino: "argentina", quantidade: 1 },
  { tipo: "reforcarComCartas", carta: "brasil", territorio: "brasil", numericas: [] },
  {
    tipo: "transportarComCartas",
    cartas: ["brasil", "egito"],
    origem: "brasil",
    destino: "egito",
    quantidade: 5,
  },
  { tipo: "descartar", cartas: ["cont-AF"] },
  { tipo: "encerrarJogada" },
];

describe("contrato das ações do jogo", () => {
  test("aceita uma ação de cada tipo", () => {
    for (const acao of ACOES_VALIDAS) assert.equal(aceita(esquemaAcao, acao), true, acao.tipo);
  });

  test("recusa tipo desconhecido, território e carta inexistentes", () => {
    assert.equal(aceita(esquemaAcao, { tipo: "trapacear" }), false);
    assert.equal(aceita(esquemaAcao, { tipo: "ocupar", territorio: "atlantida" }), false);
    assert.equal(aceita(esquemaAcao, { tipo: "descartar", cartas: ["coringa"] }), false);
    assert.equal(aceita(esquemaAcao, { tipo: "descartar", cartas: [] }), false);
  });

  test("recusa quantidades fora do formato", () => {
    const base = { tipo: "posicionar", territorio: "brasil" };
    for (const quantidade of [0, -1, 1.5, "3", 1e9, Number.NaN]) {
      assert.equal(aceita(esquemaAcao, { ...base, quantidade }), false, String(quantidade));
    }
    assert.equal(
      aceita(esquemaAcao, { tipo: "atacar", origem: "brasil", alvo: "argentina", dados: 4 }),
      false,
    );
  });

  test("recusa campos extras e listas com tamanho errado", () => {
    assert.equal(aceita(esquemaAcao, { tipo: "encerrarJogada", vencer: true }), false);
    assert.equal(
      aceita(esquemaAcao, {
        tipo: "transportarComCartas",
        cartas: ["brasil"],
        origem: "brasil",
        destino: "argentina",
        quantidade: 1,
      }),
      false,
    );
    assert.equal(aceita(esquemaAcao, null), false);
  });
});

describe("contrato dos parâmetros e do lobby", () => {
  test("os parâmetros padrão do engine passam no schema", () => {
    assert.equal(aceita(esquemaParametros, PARAMETROS_PADRAO), true);
  });

  test("recusa tipos errados, dado sem 6 faces e campo desconhecido", () => {
    assert.equal(aceita(esquemaParametros, { ...PARAMETROS_PADRAO, limiteMao: "5" }), false);
    assert.equal(
      aceita(esquemaParametros, { ...PARAMETROS_PADRAO, facesAntiaereo: [0, 1] }),
      false,
    );
    assert.equal(aceita(esquemaParametros, { ...PARAMETROS_PADRAO, extra: 1 }), false);
    assert.equal(aceita(esquemaParametrosParciais, { limiteMao: 0 }), false);
    assert.equal(aceita(esquemaParametrosParciais, { limiteMao: 7 }), true);
  });

  test("entradas do lobby", () => {
    assert.equal(CriarPartidaEntrada.parse({ nome: "  Sexta  " }).nome, "Sexta");
    assert.equal(CriarPartidaEntrada.parse({ nome: "Sexta" }).publica, false);
    assert.equal(CriarPartidaEntrada.parse({ nome: "Sexta", publica: true }).publica, true);
    assert.equal(aceita(CriarPartidaEntrada, { nome: "Sexta", publica: "sim" }), false);
    assert.equal(aceita(CriarPartidaEntrada, { nome: "x" }), false);
    assert.equal(aceita(EscolherCorEntrada, { cor: "azul" }), true);
    assert.equal(aceita(EscolherCorEntrada, { cor: "rosa" }), false);
    assert.equal(
      aceita(ConfigurarPartidaEntrada, { parametros: { somarBaseECaixa: false } }),
      true,
    );
    assert.equal(aceita(ConfigurarPartidaEntrada, { parametros: { inventado: 1 } }), false);
  });
});
