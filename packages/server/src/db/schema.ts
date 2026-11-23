// Tabelas do banco (Drizzle ORM).
// Fluxo: editar este arquivo → `pnpm --filter @warii/server db:generate` → reiniciar o servidor,
// que aplica as migrations novas sozinho ao subir.
import { sql } from "drizzle-orm";
import { check, customType, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// citext (extensão criada na migration 0000): compara sem diferenciar maiúsculas/minúsculas.
const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: "date" });

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: citext("email").notNull().unique(),
  // Apelido exibido no jogo.
  nome: text("nome").notNull(),
  // Nulo até o usuário ativar a conta pelo link gerado pelo administrador.
  senhaHash: text("senha_hash"),
  criadoEm: instante("criado_em").notNull().defaultNow(),
  atualizadoEm: instante("atualizado_em").notNull().defaultNow(),
});

// Sessões de login. O token fica só no cookie; aqui vai o HMAC dele (ver auth/tokens.ts).
export const sessoes = pgTable(
  "sessoes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tokenHash: bytea("token_hash").notNull().unique(),
    criadaEm: instante("criada_em").notNull().defaultNow(),
    expiraEm: instante("expira_em").notNull(),
    ultimoUsoEm: instante("ultimo_uso_em").notNull().defaultNow(),
    revogadaEm: instante("revogada_em"),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (tabela) => [index("sessoes_usuario_id_idx").on(tabela.usuarioId)],
);

export const FINALIDADES_TOKEN_SENHA = ["ativacao", "redefinicao"] as const;
export type FinalidadeTokenSenha = (typeof FINALIDADES_TOKEN_SENHA)[number];

// Links de uso único para ativar a conta ou redefinir a senha (gerados pela CLI).
export const tokensSenha = pgTable(
  "tokens_senha",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tokenHash: bytea("token_hash").notNull().unique(),
    finalidade: text("finalidade", { enum: FINALIDADES_TOKEN_SENHA }).notNull(),
    criadoEm: instante("criado_em").notNull().defaultNow(),
    expiraEm: instante("expira_em").notNull(),
    usadoEm: instante("usado_em"),
  },
  (tabela) => [
    index("tokens_senha_usuario_id_idx").on(tabela.usuarioId),
    check("tokens_senha_finalidade_check", sql`${tabela.finalidade} in ('ativacao', 'redefinicao')`),
  ],
);
