// RNG das partidas reais: sorteios do `crypto` do Node (nunca Math.random). O engine a recebe
// envolvida por gravarRng(), e os sorteios vão para o log junto com a ação.
import { randomInt } from "node:crypto";
import type { Rng } from "@warii/engine";

export function rngCrypto(): Rng {
  return { inteiro: (maxExclusivo) => randomInt(maxExclusivo) };
}
