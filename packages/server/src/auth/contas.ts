// Contas de usuário. Não há cadastro público: o administrador cria a conta pela tela de usuários
// (admin/usuarios.ts) ou pela CLI (src/cli.ts), que dão um link de ativação; o próprio usuário
// define a senha por esse link. A recuperação de senha usa o mesmo mecanismo (link de
// redefinição), sem envio de e-mail; o administrador também pode definir a senha direto.
import { and, eq, gt, isNull, type SQL } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { type FinalidadeTokenSenha, tokensSenha, usuarios } from "../db/schema.js";
import { gerarHashSenha, obterHashFicticio, verificarSenha } from "./senha.js";
import { criarSessao, type OrigemDaSessao, revogarSessoesDoUsuario } from "./sessoes.js";
import { formatoDeTokenValido, gerarToken, hashDoToken } from "./tokens.js";

const VALIDADE_LINK_MS: Record<FinalidadeTokenSenha, number> = {
  ativacao: 72 * 60 * 60 * 1000,
  redefinicao: 60 * 60 * 1000,
};

// Página do front (etapa 8) que lê o token do fragmento e chama POST /api/auth/senha/definir.
// O token vai no fragmento (#) para não chegar ao servidor web, aos logs nem ao Referer.
const CAMINHO_DEFINIR_SENHA = "/definir-senha";

export class ErroDeConta extends Error {
  constructor(
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDeConta";
  }
}

export interface Conta {
  id: string;
  email: string;
  nome: string;
  admin: boolean;
}

// Domínio dos e-mails das contas-robô (partidas/robos.ts).
export const DOMINIO_ROBOS = "@robos.invalid";

export const COLUNAS_CONTA = {
  id: usuarios.id,
  email: usuarios.email,
  nome: usuarios.nome,
  admin: usuarios.admin,
};

export function emailReservado(email: string): boolean {
  return email.toLowerCase().endsWith(DOMINIO_ROBOS);
}

export async function criarConta(email: string, nome: string, admin = false): Promise<Conta> {
  if (emailReservado(email)) {
    throw new ErroDeConta("EMAIL_RESERVADO", `e-mails ${DOMINIO_ROBOS} são reservados aos robôs`);
  }
  const [criada] = await db
    .insert(usuarios)
    .values({ email, nome, admin })
    .onConflictDoNothing({ target: usuarios.email })
    .returning(COLUNAS_CONTA);
  if (!criada) throw new ErroDeConta("EMAIL_EM_USO", `já existe uma conta com o e-mail ${email}`);
  return criada;
}

export interface LinkSenha {
  link: string;
  expiraEm: Date;
  conta: Conta;
  finalidade: FinalidadeTokenSenha;
}

// Gera um link de uso único e invalida os links anteriores ainda não usados do mesmo usuário.
// Sem finalidade: de ativação se a conta ainda não tem senha, senão de redefinição.
export function gerarLinkSenha(
  email: string,
  finalidade?: FinalidadeTokenSenha,
): Promise<LinkSenha> {
  return gerarLink(eq(usuarios.email, email), finalidade, `nenhuma conta com o e-mail ${email}`);
}

// Pela tela de administração: de ativação se a conta ainda não tem senha, senão de redefinição.
export function gerarLinkSenhaPorId(usuarioId: string): Promise<LinkSenha> {
  return gerarLink(eq(usuarios.id, usuarioId), undefined, "usuário inexistente");
}

async function gerarLink(
  filtro: SQL,
  pedida: FinalidadeTokenSenha | undefined,
  inexistente: string,
): Promise<LinkSenha> {
  const [linha] = await db
    .select({ ...COLUNAS_CONTA, robo: usuarios.robo, senhaHash: usuarios.senhaHash })
    .from(usuarios)
    .where(filtro)
    .limit(1);
  if (!linha) throw new ErroDeConta("CONTA_INEXISTENTE", inexistente);
  const { robo, senhaHash, ...conta } = linha;
  const finalidade = pedida ?? (senhaHash === null ? "ativacao" : "redefinicao");
  if (robo) throw new ErroDeConta("CONTA_ROBO", "contas-robô não têm senha");

  const token = gerarToken();
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + VALIDADE_LINK_MS[finalidade]);
  await db.transaction(async (tx) => {
    await tx
      .update(tokensSenha)
      .set({ usadoEm: agora })
      .where(and(eq(tokensSenha.usuarioId, conta.id), isNull(tokensSenha.usadoEm)));
    await tx
      .insert(tokensSenha)
      .values({ usuarioId: conta.id, tokenHash: hashDoToken(token), finalidade, expiraEm });
  });
  const link = `${config.URL_PUBLICA}${CAMINHO_DEFINIR_SENHA}#token=${token}`;
  return { link, expiraEm, conta, finalidade };
}

// Consome o link (uma vez só), grava a nova senha, revoga todas as sessões anteriores e abre uma nova.
export async function definirSenhaComToken(
  token: string,
  senha: string,
  origem: OrigemDaSessao,
): Promise<{ conta: Conta; token: string; expiraEm: Date }> {
  const linkInvalido = new ErroDeConta("LINK_INVALIDO", "link inválido ou expirado");
  if (!formatoDeTokenValido(token)) throw linkInvalido;
  const senhaHash = await gerarHashSenha(senha);
  const agora = new Date();

  return db.transaction(async (tx) => {
    // O UPDATE condicional é a trava: duas requisições com o mesmo link não passam as duas.
    const [usado] = await tx
      .update(tokensSenha)
      .set({ usadoEm: agora })
      .where(
        and(
          eq(tokensSenha.tokenHash, hashDoToken(token)),
          isNull(tokensSenha.usadoEm),
          gt(tokensSenha.expiraEm, agora),
        ),
      )
      .returning({ usuarioId: tokensSenha.usuarioId });
    if (!usado) throw linkInvalido;

    const [conta] = await tx
      .update(usuarios)
      .set({ senhaHash, atualizadoEm: agora })
      .where(eq(usuarios.id, usado.usuarioId))
      .returning(COLUNAS_CONTA);
    if (!conta) throw linkInvalido;

    await revogarSessoesDoUsuario(conta.id, undefined, tx);
    const sessao = await criarSessao(conta.id, origem, tx);
    return { conta, ...sessao };
  });
}

// Confere e-mail e senha. Sempre gasta um Argon2 (com hash fictício quando a conta não existe
// ou não foi ativada), para o tempo de resposta não revelar se o e-mail tem conta.
export async function autenticar(email: string, senha: string): Promise<Conta | undefined> {
  const [linha] = await db
    .select({ ...COLUNAS_CONTA, senhaHash: usuarios.senhaHash })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);
  const hash = linha?.senhaHash ?? (await obterHashFicticio());
  const confere = await verificarSenha(senha, hash);
  if (!linha?.senhaHash || !confere) return undefined;
  return { id: linha.id, email: linha.email, nome: linha.nome, admin: linha.admin };
}

// Troca a senha de quem está logado e revoga as outras sessões (a atual continua).
export async function trocarSenha(
  usuarioId: string,
  sessaoAtual: string,
  senhaAtual: string,
  novaSenha: string,
): Promise<boolean> {
  const [linha] = await db
    .select({ senhaHash: usuarios.senhaHash })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1);
  if (!linha?.senhaHash || !(await verificarSenha(senhaAtual, linha.senhaHash))) return false;
  const senhaHash = await gerarHashSenha(novaSenha);
  await db.transaction(async (tx) => {
    await tx
      .update(usuarios)
      .set({ senhaHash, atualizadoEm: new Date() })
      .where(eq(usuarios.id, usuarioId));
    await revogarSessoesDoUsuario(usuarioId, sessaoAtual, tx);
  });
  return true;
}

export async function listarContas(): Promise<
  { email: string; nome: string; ativa: boolean; robo: boolean; criadoEm: Date }[]
> {
  const linhas = await db
    .select({
      email: usuarios.email,
      nome: usuarios.nome,
      senhaHash: usuarios.senhaHash,
      robo: usuarios.robo,
      criadoEm: usuarios.criadoEm,
    })
    .from(usuarios)
    .orderBy(usuarios.criadoEm);
  return linhas.map(({ senhaHash, ...resto }) => ({ ...resto, ativa: senhaHash !== null }));
}
