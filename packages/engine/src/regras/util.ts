// Uso interno: utilitários sem regra de jogo.

import { IDS_TERRITORIOS, type TerritorioId } from "../data/territorios.js";

// Cópia profunda de um valor serializável em JSON (o estado da partida e os parâmetros são).
export function copiaJson<T>(valor: T): T {
  // Só há dados JSON no valor, então a cópia tem o mesmo formato do original.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return JSON.parse(JSON.stringify(valor)) as T;
}

// Objeto com uma entrada por território do mapa.
export function porTerritorio<T>(valor: (t: TerritorioId) => T): Record<TerritorioId, T> {
  // IDS_TERRITORIOS tem todas as chaves de TerritorioId.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.fromEntries(IDS_TERRITORIOS.map((t) => [t, valor(t)])) as Record<TerritorioId, T>;
}

// Fecha um switch exaustivo: o compilador garante que nunca é chamado.
export function naoAlcancavel(valor: never): never {
  throw new Error(`Valor inesperado: ${JSON.stringify(valor)}`);
}
