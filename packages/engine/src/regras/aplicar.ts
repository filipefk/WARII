// Ponto de entrada das regras: aplica a ação de um jogador e devolve o novo estado e os eventos,
// ou o motivo da recusa. Função pura por fora: o estado de entrada nunca é alterado.

import type { Acao, TipoAcao } from "./acoes.js";
import {
  continuarAtaqueAereo,
  encerrarAtaqueAereo,
  iniciarAtaqueAereo,
  rolarAntiaereo,
  rolarAtaqueAereo,
} from "./ataqueAereo.js";
import {
  atacar,
  encerrarAtaqueTerrestre,
  fecharConflitoSeOutraAcao,
  iniciarAtaqueTerrestre,
  moverAposConquista,
  rolarDefesa,
} from "./ataqueTerrestre.js";
import { descartar, reforcarComCartas, transportarComCartas } from "./cartas.js";
import { jogadorDaVez, jogadorQueAge } from "./consultas.js";
import type { Contexto } from "./contexto.js";
import { deslocar, encerrarAtaques, encerrarJogada } from "./deslocamento.js";
import type { EstadoPartida, EtapaAerea, Fase, JogadorId } from "./estado.js";
import { verificarFimDeJogo } from "./objetivos.js";
import { ocupar, ocuparDoisVagos, pegarCentroExtra } from "./preparacao.js";
import { encerrarRecebimento, posicionar } from "./recebimento.js";
import { exigir, RecusaRegra, type Resultado } from "./resultado.js";
import type { Rng } from "./rng.js";
import { copiaJson } from "./util.js";

const DA_VEZ: readonly Fase[] = ["RECEBER", "ATACAR", "DESLOCAR"];

// Fases em que cada ação é aceita.
const FASES: Readonly<Record<TipoAcao, readonly Fase[]>> = {
  pegarCentroExtra: ["PREP_ESCOLHA_5J"],
  ocuparDoisVagos: ["PREP_ESCOLHA_5J"],
  ocupar: ["PREP_OCUPACAO"],
  posicionar: ["RECEBER"],
  encerrarRecebimento: ["RECEBER"],
  iniciarAtaqueTerrestre: ["ATACAR"],
  encerrarAtaqueTerrestre: ["ATACAR"],
  atacar: ["ATACAR"],
  rolarDefesa: ["ATACAR"],
  moverAposConquista: ["ATACAR"],
  iniciarAtaqueAereo: ["ATACAR"],
  rolarAntiaereo: ["ATACAR"],
  rolarAtaqueAereo: ["ATACAR"],
  continuarAtaqueAereo: ["ATACAR"],
  encerrarAtaqueAereo: ["ATACAR"],
  encerrarAtaques: ["ATACAR"],
  deslocar: ["DESLOCAR"],
  reforcarComCartas: DA_VEZ,
  transportarComCartas: DA_VEZ,
  descartar: DA_VEZ,
  encerrarJogada: ["ATACAR", "DESLOCAR"],
};

const USO_DE_CARTAS: readonly TipoAcao[] = [
  "reforcarComCartas",
  "transportarComCartas",
  "descartar",
];

const ACOES_DA_ETAPA_AEREA: Readonly<Record<EtapaAerea, readonly TipoAcao[]>> = {
  antiaereo: ["rolarAntiaereo"],
  ataque: ["rolarAtaqueAereo"],
  decisao: ["continuarAtaqueAereo", "encerrarAtaqueAereo"],
};

const MENSAGEM_DA_ETAPA_AEREA: Readonly<Record<EtapaAerea, string>> = {
  antiaereo: "O defensor precisa rolar a antiaérea",
  ataque: "Role antes o dado do ataque aéreo",
  decisao: "Continue ou encerre antes o ataque aéreo em curso",
};

// Situações que precisam ser resolvidas antes de qualquer outra ação.
function exigirSemPendencias(estado: EstadoPartida, tipo: TipoAcao): void {
  const t = estado.turno;
  if (t.conquistaPendente !== null) {
    exigir(
      tipo === "moverAposConquista",
      "ACAO_BLOQUEADA",
      "Escolha antes quantos exércitos entram no território conquistado",
    );
    return;
  }
  if (t.ataqueTerrestre !== null) {
    exigir(tipo === "rolarDefesa", "ACAO_BLOQUEADA", "O defensor precisa rolar a defesa");
    return;
  }
  if (t.ataqueAereo !== null) {
    const esperadas = ACOES_DA_ETAPA_AEREA[t.ataqueAereo.etapa];
    exigir(
      esperadas.includes(tipo),
      "ACAO_BLOQUEADA",
      MENSAGEM_DA_ETAPA_AEREA[t.ataqueAereo.etapa],
    );
    return;
  }
  if (DA_VEZ.includes(estado.fase)) {
    const limite = estado.parametros.limiteMao;
    exigir(
      jogadorDaVez(estado).cartas.length <= limite || USO_DE_CARTAS.includes(tipo),
      "ACAO_BLOQUEADA",
      `Use ou descarte cartas até ficar com no máximo ${limite} na mão`,
    );
  }
}

function executar(ctx: Contexto, acao: Acao): void {
  switch (acao.tipo) {
    case "pegarCentroExtra":
      return pegarCentroExtra(ctx, acao.carta);
    case "ocuparDoisVagos":
      return ocuparDoisVagos(ctx, acao.territorios);
    case "ocupar":
      return ocupar(ctx, acao.territorio);
    case "posicionar":
      return posicionar(ctx, acao.territorio, acao.quantidade);
    case "encerrarRecebimento":
      return encerrarRecebimento(ctx);
    case "iniciarAtaqueTerrestre":
      return iniciarAtaqueTerrestre(ctx, acao.origem, acao.alvo);
    case "encerrarAtaqueTerrestre":
      return encerrarAtaqueTerrestre(ctx);
    case "atacar":
      return atacar(ctx, acao.origem, acao.alvo, acao.dados);
    case "rolarDefesa":
      return rolarDefesa(ctx);
    case "moverAposConquista":
      return moverAposConquista(ctx, acao.quantidade);
    case "iniciarAtaqueAereo":
      return iniciarAtaqueAereo(ctx, acao.alvo, acao.daBase, acao.cartas);
    case "rolarAntiaereo":
      return rolarAntiaereo(ctx);
    case "rolarAtaqueAereo":
      return rolarAtaqueAereo(ctx);
    case "continuarAtaqueAereo":
      return continuarAtaqueAereo(ctx);
    case "encerrarAtaqueAereo":
      return encerrarAtaqueAereo(ctx);
    case "encerrarAtaques":
      return encerrarAtaques(ctx);
    case "deslocar":
      return deslocar(ctx, acao.origem, acao.destino, acao.quantidade);
    case "reforcarComCartas":
      return reforcarComCartas(ctx, acao.carta, acao.territorio, acao.numericas);
    case "transportarComCartas":
      return transportarComCartas(ctx, acao.cartas, acao.origem, acao.destino, acao.quantidade);
    case "descartar":
      return descartar(ctx, acao.cartas);
    case "encerrarJogada":
      return encerrarJogada(ctx);
  }
}

export function aplicarAcao(
  estado: EstadoPartida,
  jogadorId: JogadorId,
  acao: Acao,
  rng: Rng,
): Resultado {
  try {
    exigir(estado.fase !== "FIM", "PARTIDA_ENCERRADA", "A partida já terminou");
    const indice = estado.jogadores.findIndex((j) => j.id === jogadorId);
    exigir(indice >= 0, "JOGADOR_INEXISTENTE", "Jogador não está na partida");
    // Fora da vez, só o defensor rolando os próprios dados de defesa ou antiaérea.
    if (jogadorId !== jogadorQueAge(estado)) {
      exigir(indice !== estado.vez, "NAO_E_SUA_VEZ", "Aguardando o defensor rolar os dados");
      exigir(false, "NAO_E_SUA_VEZ", "Não é a sua vez");
    }
    // A ação pode vir de fora sem passar pela validação de formato.
    const tipo = (acao as { tipo?: unknown } | null)?.tipo;
    exigir(
      typeof tipo === "string" && Object.hasOwn(FASES, tipo),
      "ACAO_INVALIDA",
      "Ação desconhecida",
    );
    exigir(FASES[acao.tipo].includes(estado.fase), "FASE_ERRADA", "Essa ação não vale nesta fase");
    exigirSemPendencias(estado, acao.tipo);

    const ctx: Contexto = {
      estado: copiaJson(estado),
      eventos: [],
      rng,
    };
    fecharConflitoSeOutraAcao(ctx, acao);
    executar(ctx, acao);
    verificarFimDeJogo(ctx);
    return { ok: true, estado: ctx.estado, eventos: ctx.eventos };
  } catch (e) {
    if (e instanceof RecusaRegra)
      return { ok: false, erro: { codigo: e.codigo, mensagem: e.message } };
    throw e;
  }
}
