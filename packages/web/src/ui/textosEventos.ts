// Uma frase por evento do engine, para o log da partida. Os nomes dos jogadores vêm de quem chama
// (participantes do lobby); territórios, cartas e objetivos vêm dos dados do engine.
import {
  cartaDeTroca,
  type CartaId,
  CONTINENTES,
  type ContinenteId,
  type Evento,
  type Fase,
  IDS_CONTINENTES,
  objetivo,
  territorio,
  type TerritorioId,
} from "@warii/engine";

export const NOMES_FASES: Readonly<Record<Fase, string>> = {
  PREP_ESCOLHA_5J: "Preparação: escolha com 5 jogadores",
  PREP_OCUPACAO: "Preparação: ocupação",
  RECEBER: "Recebimento",
  ATACAR: "Ataque",
  DESLOCAR: "Deslocamento",
  FIM: "Fim de jogo",
};

const nomeT = (t: TerritorioId) => territorio(t).nome;
const listaT = (ts: readonly TerritorioId[]) => juntar(ts.map(nomeT));
const nomeCarta = (c: CartaId) => cartaDeTroca(c)?.nome ?? c;
const listaCartas = (cs: readonly CartaId[]) => juntar(cs.map(nomeCarta));
const textoObjetivo = (id: string) => objetivo(id)?.texto ?? id;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function juntar(itens: readonly string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1) ?? ""}`;
}

function bonusPorContinente(porContinente: Partial<Record<ContinenteId, number>>): string {
  const partes = IDS_CONTINENTES.flatMap((c) => {
    const n = porContinente[c];
    return n ? [`${n} em ${CONTINENTES[c].nome}`] : [];
  });
  return partes.length ? ` (+${juntar(partes)})` : "";
}

export function textoDoEvento(e: Evento, nome: (jogadorId: string) => string): string {
  switch (e.tipo) {
    case "distribuidorSorteado":
      return `${nome(e.distribuidor)} foi sorteado para distribuir as cartas.`;
    case "centrosDistribuidos":
      return `${nome(e.jogador)} recebeu os centros estratégicos ${listaT(e.territorios)}.`;
    case "centroExtraEscolhido":
      return `${nome(e.jogador)} pegou o centro estratégico ${nomeT(e.territorio)}.`;
    case "doisVagosOcupados":
      return `${nome(e.jogador)} ocupou ${listaT(e.territorios)}.`;
    case "territorioOcupado":
      return `${nome(e.jogador)} ocupou ${nomeT(e.territorio)}.`;
    case "objetivoSorteado":
      return e.emVigor === e.objetivo
        ? `Seu objetivo: ${textoObjetivo(e.objetivo)}`
        : `Seu objetivo era destruir a própria cor e passou a ser: ${textoObjetivo(e.emVigor)}`;
    case "inicioDaVez":
      return `Vez de ${nome(e.jogador)} (rodada ${e.rodada}${
        e.etapaPrimeiraRodada === 1 ? ", só recebimento" : ""
      }).`;
    case "recebimento":
      return `${nome(e.jogador)} recebe ${plural(e.livres, "exército", "exércitos")}${bonusPorContinente(
        e.porContinente,
      )}${e.centros.length ? `, +1 em cada CE (${e.centros.length})` : ""}${
        e.bombardeiros ? ` e ${plural(e.bombardeiros, "bombardeiro", "bombardeiros")}` : ""
      }.`;
    case "exercitosPosicionados":
      return `${nome(e.jogador)} colocou ${e.quantidade} em ${nomeT(e.territorio)}.`;
    case "faseAlterada":
      return `${nome(e.jogador)} passou para: ${NOMES_FASES[e.fase]}.`;
    case "ataqueTerrestre":
      return `${nome(e.jogador)} atacou ${nomeT(e.alvo)} (${nome(e.defensor)}) a partir de ${nomeT(
        e.origem,
      )}: ${e.dadosAtaque.join("-")} × ${e.dadosDefesa.join("-")}. Ataque perde ${
        e.perdasAtaque
      }, defesa perde ${e.perdasDefesa}.`;
    case "territorioConquistado":
      return `${nome(e.jogador)} conquistou ${nomeT(e.territorio)} de ${nome(e.defensor)}.`;
    case "exercitosMovidosAposConquista":
      return `${plural(e.quantidade, "exército entrou", "exércitos entraram")} em ${nomeT(e.destino)}.`;
    case "ataqueAereoIniciado":
      return `${nome(e.jogador)} iniciou um ataque aéreo a ${nomeT(e.alvo)} (${nome(
        e.defensor,
      )}) com ${plural(e.daBase + e.daCaixa, "bombardeiro", "bombardeiros")}${
        e.cartas.length ? `, usando ${listaCartas(e.cartas)}` : ""
      }.`;
    case "cicloAereo":
      return `Ciclo aéreo em ${nomeT(e.alvo)}: antiaérea abateu ${plural(
        e.bombardeirosAbatidos,
        "bombardeiro",
        "bombardeiros",
      )}${
        e.dadoAtaque === null
          ? "; nenhum bombardeiro sobrou para atacar"
          : `; o ataque abateu ${plural(e.exercitosAbatidos, "exército", "exércitos")}`
      }.`;
    case "ataqueAereoEncerrado":
      return `Ataque aéreo a ${nomeT(e.alvo)} encerrado: ${plural(
        e.sobreviventes,
        "bombardeiro voltou",
        "bombardeiros voltaram",
      )} para a ${e.destino === "base" ? "base" : "caixa"}.`;
    case "deslocamento":
      return `${nome(e.jogador)} ${e.aereo ? "aerotransportou" : "deslocou"} ${e.quantidade} de ${nomeT(
        e.origem,
      )} para ${nomeT(e.destino)}.`;
    case "reforcoComCartas":
      return `${nome(e.jogador)} usou ${listaCartas(e.cartas)} e reforçou ${nomeT(e.territorio)} com ${
        e.quantidade
      }.`;
    case "transporteComCartas":
      return `${nome(e.jogador)} usou ${listaCartas(e.cartas)} e transportou ${e.quantidade} de ${nomeT(
        e.origem,
      )} para ${nomeT(e.destino)}.`;
    case "cartasDescartadas":
      return `${nome(e.jogador)} descartou ${listaCartas(e.cartas)}.`;
    case "cartasCompradas":
      return e.cartas.length
        ? `${nome(e.jogador)} comprou ${listaCartas(e.cartas)}.`
        : `${nome(e.jogador)} comprou ${plural(e.quantidade, "carta", "cartas")}.`;
    case "descarteReembaralhado":
      return `O descarte (${e.quantidade}) voltou embaralhado ao monte.`;
    case "jogadorEliminado":
      return `${nome(e.jogador)} foi eliminado por ${nome(e.por)}.`;
    case "cartasHerdadas":
      return e.cartas.length
        ? `${nome(e.jogador)} herdou de ${nome(e.de)}: ${listaCartas(e.cartas)}.`
        : `${nome(e.jogador)} herdou ${plural(e.quantidade, "carta", "cartas")} de ${nome(e.de)}.`;
    case "objetivoAlterado":
      return `Seu objetivo mudou ${
        e.motivo === "corEliminadaPorOutro"
          ? "(outro jogador eliminou a cor)"
          : "(você ficou com um território só)"
      }: ${textoObjetivo(e.objetivo)}`;
    case "vitoria":
      return `${nome(e.jogador)} venceu! Objetivo: ${textoObjetivo(e.objetivo)}`;
    default: {
      // Todo tipo de evento tem frase: um tipo novo no engine quebra a compilação aqui.
      const novo: never = e;
      return String(novo);
    }
  }
}
