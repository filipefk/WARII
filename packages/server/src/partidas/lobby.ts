// Lobby das partidas: criar, convidar, entrar, escolher cor, configurar e iniciar.
// Toda operação que altera uma partida roda numa transação com a linha dela travada (FOR UPDATE),
// então pedidos simultâneos (duas pessoas pegando a mesma cor, entrando na última vaga) se
// serializam. Quem não participa da partida recebe "inexistente", para não revelar que ela existe.
import {
  type CorId,
  gravarRng,
  IDS_CORES,
  MAXIMO_JOGADORES,
  MINIMO_JOGADORES,
  PARAMETROS_PADRAO,
  type Parametros,
  validarParametros,
} from "@warii/engine";
import {
  esquemaParametros,
  type ParametrosParciaisEntrada,
  type PartidaLobbyDto,
  type ConviteDto,
  type PartidaResumoDto,
  type StatusPartida,
  type UsuarioResumoDto,
} from "@warii/shared";
import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { gerarToken } from "../auth/tokens.js";
import { config } from "../config.js";
import { db, type Executor, type Transacao } from "../db/index.js";
import { acoesPartida, partidas, participantes, snapshots, usuarios } from "../db/schema.js";
import { registrarPartidaCriada, registrarPartidaIniciada } from "../logUsuarios.js";
import { type AcaoCriacao, montarPartida, TIPO_ACAO_CRIACAO } from "./inicio.js";
import { ehRobo, garantirRobos } from "./robos.js";
import { rngCrypto } from "./rng.js";

// Partidas aguardando jogadores que um mesmo anfitrião pode ter ao mesmo tempo.
export const LIMITE_PARTIDAS_AGUARDANDO = 5;

// Página do front (etapa 8) que lê o token do fragmento e chama POST /api/partidas/entrar.
const CAMINHO_CONVITE = "/convite";

export class ErroDeLobby extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDeLobby";
  }
}

// Parâmetros gravados no lobby completados com os padrões dos que foram criados depois.
// Parâmetros que saíram do engine mas ainda estão gravados em partidas antigas: somem ao juntar,
// senão o esquema estrito recusa a configuração de uma partida aguardando.
const PARAMETROS_REMOVIDOS = ["cincoJogadoresRestricaoManual"];

function parametrosAtuais(gravados: Parametros): Parametros {
  const juntos: Parametros = { ...PARAMETROS_PADRAO, ...gravados };
  for (const chave of PARAMETROS_REMOVIDOS) Reflect.deleteProperty(juntos, chave);
  return juntos;
}

const partidaInexistente = () => new ErroDeLobby(404, "PARTIDA_INEXISTENTE", "partida inexistente");

type LinhaPartida = typeof partidas.$inferSelect;
type LinhaParticipante = typeof participantes.$inferSelect;

interface PartidaTravada {
  partida: LinhaPartida;
  participantes: LinhaParticipante[];
}

export function linkDoConvite(token: string): string {
  return `${config.URL_PUBLICA}${CAMINHO_CONVITE}#token=${token}`;
}

async function travarPartida(tx: Transacao, partidaId: string): Promise<PartidaTravada> {
  const [partida] = await tx
    .select()
    .from(partidas)
    .where(eq(partidas.id, partidaId))
    .for("update");
  if (!partida) throw partidaInexistente();
  const lista = await tx
    .select()
    .from(participantes)
    .where(eq(participantes.partidaId, partidaId))
    .orderBy(asc(participantes.entrouEm), asc(participantes.usuarioId));
  return { partida, participantes: lista };
}

// Trava a partida e confere que o usuário participa dela.
async function travarComoParticipante(
  tx: Transacao,
  partidaId: string,
  usuarioId: string,
): Promise<PartidaTravada> {
  const travada = await travarPartida(tx, partidaId);
  if (!travada.participantes.some((p) => p.usuarioId === usuarioId)) throw partidaInexistente();
  return travada;
}

function exigirAnfitriao({ partida }: PartidaTravada, usuarioId: string): void {
  if (partida.anfitriaoId !== usuarioId) {
    throw new ErroDeLobby(403, "SOMENTE_ANFITRIAO", "só o anfitrião pode fazer isso");
  }
}

function exigirAguardando({ partida }: PartidaTravada): void {
  if (partida.status !== "aguardando") {
    throw new ErroDeLobby(
      409,
      "PARTIDA_JA_INICIADA",
      "a partida não está mais aguardando jogadores",
    );
  }
}

async function tocar(tx: Transacao, partidaId: string): Promise<void> {
  await tx.update(partidas).set({ atualizadaEm: new Date() }).where(eq(partidas.id, partidaId));
}

// ---- Leitura (DTOs) ----

function resumo(
  partida: LinhaPartida,
  anfitriao: UsuarioResumoDto,
  quantidadeParticipantes: number,
): PartidaResumoDto {
  return {
    id: partida.id,
    nome: partida.nome,
    status: partida.status,
    anfitriao,
    quantidadeParticipantes,
    criadaEm: partida.criadaEm.toISOString(),
    iniciadaEm: partida.iniciadaEm?.toISOString() ?? null,
  };
}

async function montarLobby(
  executor: Executor,
  partidaId: string,
  usuarioId: string,
): Promise<PartidaLobbyDto> {
  const [partida] = await executor.select().from(partidas).where(eq(partidas.id, partidaId));
  if (!partida) throw partidaInexistente();
  const lista = await executor
    .select({
      usuarioId: participantes.usuarioId,
      nome: usuarios.nome,
      avatar: usuarios.avatarVersao,
      robo: usuarios.robo,
      cor: participantes.cor,
      assento: participantes.assento,
    })
    .from(participantes)
    .innerJoin(usuarios, eq(usuarios.id, participantes.usuarioId))
    .where(eq(participantes.partidaId, partidaId))
    .orderBy(asc(participantes.entrouEm), asc(participantes.usuarioId));
  if (!lista.some((p) => p.usuarioId === usuarioId)) throw partidaInexistente();

  const anfitriao = lista.find((p) => p.usuarioId === partida.anfitriaoId);
  const ehAnfitriao = partida.anfitriaoId === usuarioId;
  return {
    ...resumo(
      partida,
      { id: partida.anfitriaoId, nome: anfitriao?.nome ?? "", avatar: anfitriao?.avatar ?? null },
      lista.length,
    ),
    participantes: lista
      .map((p) => ({
        usuarioId: p.usuarioId,
        nome: p.nome,
        avatar: p.avatar,
        cor: p.cor,
        assento: p.assento,
        anfitriao: p.usuarioId === partida.anfitriaoId,
        robo: p.robo,
      }))
      // Depois de iniciar, na ordem da mesa; antes, na ordem de entrada.
      .toSorted((a, b) => (a.assento ?? 0) - (b.assento ?? 0)),
    // Depois de iniciar, os que a partida usa (os antigos não têm os parâmetros criados depois).
    parametros:
      partida.status === "aguardando" ? parametrosAtuais(partida.parametros) : partida.parametros,
    convite:
      ehAnfitriao && partida.status === "aguardando" && partida.convite
        ? linkDoConvite(partida.convite)
        : null,
  };
}

export function obterLobby(partidaId: string, usuarioId: string): Promise<PartidaLobbyDto> {
  return montarLobby(db, partidaId, usuarioId);
}

// Partidas de que o usuário participa (sem as canceladas), das mais recentes para as mais antigas.
export async function listarPartidas(usuarioId: string): Promise<PartidaResumoDto[]> {
  const minhas = db
    .select({ id: participantes.partidaId })
    .from(participantes)
    .where(eq(participantes.usuarioId, usuarioId));
  const linhas = await db
    .select({
      partida: partidas,
      anfitriaoNome: usuarios.nome,
      anfitriaoAvatar: usuarios.avatarVersao,
    })
    .from(partidas)
    .innerJoin(usuarios, eq(usuarios.id, partidas.anfitriaoId))
    .where(and(inArray(partidas.id, minhas), ne(partidas.status, "cancelada")))
    .orderBy(desc(partidas.criadaEm));
  if (linhas.length === 0) return [];

  const contagens = await db
    .select({ partidaId: participantes.partidaId, total: count() })
    .from(participantes)
    .where(
      inArray(
        participantes.partidaId,
        linhas.map((l) => l.partida.id),
      ),
    )
    .groupBy(participantes.partidaId);
  const totalPor = new Map(contagens.map((c) => [c.partidaId, c.total]));
  return linhas.map(({ partida, anfitriaoNome, anfitriaoAvatar }) =>
    resumo(
      partida,
      { id: partida.anfitriaoId, nome: anfitriaoNome, avatar: anfitriaoAvatar },
      totalPor.get(partida.id) ?? 0,
    ),
  );
}

// ---- Alterações ----

export async function criarPartidaNoLobby(
  anfitriaoId: string,
  nome: string,
): Promise<PartidaLobbyDto> {
  return db.transaction(async (tx) => {
    // Trava o usuário para a contagem abaixo valer com pedidos simultâneos.
    await tx
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.id, anfitriaoId))
      .for("update");
    const [aguardando] = await tx
      .select({ total: count() })
      .from(partidas)
      .where(and(eq(partidas.anfitriaoId, anfitriaoId), eq(partidas.status, "aguardando")));
    if ((aguardando?.total ?? 0) >= LIMITE_PARTIDAS_AGUARDANDO) {
      throw new ErroDeLobby(
        409,
        "LIMITE_DE_PARTIDAS",
        `você já tem ${LIMITE_PARTIDAS_AGUARDANDO} partidas aguardando jogadores`,
      );
    }
    const [criada] = await tx
      .insert(partidas)
      .values({ nome, anfitriaoId, parametros: PARAMETROS_PADRAO, convite: gerarToken() })
      .returning({ id: partidas.id });
    if (!criada) throw new Error("INSERT da partida não devolveu linha");
    await tx.insert(participantes).values({ partidaId: criada.id, usuarioId: anfitriaoId });
    await registrarPartidaCriada(anfitriaoId, { id: criada.id, nome }, tx);
    return montarLobby(tx, criada.id, anfitriaoId);
  });
}

export async function entrarComConvite(usuarioId: string, token: string): Promise<PartidaLobbyDto> {
  return db.transaction(async (tx) => {
    const [alvo] = await tx
      .select({ id: partidas.id })
      .from(partidas)
      .where(and(eq(partidas.convite, token), eq(partidas.status, "aguardando")));
    const conviteInvalido = new ErroDeLobby(
      404,
      "CONVITE_INVALIDO",
      "convite inválido ou expirado",
    );
    if (!alvo) throw conviteInvalido;
    const travada = await travarPartida(tx, alvo.id);
    // Conferido de novo com a linha travada: o convite pode ter mudado entre as duas leituras.
    if (travada.partida.convite !== token || travada.partida.status !== "aguardando") {
      throw conviteInvalido;
    }
    if (!travada.participantes.some((p) => p.usuarioId === usuarioId)) {
      if (travada.participantes.length >= MAXIMO_JOGADORES) {
        throw new ErroDeLobby(
          409,
          "PARTIDA_CHEIA",
          `a partida já tem ${MAXIMO_JOGADORES} jogadores`,
        );
      }
      await tx.insert(participantes).values({ partidaId: alvo.id, usuarioId });
      await tocar(tx, alvo.id);
    }
    return montarLobby(tx, alvo.id, usuarioId);
  });
}

// A cor é escolhida pelo próprio jogador; a de um robô, pelo anfitrião (`alvoId`).
export async function escolherCor(
  partidaId: string,
  usuarioId: string,
  cor: CorId,
  alvoId = usuarioId,
): Promise<PartidaLobbyDto> {
  return db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, usuarioId);
    exigirAguardando(travada);
    if (alvoId !== usuarioId) {
      exigirAnfitriao(travada, usuarioId);
      if (!travada.participantes.some((p) => p.usuarioId === alvoId)) {
        throw new ErroDeLobby(404, "PARTICIPANTE_INEXISTENTE", "esse jogador não está na partida");
      }
      if (!(await ehRobo(tx, alvoId))) {
        throw new ErroDeLobby(
          403,
          "SOMENTE_ROBO",
          "só a cor de um robô é escolhida pelo anfitrião",
        );
      }
    }
    if (travada.participantes.some((p) => p.cor === cor && p.usuarioId !== alvoId)) {
      throw new ErroDeLobby(409, "COR_OCUPADA", "outro jogador já escolheu essa cor");
    }
    await tx
      .update(participantes)
      .set({ cor })
      .where(and(eq(participantes.partidaId, partidaId), eq(participantes.usuarioId, alvoId)));
    await tocar(tx, partidaId);
    return montarLobby(tx, partidaId, usuarioId);
  });
}

// Põe na partida o primeiro robô do grupo que ainda não está nela, já com a primeira cor livre.
export async function adicionarRobo(
  partidaId: string,
  anfitriaoId: string,
): Promise<{ lobby: PartidaLobbyDto; roboId: string }> {
  return db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, anfitriaoId);
    exigirAnfitriao(travada, anfitriaoId);
    exigirAguardando(travada);
    if (travada.participantes.length >= MAXIMO_JOGADORES) {
      throw new ErroDeLobby(409, "PARTIDA_CHEIA", `a partida já tem ${MAXIMO_JOGADORES} jogadores`);
    }
    const presentes = new Set(travada.participantes.map((p) => p.usuarioId));
    const roboId = (await garantirRobos(tx)).find((id) => !presentes.has(id));
    if (roboId === undefined) {
      throw new ErroDeLobby(409, "SEM_ROBOS", "não há mais robôs disponíveis");
    }
    const ocupadas = new Set(travada.participantes.map((p) => p.cor));
    const cor = IDS_CORES.find((c) => !ocupadas.has(c)) ?? null;
    await tx.insert(participantes).values({ partidaId, usuarioId: roboId, cor });
    await tocar(tx, partidaId);
    return { lobby: await montarLobby(tx, partidaId, anfitriaoId), roboId };
  });
}

export async function configurarParametros(
  partidaId: string,
  usuarioId: string,
  alteracoes: ParametrosParciaisEntrada,
): Promise<PartidaLobbyDto> {
  return db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, usuarioId);
    exigirAnfitriao(travada, usuarioId);
    exigirAguardando(travada);
    const juntos = esquemaParametros.safeParse({
      ...parametrosAtuais(travada.partida.parametros),
      ...alteracoes,
    });
    const erros = juntos.success
      ? validarParametros(juntos.data)
      : juntos.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    if (!juntos.success || erros.length > 0) {
      throw new ErroDeLobby(
        400,
        "PARAMETROS_INVALIDOS",
        `parâmetros inválidos: ${erros.join("; ")}`,
      );
    }
    const parametros: Parametros = juntos.data;
    await tx
      .update(partidas)
      .set({ parametros, atualizadaEm: new Date() })
      .where(eq(partidas.id, partidaId));
    return montarLobby(tx, partidaId, usuarioId);
  });
}

// Gera outro link de convite; o anterior deixa de valer (quem já entrou continua na partida).
export async function renovarConvite(
  partidaId: string,
  usuarioId: string,
): Promise<PartidaLobbyDto> {
  return db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, usuarioId);
    exigirAnfitriao(travada, usuarioId);
    exigirAguardando(travada);
    await tx
      .update(partidas)
      .set({ convite: gerarToken(), atualizadaEm: new Date() })
      .where(eq(partidas.id, partidaId));
    return montarLobby(tx, partidaId, usuarioId);
  });
}

// Usuários que o anfitrião pode chamar para a sala de espera, entre os `online` (ids com alguma
// conexão aberta, vindos do socket): humanos ainda fora da partida, por nome.
export async function convidaveis(
  partidaId: string,
  anfitriaoId: string,
  online: string[],
): Promise<UsuarioResumoDto[]> {
  return db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, anfitriaoId);
    exigirAnfitriao(travada, anfitriaoId);
    exigirAguardando(travada);
    const dentro = new Set(travada.participantes.map((p) => p.usuarioId));
    const candidatos = online.filter((id) => !dentro.has(id));
    if (candidatos.length === 0) return [];
    return tx
      .select({ id: usuarios.id, nome: usuarios.nome, avatar: usuarios.avatarVersao })
      .from(usuarios)
      .where(and(inArray(usuarios.id, candidatos), eq(usuarios.robo, false)))
      .orderBy(asc(usuarios.nome));
  });
}

// Convite direto do anfitrião a um usuário: leva o token do link de convite, com que o convidado
// entra (entrarComConvite). Não grava nada: é o mesmo que mandar o link.
export async function montarConvite(
  partidaId: string,
  anfitriaoId: string,
  convidadoId: string,
): Promise<ConviteDto> {
  return db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, anfitriaoId);
    exigirAnfitriao(travada, anfitriaoId);
    exigirAguardando(travada);
    const { partida } = travada;
    if (travada.participantes.some((p) => p.usuarioId === convidadoId)) {
      throw new ErroDeLobby(409, "JA_NA_PARTIDA", "esse jogador já está na partida");
    }
    if (travada.participantes.length >= MAXIMO_JOGADORES) {
      throw new ErroDeLobby(409, "PARTIDA_CHEIA", `a partida já tem ${MAXIMO_JOGADORES} jogadores`);
    }
    const [convidado] = await tx
      .select({ robo: usuarios.robo })
      .from(usuarios)
      .where(eq(usuarios.id, convidadoId));
    if (!convidado || convidado.robo) {
      throw new ErroDeLobby(404, "USUARIO_INEXISTENTE", "usuário inexistente");
    }
    const [anfitriao] = await tx
      .select({ id: usuarios.id, nome: usuarios.nome, avatar: usuarios.avatarVersao })
      .from(usuarios)
      .where(eq(usuarios.id, anfitriaoId));
    if (!anfitriao || !partida.convite) throw partidaInexistente();
    return { partidaId, partidaNome: partida.nome, anfitriao, token: partida.convite };
  });
}

export async function sairDaPartida(partidaId: string, usuarioId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, usuarioId);
    exigirAguardando(travada);
    if (travada.partida.anfitriaoId === usuarioId) {
      throw new ErroDeLobby(
        409,
        "ANFITRIAO_NAO_SAI",
        "o anfitrião não sai da partida; cancele-a se não for jogar",
      );
    }
    await removerParticipante(tx, partidaId, usuarioId);
  });
}

export async function removerDaPartida(
  partidaId: string,
  anfitriaoId: string,
  alvoId: string,
): Promise<PartidaLobbyDto> {
  return db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, anfitriaoId);
    exigirAnfitriao(travada, anfitriaoId);
    exigirAguardando(travada);
    if (alvoId === anfitriaoId) {
      throw new ErroDeLobby(409, "ANFITRIAO_NAO_SAI", "o anfitrião não pode remover a si mesmo");
    }
    if (!travada.participantes.some((p) => p.usuarioId === alvoId)) {
      throw new ErroDeLobby(404, "PARTICIPANTE_INEXISTENTE", "esse jogador não está na partida");
    }
    await removerParticipante(tx, partidaId, alvoId);
    return montarLobby(tx, partidaId, anfitriaoId);
  });
}

async function removerParticipante(tx: Transacao, partidaId: string, usuarioId: string) {
  await tx
    .delete(participantes)
    .where(and(eq(participantes.partidaId, partidaId), eq(participantes.usuarioId, usuarioId)));
  await tocar(tx, partidaId);
}

// Partidas não são apagadas: a cancelada sai das listas e o convite deixa de valer.
export async function cancelarPartida(partidaId: string, usuarioId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, usuarioId);
    exigirAnfitriao(travada, usuarioId);
    exigirAguardando(travada);
    await tx
      .update(partidas)
      .set({ status: "cancelada" satisfies StatusPartida, convite: null, atualizadaEm: new Date() })
      .where(eq(partidas.id, partidaId));
  });
}

// Sorteia a ordem da mesa, cria o estado no engine e grava a ação seq 0 (com os sorteios, para o
// replay) e o snapshot seq 0. A partir daqui as ações seguem pelo socket (etapa 7).
export async function iniciarPartida(
  partidaId: string,
  usuarioId: string,
): Promise<PartidaLobbyDto> {
  return db.transaction(async (tx) => {
    const travada = await travarComoParticipante(tx, partidaId, usuarioId);
    exigirAnfitriao(travada, usuarioId);
    exigirAguardando(travada);
    const lista = travada.participantes;
    if (lista.length < MINIMO_JOGADORES || lista.length > MAXIMO_JOGADORES) {
      throw new ErroDeLobby(
        409,
        "JOGADORES_INSUFICIENTES",
        `a partida precisa de ${MINIMO_JOGADORES} a ${MAXIMO_JOGADORES} jogadores`,
      );
    }
    const comCor: { id: string; cor: CorId }[] = [];
    for (const p of lista) {
      if (p.cor === null) {
        throw new ErroDeLobby(409, "COR_PENDENTE", "todos os jogadores precisam escolher uma cor");
      }
      comCor.push({ id: p.usuarioId, cor: p.cor });
    }

    const criacao: AcaoCriacao = {
      participantes: comCor,
      parametros: parametrosAtuais(travada.partida.parametros),
    };
    const { rng, sorteios } = gravarRng(rngCrypto());
    const { jogadores, resultado } = montarPartida(criacao, rng);
    if (!resultado.ok) {
      throw new ErroDeLobby(400, resultado.erro.codigo, resultado.erro.mensagem);
    }

    for (const [assento, jogador] of jogadores.entries()) {
      await tx
        .update(participantes)
        .set({ assento })
        .where(
          and(eq(participantes.partidaId, partidaId), eq(participantes.usuarioId, jogador.id)),
        );
    }
    await tx.insert(acoesPartida).values({
      partidaId,
      seq: 0,
      usuarioId: null,
      tipo: TIPO_ACAO_CRIACAO,
      acao: criacao,
      sorteios,
    });
    await tx.insert(snapshots).values({ partidaId, seq: 0, estado: resultado.estado });
    const agora = new Date();
    await tx
      .update(partidas)
      .set({
        status: "em_andamento" satisfies StatusPartida,
        seq: 0,
        convite: null,
        iniciadaEm: agora,
        atualizadaEm: agora,
      })
      .where(eq(partidas.id, partidaId));
    await registrarPartidaIniciada(
      { id: partidaId, nome: travada.partida.nome },
      jogadores.map((j) => j.id),
      tx,
    );
    return montarLobby(tx, partidaId, usuarioId);
  });
}
