// Tabelas do banco (Drizzle ORM).
// Fluxo: editar este arquivo → `pnpm --filter @warii/server db:generate` → reiniciar o servidor,
// que aplica as migrations novas sozinho ao subir.
import type { Acao, CorId, EstadoPartida, Parametros, Sorteio } from "@warii/engine";
import type { StatusPartida } from "@warii/shared";
import { sql } from "drizzle-orm";
import type { AcaoCriacao } from "../partidas/inicio.js";
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// citext (extensão criada na migration 0000): compara sem diferenciar maiúsculas/minúsculas.
const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: "date" });

export const usuarios = pgTable("usuarios", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    check(
      "tokens_senha_finalidade_check",
      sql`${tabela.finalidade} in ('ativacao', 'redefinicao')`,
    ),
  ],
);

// Só imports de tipo de @warii/*: o drizzle-kit carrega este arquivo sozinho, fora do tsx.
const STATUS_PARTIDA = [
  "aguardando",
  "em_andamento",
  "encerrada",
  "cancelada",
] as const satisfies readonly StatusPartida[];

// Partidas. O estado do jogo não fica aqui: está no log (acoes_partida) e nos snapshots.
export const partidas = pgTable(
  "partidas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    nome: text("nome").notNull(),
    anfitriaoId: uuid("anfitriao_id")
      .notNull()
      .references(() => usuarios.id),
    status: text("status", { enum: STATUS_PARTIDA }).notNull().default("aguardando"),
    // Parâmetros completos (WARII.md §13.4), configurados pelo anfitrião antes de iniciar.
    parametros: jsonb("parametros").$type<Parametros>().notNull(),
    // Token do convite, guardado em claro para o anfitrião rever o link (só dá entrada numa sala
    // de espera). Nulo depois de iniciar ou cancelar.
    convite: text("convite").unique(),
    // Número da última ação gravada no log (-1 antes de iniciar). Controle de concorrência.
    seq: integer("seq").notNull().default(-1),
    vencedorId: uuid("vencedor_id").references(() => usuarios.id),
    criadaEm: instante("criada_em").notNull().defaultNow(),
    iniciadaEm: instante("iniciada_em"),
    encerradaEm: instante("encerrada_em"),
    atualizadaEm: instante("atualizada_em").notNull().defaultNow(),
  },
  (tabela) => [
    index("partidas_anfitriao_id_idx").on(tabela.anfitriaoId),
    check(
      "partidas_status_check",
      sql`${tabela.status} in ('aguardando', 'em_andamento', 'encerrada', 'cancelada')`,
    ),
  ],
);

export const participantes = pgTable(
  "participantes",
  {
    partidaId: uuid("partida_id")
      .notNull()
      .references(() => partidas.id),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id),
    // Cor escolhida no lobby (ids de IDS_CORES do engine; o check abaixo garante no banco).
    cor: text("cor").$type<CorId>(),
    // Posição na mesa, sorteada ao iniciar (0 = primeiro da ordem).
    assento: integer("assento"),
    entrouEm: instante("entrou_em").notNull().defaultNow(),
  },
  (tabela) => [
    primaryKey({ columns: [tabela.partidaId, tabela.usuarioId] }),
    unique("participantes_partida_cor_unq").on(tabela.partidaId, tabela.cor),
    unique("participantes_partida_assento_unq").on(tabela.partidaId, tabela.assento),
    index("participantes_usuario_id_idx").on(tabela.usuarioId),
    check(
      "participantes_cor_check",
      sql`${tabela.cor} in ('branco', 'vermelho', 'azul', 'preto', 'verde', 'amarelo')`,
    ),
  ],
);

// Log da partida, só de inclusão (um trigger recusa UPDATE e DELETE; migration 0003).
// seq 0 é a criação da partida; os sorteios gravados permitem repetir cada ação (replay).
export const acoesPartida = pgTable(
  "acoes_partida",
  {
    partidaId: uuid("partida_id")
      .notNull()
      .references(() => partidas.id),
    seq: integer("seq").notNull(),
    // Quem enviou a ação; nulo quando é do sistema (ex.: a criação).
    usuarioId: uuid("usuario_id").references(() => usuarios.id),
    tipo: text("tipo").notNull(),
    // seq 0: AcaoCriacao; as demais: a Acao do engine enviada pelo jogador.
    acao: jsonb("acao").$type<AcaoCriacao | Acao>().notNull(),
    sorteios: jsonb("sorteios").$type<Sorteio[]>().notNull(),
    criadaEm: instante("criada_em").notNull().defaultNow(),
  },
  (tabela) => [primaryKey({ columns: [tabela.partidaId, tabela.seq] })],
);

// Estado completo da partida depois da ação `seq` (atalho para não repetir o log inteiro).
export const snapshots = pgTable(
  "snapshots",
  {
    partidaId: uuid("partida_id")
      .notNull()
      .references(() => partidas.id),
    seq: integer("seq").notNull(),
    estado: jsonb("estado").$type<EstadoPartida>().notNull(),
    criadoEm: instante("criado_em").notNull().defaultNow(),
  },
  (tabela) => [primaryKey({ columns: [tabela.partidaId, tabela.seq] })],
);
