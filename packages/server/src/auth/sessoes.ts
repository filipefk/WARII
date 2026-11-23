// Sessões de login: criação, validação (com expiração deslizante), revogação e limpeza.
// `sessaoPorToken` é a porta única de entrada: o REST (plugin.ts) e, na etapa 7, o handshake do
// Socket.IO validam o cookie por ela.
import { and, eq, gt, isNull, lt, ne, or } from "drizzle-orm";
import { db, type Executor } from "../db/index.js";
import { sessoes, tokensSenha, usuarios } from "../db/schema.js";
import { formatoDeTokenValido, gerarToken, hashDoToken } from "./tokens.js";

export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;
// Renova o prazo só quando já passou metade dele (evita um UPDATE a cada requisição).
const RENOVAR_APOS_MS = DURACAO_SESSAO_MS / 2;
// Sessões revogadas ficam um tempo no banco para auditoria antes da limpeza.
const GUARDAR_REVOGADAS_MS = 7 * 24 * 60 * 60 * 1000;
const TAMANHO_MAXIMO_USER_AGENT = 255;

export interface UsuarioDaSessao {
  id: string;
  email: string;
  nome: string;
}

export interface SessaoValida {
  sessaoId: string;
  usuario: UsuarioDaSessao;
  // Preenchido quando o prazo foi renovado: o cookie deve ser reenviado com a nova validade.
  renovadaAte: Date | undefined;
}

export interface OrigemDaSessao {
  ip: string | undefined;
  userAgent: string | undefined;
}

export async function criarSessao(
  usuarioId: string,
  origem: OrigemDaSessao,
  executor: Executor = db,
): Promise<{ token: string; expiraEm: Date }> {
  const token = gerarToken();
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await executor.insert(sessoes).values({
    usuarioId,
    tokenHash: hashDoToken(token),
    expiraEm,
    ip: origem.ip ?? null,
    userAgent: origem.userAgent?.slice(0, TAMANHO_MAXIMO_USER_AGENT) ?? null,
  });
  return { token, expiraEm };
}

export async function sessaoPorToken(token: string): Promise<SessaoValida | undefined> {
  if (!formatoDeTokenValido(token)) return undefined;
  const agora = new Date();
  const [linha] = await db
    .select({
      sessaoId: sessoes.id,
      expiraEm: sessoes.expiraEm,
      id: usuarios.id,
      email: usuarios.email,
      nome: usuarios.nome,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
    .where(
      and(
        eq(sessoes.tokenHash, hashDoToken(token)),
        isNull(sessoes.revogadaEm),
        gt(sessoes.expiraEm, agora),
      ),
    )
    .limit(1);
  if (!linha) return undefined;

  let renovadaAte: Date | undefined;
  if (linha.expiraEm.getTime() - agora.getTime() < DURACAO_SESSAO_MS - RENOVAR_APOS_MS) {
    renovadaAte = new Date(agora.getTime() + DURACAO_SESSAO_MS);
    await db
      .update(sessoes)
      .set({ expiraEm: renovadaAte, ultimoUsoEm: agora })
      .where(eq(sessoes.id, linha.sessaoId));
  }
  return {
    sessaoId: linha.sessaoId,
    usuario: { id: linha.id, email: linha.email, nome: linha.nome },
    renovadaAte,
  };
}

// Confere se a sessão continua válida (não revogada nem vencida), sem renovar o prazo. Usada pelo
// socket a cada pedido, pois a conexão pode durar mais que a sessão.
export async function sessaoAtiva(sessaoId: string): Promise<boolean> {
  const [linha] = await db
    .select({ id: sessoes.id })
    .from(sessoes)
    .where(
      and(eq(sessoes.id, sessaoId), isNull(sessoes.revogadaEm), gt(sessoes.expiraEm, new Date())),
    )
    .limit(1);
  return linha !== undefined;
}

export async function revogarSessao(sessaoId: string): Promise<void> {
  await db
    .update(sessoes)
    .set({ revogadaEm: new Date() })
    .where(and(eq(sessoes.id, sessaoId), isNull(sessoes.revogadaEm)));
}

// Revoga todas as sessões do usuário, exceto (opcionalmente) a indicada.
export async function revogarSessoesDoUsuario(
  usuarioId: string,
  exceto?: string,
  executor: Executor = db,
): Promise<void> {
  await executor
    .update(sessoes)
    .set({ revogadaEm: new Date() })
    .where(
      and(
        eq(sessoes.usuarioId, usuarioId),
        isNull(sessoes.revogadaEm),
        exceto === undefined ? undefined : ne(sessoes.id, exceto),
      ),
    );
}

// Apaga sessões vencidas (ou revogadas há tempo) e links de senha vencidos ou usados.
export async function limparVencidas(): Promise<{ sessoes: number; tokens: number }> {
  const agora = new Date();
  const limiteRevogadas = new Date(agora.getTime() - GUARDAR_REVOGADAS_MS);
  const sessoesApagadas = await db
    .delete(sessoes)
    .where(or(lt(sessoes.expiraEm, agora), lt(sessoes.revogadaEm, limiteRevogadas)))
    .returning({ id: sessoes.id });
  const tokensApagados = await db
    .delete(tokensSenha)
    .where(or(lt(tokensSenha.expiraEm, agora), lt(tokensSenha.usadoEm, limiteRevogadas)))
    .returning({ id: tokensSenha.id });
  return { sessoes: sessoesApagadas.length, tokens: tokensApagados.length };
}
