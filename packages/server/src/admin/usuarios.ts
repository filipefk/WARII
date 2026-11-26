// Cadastro de usuários pelo administrador: listar, criar, editar, apagar, gerar o link de senha e
// definir a senha. As contas-robô ficam de fora (não aparecem e não podem ser alteradas).
// Proteções contra se trancar fora: o administrador não apaga a própria conta nem tira o próprio
// acesso de administrador.
import type { EditarUsuarioEntrada, UsuarioAdminDto } from "@warii/shared";
import { and, count, eq, isNull, or } from "drizzle-orm";
import {
  COLUNAS_CONTA,
  type Conta,
  criarConta,
  emailReservado,
  ErroDeConta,
} from "../auth/contas.js";
import { gerarHashSenha } from "../auth/senha.js";
import { revogarSessoesDoUsuario } from "../auth/sessoes.js";
import { db, type Executor, type Transacao } from "../db/index.js";
import { partidas, participantes, tokensSenha, usuarios } from "../db/schema.js";

export class ErroDeAdmin extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDeAdmin";
  }
}

const usuarioInexistente = () => new ErroDeAdmin(404, "USUARIO_INEXISTENTE", "usuário inexistente");

const emailEmUso = (email: string) =>
  new ErroDeAdmin(409, "EMAIL_EM_USO", `já existe uma conta com o e-mail ${email}`);

const emailReservadoErro = () =>
  new ErroDeAdmin(400, "EMAIL_RESERVADO", "e-mails @robos.invalid são reservados aos robôs");

// Violação de unicidade do Postgres (o e-mail é único, sem diferenciar maiúsculas).
function ehUnicidade(erro: unknown): boolean {
  const causa: unknown =
    typeof erro === "object" && erro !== null && "cause" in erro ? erro.cause : erro;
  return typeof causa === "object" && causa !== null && "code" in causa && causa.code === "23505";
}

async function travarUsuario(tx: Transacao, usuarioId: string) {
  const [linha] = await tx
    .select({ ...COLUNAS_CONTA, robo: usuarios.robo, senhaHash: usuarios.senhaHash })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .for("update");
  if (!linha || linha.robo) throw usuarioInexistente();
  return linha;
}

async function contarPartidas(executor: Executor, usuarioId: string) {
  const [linha] = await executor
    .select({ total: count() })
    .from(participantes)
    .where(eq(participantes.usuarioId, usuarioId));
  return linha?.total ?? 0;
}

export async function listarUsuarios(): Promise<UsuarioAdminDto[]> {
  const linhas = await db
    .select({
      ...COLUNAS_CONTA,
      senhaHash: usuarios.senhaHash,
      criadoEm: usuarios.criadoEm,
    })
    .from(usuarios)
    .where(eq(usuarios.robo, false))
    .orderBy(usuarios.nome);
  const contagens = await db
    .select({ usuarioId: participantes.usuarioId, total: count() })
    .from(participantes)
    .groupBy(participantes.usuarioId);
  const totalPor = new Map(contagens.map((c) => [c.usuarioId, c.total]));
  return linhas.map(({ senhaHash, criadoEm, ...conta }) => ({
    ...conta,
    ativa: senhaHash !== null,
    partidas: totalPor.get(conta.id) ?? 0,
    criadoEm: criadoEm.toISOString(),
  }));
}

export async function obterUsuario(usuarioId: string): Promise<UsuarioAdminDto> {
  const [linha] = await db
    .select({
      ...COLUNAS_CONTA,
      robo: usuarios.robo,
      senhaHash: usuarios.senhaHash,
      criadoEm: usuarios.criadoEm,
    })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId));
  if (!linha || linha.robo) throw usuarioInexistente();
  const { robo: _robo, senhaHash, criadoEm, ...conta } = linha;
  return {
    ...conta,
    ativa: senhaHash !== null,
    partidas: await contarPartidas(db, usuarioId),
    criadoEm: criadoEm.toISOString(),
  };
}

export async function criarUsuario(email: string, nome: string, admin: boolean): Promise<Conta> {
  try {
    return await criarConta(email, nome, admin);
  } catch (erro) {
    if (erro instanceof ErroDeConta) {
      if (erro.codigo === "EMAIL_RESERVADO") throw emailReservadoErro();
      throw emailEmUso(email);
    }
    throw erro;
  }
}

export async function editarUsuario(
  usuarioId: string,
  adminId: string,
  mudancas: EditarUsuarioEntrada,
): Promise<void> {
  if (mudancas.email !== undefined && emailReservado(mudancas.email)) throw emailReservadoErro();
  if (usuarioId === adminId && mudancas.admin === false) {
    throw new ErroDeAdmin(
      409,
      "PROPRIO_ADMIN",
      "você não pode tirar o seu próprio acesso de administrador",
    );
  }
  try {
    await db.transaction(async (tx) => {
      await travarUsuario(tx, usuarioId);
      await tx
        .update(usuarios)
        .set({ ...mudancas, atualizadoEm: new Date() })
        .where(eq(usuarios.id, usuarioId));
    });
  } catch (erro) {
    if (ehUnicidade(erro)) throw emailEmUso(mudancas.email ?? "");
    throw erro;
  }
}

// Só apaga quem nunca entrou numa partida (o log das partidas guarda os jogadores). Sessões e
// links de senha vão junto (ON DELETE CASCADE).
export async function apagarUsuario(usuarioId: string, adminId: string): Promise<void> {
  if (usuarioId === adminId) {
    throw new ErroDeAdmin(409, "PROPRIA_CONTA", "você não pode apagar a sua própria conta");
  }
  await db.transaction(async (tx) => {
    await travarUsuario(tx, usuarioId);
    const [anfitriao] = await tx
      .select({ total: count() })
      .from(partidas)
      .where(or(eq(partidas.anfitriaoId, usuarioId), eq(partidas.vencedorId, usuarioId)));
    if ((await contarPartidas(tx, usuarioId)) > 0 || (anfitriao?.total ?? 0) > 0) {
      throw new ErroDeAdmin(
        409,
        "USUARIO_COM_PARTIDAS",
        "o usuário tem partidas; apague-as antes de apagar a conta",
      );
    }
    await tx.delete(usuarios).where(eq(usuarios.id, usuarioId));
  });
}

// Grava a senha escolhida pelo administrador, invalida os links pendentes e encerra as sessões do
// usuário (menos a sessão atual, se o administrador trocou a própria senha).
export async function definirSenhaDoUsuario(
  usuarioId: string,
  senha: string,
  sessaoAtual: string | undefined,
): Promise<void> {
  const senhaHash = await gerarHashSenha(senha);
  const agora = new Date();
  await db.transaction(async (tx) => {
    await travarUsuario(tx, usuarioId);
    await tx
      .update(usuarios)
      .set({ senhaHash, atualizadoEm: agora })
      .where(eq(usuarios.id, usuarioId));
    await tx
      .update(tokensSenha)
      .set({ usadoEm: agora })
      .where(and(eq(tokensSenha.usuarioId, usuarioId), isNull(tokensSenha.usadoEm)));
    await revogarSessoesDoUsuario(usuarioId, sessaoAtual, tx);
  });
}

// Administradores que ainda não definiram a senha.
export async function adminsSemSenha(): Promise<string[]> {
  const linhas = await db
    .select({ email: usuarios.email })
    .from(usuarios)
    .where(and(eq(usuarios.admin, true), isNull(usuarios.senhaHash)));
  return linhas.map((l) => l.email);
}
