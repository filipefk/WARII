// Rótulos e descrições dos parâmetros da partida (WARII.md §13.4) para a sala de espera.
// O `satisfies` acusa quando um parâmetro é criado ou removido no engine sem passar por aqui.
import type { Parametros } from "@warii/engine";

export type CampoParametro =
  | { tipo: "booleano"; rotulo: string; descricao: string; desabilitado?: string }
  | { tipo: "inteiro"; rotulo: string; descricao: string; minimo: number }
  | { tipo: "faces"; rotulo: string; descricao: string }
  | { tipo: "bonus"; rotulo: string; descricao: string };

export const CAMPOS_PARAMETROS = {
  minimoRecebimento: {
    tipo: "inteiro",
    rotulo: "Mínimo de recebimento",
    descricao: "Mínimo da parcela “territórios ÷ 2” no recebimento de exércitos (§6.1).",
    minimo: 0,
  },
  bombardeirosPorJogador: {
    tipo: "inteiro",
    rotulo: "Bombardeiros por jogador",
    descricao: "Total de bombardeiros de cada jogador (§2 e §6.5).",
    minimo: 0,
  },
  cartasPorConquista: {
    tipo: "inteiro",
    rotulo: "Cartas por conquista",
    descricao: "Cartas compradas no fim da vez em que houve ao menos uma conquista (§9.2).",
    minimo: 0,
  },
  limiteMao: {
    tipo: "inteiro",
    rotulo: "Limite de cartas na mão",
    descricao: "Máximo de cartas que um jogador pode guardar (§9.2 e §11).",
    minimo: 1,
  },
  tamanhoDescarteReembaralhar: {
    tipo: "inteiro",
    rotulo: "Descarte para reembaralhar",
    descricao: "Tamanho do descarte que volta, embaralhado, ao monte de compra (§9.4).",
    minimo: 1,
  },
  facesAntiaereo: {
    tipo: "faces",
    rotulo: "Dado antiaéreo",
    descricao:
      "Bombardeiros abatidos por face. Padrão: [0,0,0,1,2,3]; 📘 manual: [0,0,0,1,1,1] (§7.3).",
  },
  facesAtaqueAereo: {
    tipo: "faces",
    rotulo: "Dado de ataque aéreo",
    descricao: "Exércitos abatidos por face do dado de ataque aéreo (§7.3).",
  },
  bonusContinentes: {
    tipo: "bonus",
    rotulo: "Bônus dos continentes",
    descricao: "Exércitos recebidos por maioria e por totalidade de cada continente (§6.2).",
  },
  cincoJogadoresRestricaoManual: {
    tipo: "booleano",
    rotulo: "Restrição do manual com 5 jogadores",
    descricao:
      "📘 Manual: depois de 3 escolhas (b), só resta a (a). Desligado segue o vídeo (§4.3).",
  },
  sobreviventesAereoVoltamParaBase: {
    tipo: "booleano",
    rotulo: "Sobreviventes do ataque aéreo voltam à base",
    descricao:
      "📘 Vídeo: voltam para a base aérea. Desligado: voltam para a caixa (manual) (§7.3).",
  },
  somarBaseECaixa: {
    tipo: "booleano",
    rotulo: "Somar bombardeiros da base e da caixa",
    descricao: "📘 Vídeo: base e caixa (cartas) somam no mesmo ataque aéreo (§7.3).",
  },
  interromperAtaqueAereo: {
    tipo: "booleano",
    rotulo: "Interromper ataque aéreo entre ciclos",
    descricao: "📘 Vídeo: o atacante pode encerrar o ataque aéreo entre um ciclo e outro (§7.3).",
  },
  objetivoSubstitutoDestruir: {
    tipo: "booleano",
    rotulo: "“Destruir cor” vira “24 territórios”",
    descricao:
      "📘 Vídeo: quando a cor é a própria ou outro jogador a elimina, o objetivo muda sozinho (§10.2).",
  },
  objetivoTresCentros: {
    tipo: "booleano",
    rotulo: "Objetivo “3 centros estratégicos”",
    descricao:
      "📘 Manual: quem fica com 1 território passa a ter o objetivo de 3 CE, de vez (§10.2).",
  },
  exercitosDaConquistaPodemDeslocar: {
    tipo: "booleano",
    rotulo: "Exércitos da conquista podem deslocar",
    descricao:
      "Exércitos que entraram por conquista podem se mover no deslocamento do fim da vez (§8.3).",
  },
  transporteCartasContaMovimento: {
    tipo: "booleano",
    rotulo: "Transporte por cartas conta como movimento",
    descricao:
      "⚠ A confirmar: exércitos transportados por cartas contam para o movimento único (§9.3 C).",
  },
  herancaLimitadaPorSorteio: {
    tipo: "booleano",
    rotulo: "Herança de cartas por sorteio",
    descricao:
      "Ao eliminar um jogador, herda por sorteio só as cartas que cabem no limite da mão; as outras vão para o descarte. Desligado: herda todas e usa ou descarta o excesso (§11).",
  },
  vitoriaAQualquerMomento: {
    tipo: "booleano",
    rotulo: "Vitória a qualquer momento",
    descricao: "⚠ A confirmar: a vitória vale até na vez de outro jogador (§10.3).",
  },
  centroInformacoes: {
    tipo: "booleano",
    rotulo: "Variante Centro de Informações",
    descricao: "Módulo opcional (§12).",
    desabilitado: "ainda não implementada (etapa 12)",
  },
} as const satisfies Record<keyof Parametros, CampoParametro>;

// Ordem de exibição: números, dados, bônus e, por fim, as regras de liga/desliga.
export function ehChaveParametro(chave: string): chave is keyof Parametros {
  return Object.hasOwn(CAMPOS_PARAMETROS, chave);
}

export const ORDEM_PARAMETROS: (keyof Parametros)[] =
  Object.keys(CAMPOS_PARAMETROS).filter(ehChaveParametro);
