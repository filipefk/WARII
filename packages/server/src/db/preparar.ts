// Bootstrap do banco, executado antes de o servidor abrir a porta:
// 1. cria o database de DATABASE_URL se não existir (esperando o Postgres subir, se preciso);
// 2. aplica as migrations pendentes sob uma trava, para duas instâncias não migrarem juntas.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyBaseLogger } from "fastify";
import { Client } from "pg";
import { config } from "../config.js";
import { pool } from "./index.js";

// Database que sempre existe no cluster, usado só para consultar/criar o da aplicação.
const DATABASE_DE_MANUTENCAO = "postgres";

// Chave da trava consultiva (pg_advisory_lock) das migrations. Valor arbitrário e fixo:
// todas as instâncias precisam usar o mesmo. Não reutilizar em outro lugar.
const TRAVA_MIGRATIONS = "7426311820115004213";

// Nomes aceitos para o database: identificador simples do Postgres (até 63 caracteres).
const NOME_VALIDO = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

// Quanto tempo esperar o Postgres aceitar conexões antes de desistir.
const ESPERA_MAXIMA_MS = 30_000;

// Erros que indicam "o Postgres ainda não está pronto": vale tentar de novo.
const CODIGOS_TRANSITORIOS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P03", // cannot_connect_now (servidor iniciando)
]);

function codigoDoErro(erro: unknown): string | undefined {
  if (typeof erro === "object" && erro !== null && "code" in erro) {
    const { code } = erro;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function erroTransitorio(erro: unknown): boolean {
  const codigo = codigoDoErro(erro);
  if (codigo !== undefined) return CODIGOS_TRANSITORIOS.has(codigo);
  // O pg não põe código no erro de tempo de conexão esgotado.
  return erro instanceof Error && /timeout/i.test(erro.message);
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function lerAlvo(): { nome: string; urlDeManutencao: string } {
  const url = new URL(config.DATABASE_URL);
  const nome = decodeURIComponent(url.pathname.slice(1));
  if (!NOME_VALIDO.test(nome)) {
    throw new Error(
      "O nome do database em DATABASE_URL é inválido: use apenas letras, dígitos e _ " +
        "(começando por letra ou _, até 63 caracteres).",
    );
  }
  // Mesmas credenciais, host e parâmetros (ex.: sslmode); só troca o database.
  url.pathname = `/${DATABASE_DE_MANUTENCAO}`;
  return { nome, urlDeManutencao: url.toString() };
}

async function conectarComEspera(
  connectionString: string,
  log: FastifyBaseLogger,
): Promise<Client> {
  const inicio = Date.now();
  let espera = 1_000;
  for (;;) {
    const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 });
    try {
      await client.connect();
      return client;
    } catch (erro) {
      await client.end().catch(() => undefined);
      const restante = ESPERA_MAXIMA_MS - (Date.now() - inicio);
      if (!erroTransitorio(erro) || restante <= 0) throw erro;
      log.warn(
        { codigo: codigoDoErro(erro), proximaTentativaEmMs: espera },
        "Postgres indisponível; tentando de novo",
      );
      await esperar(Math.min(espera, restante));
      espera = Math.min(espera * 2, 8_000);
    }
  }
}

async function garantirDatabase(log: FastifyBaseLogger): Promise<void> {
  const { nome, urlDeManutencao } = lerAlvo();
  const client = await conectarComEspera(urlDeManutencao, log);
  try {
    const existe = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [nome]);
    if (existe.rowCount !== null && existe.rowCount > 0) {
      log.info({ database: nome }, "database já existe");
      return;
    }
    try {
      // CREATE DATABASE não aceita parâmetro: o nome já foi validado e vai citado.
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(nome)}`);
      log.info({ database: nome }, "database criado");
    } catch (erro) {
      const codigo = codigoDoErro(erro);
      if (codigo === "42P04") {
        // duplicate_database: outra instância criou entre a consulta e o CREATE.
        log.info({ database: nome }, "database criado por outra instância");
        return;
      }
      if (codigo === "42501") {
        throw new Error(
          `O usuário de DATABASE_URL não tem permissão CREATEDB. ` +
            `Crie o database "${nome}" manualmente ou conceda a permissão.`,
          { cause: erro },
        );
      }
      throw erro;
    }
  } finally {
    await client.end();
  }
}

async function aplicarMigrations(log: FastifyBaseLogger, pastaDeMigrations: string): Promise<void> {
  const client = await pool.connect();
  // Se não der para soltar a trava, a conexão é descartada em vez de voltar ao pool;
  // ao fechá-la, o Postgres libera a trava sozinho.
  let descartarConexao = false;
  try {
    await client.query("SELECT pg_advisory_lock($1)", [TRAVA_MIGRATIONS]);
    try {
      log.info("aplicando migrations pendentes");
      await migrate(drizzle(client), { migrationsFolder: pastaDeMigrations });
      log.info("migrations em dia");
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [TRAVA_MIGRATIONS]);
      } catch {
        descartarConexao = true;
      }
    }
  } finally {
    client.release(descartarConexao);
  }
}

export async function prepararBanco(
  log: FastifyBaseLogger,
  pastaDeMigrations: string,
): Promise<void> {
  await garantirDatabase(log);
  await aplicarMigrations(log, pastaDeMigrations);
}
