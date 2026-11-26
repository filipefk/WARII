// Parâmetros configuráveis da partida (WARII.md §13.4). Toda regra divergente entre manual e
// vídeo, ou ainda ⚠ A CONFIRMAR, vira um parâmetro aqui; o código das regras nunca fixa o valor.

import { CONTINENTES, IDS_CONTINENTES, type ContinenteId } from "../data/continentes.js";
import { FACES_ANTIAEREO_PADRAO, FACES_ATAQUE_AEREO_PADRAO } from "../data/dados.js";

export interface BonusContinente {
  readonly maioria: number;
  readonly totalidade: number;
}

export interface Parametros {
  // Bombardeiros abatidos por face do dado antiaéreo (manual: [0,0,0,1,1,1]).
  readonly facesAntiaereo: readonly number[];
  // Exércitos abatidos por face do dado de ataque aéreo.
  readonly facesAtaqueAereo: readonly number[];
  // Tabela de recebimento por continente (§6.2).
  readonly bonusContinentes: Readonly<Record<ContinenteId, BonusContinente>>;
  // Mínimo da parcela "territórios / 2" (§6.1).
  readonly minimoRecebimento: number;
  // Total físico de bombardeiros de cada jogador (§2 e §6.5).
  readonly bombardeirosPorJogador: number;
  // Cartas compradas no fim da vez com pelo menos uma conquista (§9.2).
  readonly cartasPorConquista: number;
  // Limite de cartas na mão (§9.2 e §11).
  readonly limiteMao: number;
  // Tamanho do descarte que o faz voltar, embaralhado, ao monte de compra (§9.4).
  readonly tamanhoDescarteReembaralhar: number;
  // 5 jogadores: depois de 3 escolhas (b), só resta a (a) (regra do manual, §4.3).
  readonly cincoJogadoresRestricaoManual: boolean;
  // Sobreviventes do ataque aéreo voltam para a base aérea (vídeo) ou para a caixa (manual) (§7.3).
  readonly sobreviventesAereoVoltamParaBase: boolean;
  // Somar bombardeiros da base e da caixa (cartas) no mesmo ataque aéreo (vídeo) (§7.3).
  readonly somarBaseECaixa: boolean;
  // O atacante pode encerrar o ataque aéreo entre ciclos (vídeo) (§7.3).
  readonly interromperAtaqueAereo: boolean;
  // "Destruir cor" vira "conquistar 24 territórios" quando a cor é a própria ou outro a elimina (§10.2).
  readonly objetivoSubstitutoDestruir: boolean;
  // Quem fica com 1 território passa a ter o objetivo "3 CE", de forma definitiva (manual, §10.2).
  readonly objetivoTresCentros: boolean;
  // Exércitos que entraram por conquista podem se mover na fase de deslocamento (§8.3; padrão: sim).
  readonly exercitosDaConquistaPodemDeslocar: boolean;
  // ⚠ Exércitos transportados por cartas contam para a regra de movimento único (§9.3 C).
  readonly transporteCartasContaMovimento: boolean;
  // ⚠ A vitória vale a qualquer momento, inclusive na vez de outro jogador (§10.3).
  readonly vitoriaAQualquerMomento: boolean;
  // Variante Centro de Informações (§12). Ainda não implementada (etapa 12).
  readonly centroInformacoes: boolean;
}

function bonusPadrao(c: ContinenteId): BonusContinente {
  return { maioria: CONTINENTES[c].bonusMaioria, totalidade: CONTINENTES[c].bonusTotalidade };
}

export const PARAMETROS_PADRAO: Parametros = {
  facesAntiaereo: [...FACES_ANTIAEREO_PADRAO],
  facesAtaqueAereo: [...FACES_ATAQUE_AEREO_PADRAO],
  bonusContinentes: {
    AN: bonusPadrao("AN"),
    AS: bonusPadrao("AS"),
    EU: bonusPadrao("EU"),
    AF: bonusPadrao("AF"),
    ASI: bonusPadrao("ASI"),
    OC: bonusPadrao("OC"),
  },
  minimoRecebimento: 3,
  bombardeirosPorJogador: 10,
  cartasPorConquista: 3,
  limiteMao: 5,
  tamanhoDescarteReembaralhar: 10,
  cincoJogadoresRestricaoManual: false,
  sobreviventesAereoVoltamParaBase: true,
  somarBaseECaixa: true,
  interromperAtaqueAereo: true,
  objetivoSubstitutoDestruir: true,
  objetivoTresCentros: false,
  exercitosDaConquistaPodemDeslocar: true,
  transporteCartasContaMovimento: true,
  vitoriaAQualquerMomento: true,
  centroInformacoes: false,
};

// Parâmetros padrão com alguns valores trocados (ex.: configuração do lobby).
export function comParametros(alteracoes: Partial<Parametros> = {}): Parametros {
  return { ...PARAMETROS_PADRAO, ...alteracoes };
}

const ehInteiro = (v: unknown, minimo: number): boolean =>
  typeof v === "number" && Number.isInteger(v) && v >= minimo;

function conferirFaces(nome: string, faces: unknown, erros: string[]): void {
  if (!Array.isArray(faces) || faces.length !== 6) {
    erros.push(`${nome}: precisa de 6 faces`);
    return;
  }
  if (!faces.every((f) => ehInteiro(f, 0))) erros.push(`${nome}: faces devem ser inteiros ≥ 0`);
}

// Devolve a lista de problemas (vazia = parâmetros válidos).
export function validarParametros(p: Parametros): string[] {
  const erros: string[] = [];
  conferirFaces("facesAntiaereo", p.facesAntiaereo, erros);
  conferirFaces("facesAtaqueAereo", p.facesAtaqueAereo, erros);
  for (const c of IDS_CONTINENTES) {
    const b = p.bonusContinentes[c] as BonusContinente | undefined;
    if (b === undefined || !ehInteiro(b.maioria, 0) || !ehInteiro(b.totalidade, 0)) {
      erros.push(`bonusContinentes.${c}: bônus devem ser inteiros ≥ 0`);
    }
  }
  const inteiros: [keyof Parametros, number][] = [
    ["minimoRecebimento", 0],
    ["bombardeirosPorJogador", 0],
    ["cartasPorConquista", 0],
    ["limiteMao", 1],
    ["tamanhoDescarteReembaralhar", 1],
  ];
  for (const [chave, minimo] of inteiros) {
    if (!ehInteiro(p[chave], minimo)) erros.push(`${chave}: deve ser inteiro ≥ ${minimo}`);
  }
  const booleanos: (keyof Parametros)[] = [
    "cincoJogadoresRestricaoManual",
    "sobreviventesAereoVoltamParaBase",
    "somarBaseECaixa",
    "interromperAtaqueAereo",
    "objetivoSubstitutoDestruir",
    "objetivoTresCentros",
    "exercitosDaConquistaPodemDeslocar",
    "transporteCartasContaMovimento",
    "vitoriaAQualquerMomento",
    "centroInformacoes",
  ];
  for (const chave of booleanos) {
    if (typeof p[chave] !== "boolean") erros.push(`${chave}: deve ser verdadeiro ou falso`);
  }
  if (p.centroInformacoes) erros.push("centroInformacoes: variante ainda não implementada");
  return erros;
}
