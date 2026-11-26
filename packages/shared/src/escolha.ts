// Escolhas em andamento do jogador da vez (origem, destino, quantidade, cartas marcadas), que o
// servidor repassa à mesa para todos acompanharem o painel dele. São efêmeras: não vão para o log
// nem mudam o estado. As cartas marcadas seguem só como contagem (a mão continua oculta).
import { CARTAS_DE_TROCA } from "@warii/engine";
import { z } from "zod";
import { esquemaTerritorio } from "./acoes.js";

export const MODOS_INTERACAO = [
  "nenhum",
  "doisVagos",
  "ataqueTerrestre",
  "ataqueAereo",
  "deslocar",
  "reforco",
  "transporte",
  "descarte",
] as const;

export type ModoInteracao = (typeof MODOS_INTERACAO)[number];

const inteiro = (minimo: number, maximo: number) => z.int().min(minimo).max(maximo);

export const esquemaEscolha = z.strictObject({
  // Seq da visão em que a escolha foi feita: vale só enquanto nenhuma ação nova for aplicada.
  seq: inteiro(0, Number.MAX_SAFE_INTEGER),
  modo: z.enum(MODOS_INTERACAO),
  origem: esquemaTerritorio.nullable(),
  destino: esquemaTerritorio.nullable(),
  // Quantidade de exércitos no seletor da etapa (colocar, mover, deslocar, transportar).
  quantidade: inteiro(0, 9_999).nullable(),
  // Bombardeiros da base no ataque aéreo.
  daBase: inteiro(0, 99).nullable(),
  // Dados escolhidos no ataque terrestre.
  dados: inteiro(1, 3).nullable(),
  cartasMarcadas: inteiro(0, CARTAS_DE_TROCA.length),
});

export type Escolha = z.infer<typeof esquemaEscolha>;
