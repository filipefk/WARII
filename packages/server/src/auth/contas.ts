// Contas de usuário. Não há cadastro público: o administrador cria a conta pela CLI (src/cli.ts),
// que imprime um link de ativação; o próprio usuário define a senha por esse link. A recuperação
// de senha usa o mesmo mecanismo (link de redefinição gerado pela CLI), sem envio de e-mail.
import { and, eq, gt, isNull } from "drizzle-orm";
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
}

export async function criarConta(email: string, nome: string): Promise<Conta> {
  const [criada] = await db
    .insert(usuarios)
    .values({ email, nome })
    .onConflictDoNothing({ target: usuarios.email })
    .returning({ id: usuarios.id, email: usuarios.email, nome: usuarios.nome });
  if (!criada) throw new ErroDeConta("EMAIL_EM_USO", `já existe uma conta com o e-mail ${email}`);
  return criada;
}

// Gera um link de uso único e invalida os links anteriores ainda não usados do mesmo usuário.
export async function gerarLinkSenha(
  email: string,
  finalidade: FinalidadeTokenSenha,
): Promise<{ link: string; expiraEm: Date; conta: Conta }> {
  const [conta] = await db
    .select({ id: usuarios.id, email: usuarios.email, nome: usuarios.nome })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);
  if (!conta) throw new ErroDeConta("CONTA_INEXISTENTE", `nenhuma conta com o e-mail ${email}`);

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
  return { link, expiraEm, conta };
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
      .returning({ id: usuarios.id, email: usuarios.email, nome: usuarios.nome });
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
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nome: usuarios.nome,
      senhaHash: usuarios.senhaHash,
    })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);
  const hash = linha?.senhaHash ?? (await obterHashFicticio());
  const confere = await verificarSenha(senha, hash);
  if (!linha?.senhaHash || !confere) return undefined;
  return { id: linha.id, email: linha.email, nome: linha.nome };
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
  { email: string; nome: string; ativa: boolean; criadoEm: Date }[]
> {
  const linhas = await db
    .select({
      email: usuarios.email,
      nome: usuarios.nome,
      senhaHash: usuarios.senhaHash,
      criadoEm: usuarios.criadoEm,
    })
    .from(usuarios)
    .orderBy(usuarios.criadoEm);
  return linhas.map(({ senhaHash, ...resto }) => ({ ...resto, ativa: senhaHash !== null }));
}
