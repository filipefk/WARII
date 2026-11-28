// Formato dos parâmetros da partida (WARII.md §13.4), configurados pelo anfitrião no lobby.
// Espelha `Parametros` do engine; a validade das regras (ex.: variante ainda não implementada)
// continua sendo decidida por validarParametros(), que o servidor roda depois deste schema.
import type { ContinenteId, Parametros } from "@warii/engine";
import { z } from "zod";

const LIMITE = 999;

const inteiro = (minimo: number) => z.int().min(minimo).max(LIMITE);
const faces = z.array(inteiro(0)).length(6, "o dado precisa de 6 faces");
const bonus = z.strictObject({ maioria: inteiro(0), totalidade: inteiro(0) });

// Um campo por continente; o `satisfies` acusa se um continente for criado ou removido no engine.
const formaBonus = {
  AN: bonus,
  AS: bonus,
  EU: bonus,
  AF: bonus,
  ASI: bonus,
  OC: bonus,
} satisfies Record<ContinenteId, typeof bonus>;

export const esquemaParametros = z.strictObject({
  facesAntiaereo: faces,
  facesAtaqueAereo: faces,
  bonusContinentes: z.strictObject(formaBonus),
  minimoRecebimento: inteiro(0),
  bombardeirosPorJogador: inteiro(0),
  cartasPorConquista: inteiro(0),
  limiteMao: inteiro(1),
  herancaLimitadaPorSorteio: z.boolean(),
  tamanhoDescarteReembaralhar: inteiro(1),
  sobreviventesAereoVoltamParaBase: z.boolean(),
  somarBaseECaixa: z.boolean(),
  interromperAtaqueAereo: z.boolean(),
  objetivoSubstitutoDestruir: z.boolean(),
  objetivoTresCentros: z.boolean(),
  exercitosDaConquistaPodemDeslocar: z.boolean(),
  transporteCartasContaMovimento: z.boolean(),
  vitoriaAQualquerMomento: z.boolean(),
  centroInformacoes: z.boolean(),
});

// Configuração do lobby: só os campos alterados (o servidor junta com os atuais).
// `bonusContinentes`, se vier, vem completo.
export const esquemaParametrosParciais = esquemaParametros.partial();

export type ParametrosEntrada = z.infer<typeof esquemaParametros>;
export type ParametrosParciaisEntrada = z.infer<typeof esquemaParametrosParciais>;

// Conferência em tempo de compilação: o schema cobre exatamente os campos do engine.
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const compativel: ParametrosEntrada extends Parametros ? true : false = true;
const mesmosCampos: Igual<keyof ParametrosEntrada, keyof Parametros> = true;
void compativel;
void mesmosCampos;
