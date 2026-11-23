// Resultado de aplicar uma ação. Ação inválida não lança exceção para fora do engine: volta como
// erro com código estável (para a interface) e mensagem em português.

import type { EstadoPartida } from "./estado.js";
import type { Evento } from "./eventos.js";

export type CodigoErro =
  | "ACAO_INVALIDA"
  | "PARTIDA_ENCERRADA"
  | "JOGADOR_INEXISTENTE"
  | "JOGADORES_INVALIDOS"
  | "PARAMETROS_INVALIDOS"
  | "NAO_E_SUA_VEZ"
  | "FASE_ERRADA"
  | "ACAO_BLOQUEADA"
  | "RECEBIMENTO_PENDENTE"
  | "TERRITORIO_INVALIDO"
  | "TERRITORIO_OCUPADO"
  | "NAO_E_SEU"
  | "ALVO_INVALIDO"
  | "NAO_VIZINHO"
  | "QUANTIDADE_INVALIDA"
  | "EXERCITOS_INSUFICIENTES"
  | "BOMBARDEIROS_INSUFICIENTES"
  | "CARTA_INVALIDA";

export interface ErroRegra {
  readonly codigo: CodigoErro;
  readonly mensagem: string;
}

export type Resultado =
  | { readonly ok: true; readonly estado: EstadoPartida; readonly eventos: readonly Evento[] }
  | { readonly ok: false; readonly erro: ErroRegra };

// Uso interno: as regras recusam lançando RecusaRegra, e aplicarAcao()/criarPartida() a
// convertem em Resultado. Como elas trabalham sobre uma cópia, nada vaza da ação recusada.
export class RecusaRegra extends Error {
  readonly codigo: CodigoErro;

  constructor(codigo: CodigoErro, mensagem: string) {
    super(mensagem);
    this.name = "RecusaRegra";
    this.codigo = codigo;
  }
}

export function exigir(condicao: unknown, codigo: CodigoErro, mensagem: string): asserts condicao {
  if (!condicao) throw new RecusaRegra(codigo, mensagem);
}

export function exigirQuantidade(valor: unknown, minimo = 1): asserts valor is number {
  exigir(
    typeof valor === "number" && Number.isInteger(valor) && valor >= minimo,
    "QUANTIDADE_INVALIDA",
    `Quantidade deve ser um inteiro ≥ ${minimo}`,
  );
}
