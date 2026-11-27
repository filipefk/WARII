// Log detalhado de uma partida, em texto, para baixar e analisar (por uma pessoa ou por uma IA):
// repete o log gravado (acoes_partida) com os sorteios de cada ação e escreve, a cada ação, quem a
// enviou, quando, a situação antes, os eventos e a situação depois; a cada início de vez, o resumo
// da mesa e o cálculo do recebimento, com o porquê da fase em que a vez começou.
//
// Informação oculta: enquanto a partida está em andamento, cada jogador vê só o que a própria
// visão mostra (mãos e objetivos alheios somem, os sorteios não aparecem). Encerrada a partida, ou
// para o administrador, o log sai completo.
import {
  type Acao,
  aplicarAcao,
  calcularRecebimento,
  cartaDeTroca,
  CONTINENTES,
  type EstadoPartida,
  type Evento,
  eventosParaJogador,
  IDS_CONTINENTES,
  IDS_TERRITORIOS,
  objetivo,
  pendenteDeRecebimento,
  type Resultado,
  rngDeReplay,
  territorio,
  territoriosDoContinente,
  visaoDoJogador,
  type VisaoPartida,
} from "@warii/engine";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { acoesPartida, partidas, participantes, usuarios } from "../db/schema.js";
import { type AcaoCriacao, montarPartida, TIPO_ACAO_CRIACAO } from "./inicio.js";
import { ErroDeLobby } from "./lobby.js";

export interface LogDetalhado {
  nomeArquivo: string;
  texto: string;
}

export interface Pessoa {
  nome: string;
  robo: boolean;
}

const MOTIVO_SEM_RECEBIMENTO =
  "sem recebimento: na 1ª rodada, etapa 2, cada jogador só ataca, desloca e recebe cartas " +
  "(WARII.md §5.1); exércitos e bombardeiros foram recebidos na etapa 1";

const inexistente = () => new ErroDeLobby(404, "PARTIDA_INEXISTENTE", "partida inexistente");

function ehCriacao(acao: AcaoCriacao | Acao): acao is AcaoCriacao {
  return "participantes" in acao;
}

const instante = (d: Date) => d.toISOString().replace("T", " ").replace("Z", " UTC");

export async function gerarLogDetalhado(
  partidaId: string,
  usuarioId: string,
  admin: boolean,
): Promise<LogDetalhado> {
  const [partida] = await db.select().from(partidas).where(eq(partidas.id, partidaId));
  if (!partida || partida.status === "cancelada") throw inexistente();
  const lista = await db
    .select({
      id: participantes.usuarioId,
      nome: usuarios.nome,
      robo: usuarios.robo,
      assento: participantes.assento,
    })
    .from(participantes)
    .innerJoin(usuarios, eq(usuarios.id, participantes.usuarioId))
    .where(eq(participantes.partidaId, partidaId));
  const participa = lista.some((p) => p.id === usuarioId);
  if (!participa && !admin) throw inexistente();
  if (partida.status === "aguardando") {
    throw new ErroDeLobby(409, "PARTIDA_NAO_INICIADA", "a partida ainda não começou");
  }
  const linhas = await db
    .select()
    .from(acoesPartida)
    .where(eq(acoesPartida.partidaId, partidaId))
    .orderBy(asc(acoesPartida.seq));
  return escreverLogDetalhado({
    partida,
    pessoas: new Map(lista.map((p) => [p.id, { nome: p.nome, robo: p.robo }])),
    linhas,
    usuarioId,
    completo: admin || partida.status === "encerrada",
  });
}

export interface EntradaDoLog {
  partida: Pick<
    typeof partidas.$inferSelect,
    "id" | "nome" | "status" | "seq" | "vencedorId" | "criadaEm" | "iniciadaEm" | "encerradaEm"
  >;
  pessoas: ReadonlyMap<string, Pessoa>;
  linhas: readonly Pick<
    typeof acoesPartida.$inferSelect,
    "seq" | "usuarioId" | "tipo" | "acao" | "sorteios" | "criadaEm"
  >[];
  // Quem pediu (vale quando o log não é completo).
  usuarioId: string;
  completo: boolean;
}

// Monta o texto a partir do log gravado (sem banco: testável).
export function escreverLogDetalhado({
  partida,
  pessoas,
  linhas,
  usuarioId,
  completo,
}: EntradaDoLog): LogDetalhado {
  // Sem o log completo, tudo sai pela visão de quem pediu.
  const quem = completo ? null : usuarioId;
  const ver = (e: EstadoPartida) => (completo ? visaoCompleta(e) : visaoDoJogador(e, usuarioId));
  const nome = (id: string | null | undefined) =>
    id ? (pessoas.get(id)?.nome ?? `?${id.slice(0, 8)}`) : "—";

  const saida: string[] = [];
  const escrever = (...l: string[]) => saida.push(...l);
  // JSON com os ids dos jogadores trocados pelos nomes.
  const json = (valor: unknown) =>
    JSON.stringify(valor, (_chave, v: unknown) =>
      typeof v === "string" && pessoas.has(v) ? nome(v) : v,
    );

  escrever(
    "LOG DETALHADO DA PARTIDA — War II Online",
    "=".repeat(72),
    `Partida: ${partida.nome} (id ${partida.id})`,
    `Status: ${partida.status}${partida.vencedorId ? ` · vencedor: ${nome(partida.vencedorId)}` : ""}`,
    `Iniciada em: ${partida.iniciadaEm ? instante(partida.iniciadaEm) : "—"} · encerrada em: ${partida.encerradaEm ? instante(partida.encerradaEm) : "—"}`,
    `Gerado em: ${instante(new Date())} · ações no log: ${linhas.length} (seq 0 a ${partida.seq})`,
    completo
      ? "Visão: COMPLETA (mãos, objetivos e sorteios de todos)."
      : `Visão: de ${nome(usuarioId)} (partida em andamento: mãos e objetivos dos adversários e os sorteios ficam ocultos).`,
    "",
    "COMO LER",
    "- Cada bloco [seq N] é uma ação ACEITA pelo servidor, na ordem em que foi aplicada. Ações",
    "  recusadas não ficam no log. A ação seq 0 é a criação da partida (sorteios da preparação).",
    "- 'antes'/'depois' resumem o estado: rodada, etapa da 1ª rodada, de quem é a vez, a fase e as",
    "  pendências do turno (recebimento a colocar, ataque em curso, conquista pendente).",
    "- Os eventos saem no formato JSON do engine (packages/engine/src/regras/eventos.ts), com os ids",
    "  dos jogadores trocados pelos nomes. Territórios e continentes usam os ids do engine.",
    "- A cada início de vez há o bloco 'INÍCIO DA VEZ' com a mesa (territórios, exércitos, CEs,",
    "  bombardeiros, cartas) e o cálculo do recebimento do jogador da vez (WARII.md §6), com a posse",
    "  de cada continente e o mínimo para a maioria.",
    "- Fases: PREP_ESCOLHA_5J, PREP_OCUPACAO (preparação), RECEBER → ATACAR → DESLOCAR (a vez), FIM.",
    "",
  );

  let estado: EstadoPartida | null = null;
  for (const linha of linhas) {
    const rng = rngDeReplay(linha.sorteios);
    let resultado: Resultado;
    const antes = estado;
    if (linha.seq === 0) {
      if (linha.tipo !== TIPO_ACAO_CRIACAO || !ehCriacao(linha.acao)) {
        escrever(`[seq 0] ERRO: a primeira ação não é a criação da partida.`);
        break;
      }
      resultado = montarPartida(linha.acao, rng).resultado;
    } else {
      if (estado === null || linha.usuarioId === null || ehCriacao(linha.acao)) {
        escrever(
          `[seq ${linha.seq}] ERRO: ação sem estado anterior, sem jogador ou fora do lugar.`,
        );
        break;
      }
      resultado = aplicarAcao(estado, linha.usuarioId, linha.acao, rng);
    }

    const autor = linha.usuarioId
      ? `${nome(linha.usuarioId)} (${pessoas.get(linha.usuarioId)?.robo ? "robô" : "humano"})`
      : "sistema";
    escrever(
      "-".repeat(72),
      `[seq ${linha.seq}] ${instante(linha.criadaEm)} · ${autor} · ação ${linha.tipo}`,
    );
    if (linha.seq === 0 && ehCriacao(linha.acao)) {
      escrever(
        `  participantes (ordem de entrada): ${linha.acao.participantes.map((p) => `${nome(p.id)}=${p.cor}`).join(", ")}`,
        `  parâmetros: ${json(linha.acao.parametros)}`,
      );
    } else {
      escrever(`  ação: ${json(linha.acao)}`);
    }
    if (antes) escrever(`  antes: ${resumoDoTurno(ver(antes), nome)}`);
    if (completo)
      escrever(`  sorteios (${linha.sorteios.length}): ${JSON.stringify(linha.sorteios)}`);

    if (!resultado.ok) {
      escrever(
        `  ERRO NA REPETIÇÃO: ${resultado.erro.codigo} — ${resultado.erro.mensagem}`,
        "  (o log não pôde ser repetido daqui em diante)",
      );
      break;
    }
    if (rng.restantes() !== 0) {
      escrever(`  AVISO: ${rng.restantes()} sorteios gravados sobraram sem uso na repetição.`);
    }
    estado = resultado.estado;
    const visao = ver(estado);
    const eventos = completo ? resultado.eventos : eventosParaJogador(resultado.eventos, quem);
    escrever("  eventos:");
    for (const e of eventos) escrever(`    - ${e.tipo} ${json(semTipo(e))}`);
    if (eventos.length === 0) escrever("    (nenhum)");
    escrever(`  depois: ${resumoDoTurno(visao, nome)}`);

    if (linha.seq === 0) escrever(...mesa(visao, nome, quem, "SITUAÇÃO DEPOIS DA CRIAÇÃO"));
    const inicio = eventos.findLast((e) => e.tipo === "inicioDaVez");
    if (inicio?.tipo === "inicioDaVez") escrever(...inicioDaVez(estado, visao, inicio, nome, quem));
  }

  if (estado) {
    escrever("", "=".repeat(72));
    escrever(...mesa(ver(estado), nome, quem, "SITUAÇÃO FINAL (última ação do log)"));
  }

  const data = (partida.iniciadaEm ?? partida.criadaEm).toISOString().slice(0, 10);
  const base = partida.nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return {
    nomeArquivo: `warii-log-${base || "partida"}-${data}.txt`,
    texto: `${saida.join("\n")}\n`,
  };
}

// Visão com as mãos e os objetivos de todos (log completo).
function visaoCompleta(estado: EstadoPartida): VisaoPartida {
  const v = visaoDoJogador(estado, null);
  return {
    ...v,
    jogadores: v.jogadores.map((j, i) => {
      const e = estado.jogadores[i];
      return e
        ? {
            ...j,
            cartas: [...e.cartas],
            objetivoId: e.objetivoId,
            objetivoOriginalId: e.objetivoOriginalId,
          }
        : j;
    }),
  };
}

function semTipo(e: Evento): Record<string, unknown> {
  const { tipo: _tipo, ...resto } = e;
  return resto;
}

function resumoDoTurno(v: VisaoPartida, nome: (id: string | null) => string): string {
  const daVez = v.jogadores[v.vez]?.id ?? null;
  const partes = [
    `rodada ${v.rodada}${v.etapaPrimeiraRodada ? ` (etapa ${v.etapaPrimeiraRodada} da 1ª rodada)` : ""}`,
    `vez de ${nome(daVez)}`,
    `fase ${v.fase}`,
  ];
  const t = v.turno;
  if (t.recebimento) {
    partes.push(
      `a colocar ${pendenteDeRecebimento(t.recebimento)} (livres ${t.recebimento.livres}, por continente ${JSON.stringify(t.recebimento.porContinente)})`,
    );
  }
  if (t.conflitoTerrestre) {
    partes.push(`conflito terrestre ${t.conflitoTerrestre.origem}→${t.conflitoTerrestre.alvo}`);
  }
  if (t.ataqueTerrestre) {
    partes.push(
      `aguardando defesa de ${nome(t.ataqueTerrestre.defensor)} (ataque ${t.ataqueTerrestre.dadosAtaque.join(",")})`,
    );
  }
  if (t.ataqueAereo) {
    partes.push(
      `ataque aéreo sobre ${t.ataqueAereo.alvo} (etapa ${t.ataqueAereo.etapa}, ${t.ataqueAereo.emCombate} em combate)`,
    );
  }
  if (t.conquistaPendente) {
    partes.push(
      `conquista pendente ${t.conquistaPendente.origem}→${t.conquistaPendente.alvo} (até ${t.conquistaPendente.maximo})`,
    );
  }
  if (t.conquistou) partes.push("já conquistou nesta vez");
  return partes.join(" · ");
}

function inicioDaVez(
  estado: EstadoPartida,
  visao: VisaoPartida,
  e: Extract<Evento, { tipo: "inicioDaVez" }>,
  nome: (id: string | null) => string,
  quem: string | null,
): string[] {
  const r: string[] = [
    "",
    `  >>> INÍCIO DA VEZ: ${nome(e.jogador)} · rodada ${e.rodada}${e.etapaPrimeiraRodada ? ` · etapa ${e.etapaPrimeiraRodada} da 1ª rodada` : ""} · começa na fase ${e.fase}`,
  ];
  // O cálculo usa só a posse dos territórios: o +1 de cada CE, já colocado, não o altera.
  const calculo = calcularRecebimento(estado, e.jogador);
  const recebe = e.fase === "RECEBER";
  r.push(
    recebe
      ? `      motivo da fase: turno normal (WARII.md §5.2), começa recebendo.`
      : `      motivo da fase: ${e.rodada === 1 && e.etapaPrimeiraRodada === 2 ? MOTIVO_SEM_RECEBIMENTO : "fase inicial fora do recebimento"}.`,
    `      recebimento ${recebe ? "aplicado" : "que valeria (NÃO aplicado nesta vez)"}: total ${calculo.total} = livres ${calculo.livres} + continentes ${JSON.stringify(calculo.porContinente)} + CEs ${calculo.centros.length}; bombardeiros devidos ${calculo.bombardeiros}`,
    `      livres = max(mínimo ${estado.parametros.minimoRecebimento}, floor(${calculo.territorios} territórios / 2))`,
    `      posse por continente de ${nome(e.jogador)} (mínimo para a maioria · bônus maioria/totalidade da partida):`,
  );
  for (const c of IDS_CONTINENTES) {
    const ts = territoriosDoContinente(c);
    const meus = ts.filter((t) => estado.territorios[t].dono === e.jogador).length;
    const bonus = estado.parametros.bonusContinentes[c];
    const situacao =
      meus === ts.length
        ? "TOTALIDADE"
        : meus >= CONTINENTES[c].maioriaMinima
          ? "MAIORIA"
          : `sem bônus (faltam ${CONTINENTES[c].maioriaMinima - meus} para a maioria)`;
    r.push(
      `        ${c} ${CONTINENTES[c].nome}: ${meus}/${ts.length} · maioria a partir de ${CONTINENTES[c].maioriaMinima} · bônus ${bonus.maioria}/${bonus.totalidade} → ${situacao}`,
    );
  }
  r.push(...mesa(visao, nome, quem, "MESA NO INÍCIO DA VEZ").map((l) => (l ? `    ${l}` : l)));
  return r;
}

function mesa(
  v: VisaoPartida,
  nome: (id: string | null) => string,
  quem: string | null,
  titulo: string,
): string[] {
  const r = ["", `  ${titulo}`];
  r.push(
    `    monte: ${v.quantidadeMonte} cartas · descarte: ${v.descarte.length} [${v.descarte.join(", ")}]`,
  );
  v.jogadores.forEach((j, i) => {
    const ts = IDS_TERRITORIOS.filter((t) => v.territorios[t].dono === j.id);
    const exercitos = ts.reduce((s, t) => s + v.territorios[t].exercitos, 0);
    const ces = ts.filter((t) => territorio(t).centroEstrategico);
    const marcas = [
      i === v.vez ? "da vez" : null,
      i === v.primeiroJogador ? "abre as rodadas" : null,
      i === v.distribuidor ? "distribuidor" : null,
      j.eliminado ? `ELIMINADO por ${nome(j.eliminadoPor)}` : null,
    ].filter((m) => m !== null);
    r.push(
      `    [${i}] ${nome(j.id)} (${j.cor})${marcas.length ? ` · ${marcas.join(", ")}` : ""}: ${ts.length} territórios, ${exercitos} exércitos, CEs [${ces.join(", ")}], bombardeiros base ${j.bombardeirosBase}/caixa ${j.bombardeirosCaixa}, ${j.quantidadeCartas} cartas`,
    );
    if (j.cartas) {
      r.push(
        `        cartas: ${j.cartas.map((c) => `${c} (${cartaDeTroca(c)?.nome ?? "?"})`).join(", ") || "nenhuma"}`,
      );
    }
    if (j.objetivoId) {
      const troca = j.objetivoOriginalId && j.objetivoOriginalId !== j.objetivoId;
      r.push(
        `        objetivo: ${j.objetivoId} — ${objetivo(j.objetivoId)?.texto ?? "?"}${troca ? ` (sorteado: ${j.objetivoOriginalId})` : ""}`,
      );
    } else if (quem === null && v.fase !== "PREP_ESCOLHA_5J" && v.fase !== "PREP_OCUPACAO") {
      r.push("        objetivo: (ainda não sorteado)");
    }
  });
  r.push("    territórios (id: dono exércitos [+chegaram na vez]):");
  for (const c of IDS_CONTINENTES) {
    const ts = territoriosDoContinente(c).map((t) => {
      const e = v.territorios[t];
      const ce = territorio(t).centroEstrategico ? "*" : "";
      const chegaram = e.chegaramNoTurno > 0 ? ` +${e.chegaramNoTurno}` : "";
      return `${t}${ce}: ${nome(e.dono)} ${e.exercitos}${chegaram}`;
    });
    r.push(`      ${c}: ${ts.join(" | ")}`);
  }
  r.push("      (* = centro estratégico)");
  return r;
}
