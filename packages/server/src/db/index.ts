// Pool de conexões único do servidor e instância do Drizzle sobre ele.
// O pool é preguiçoso: só conecta na primeira consulta, então pode ser criado
// antes de `prepararBanco` garantir que o database existe.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

// O banco ou uma transação aberta: funções que gravam aceitam qualquer um dos dois.
export type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executor = typeof db | Transacao;

// Usado pelo /api/health: responde rápido mesmo com o banco fora do ar.
export async function bancoResponde(): Promise<boolean> {
  let temporizador: NodeJS.Timeout | undefined;
  const tempoEsgotado = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new Error("tempo esgotado")), 2_000);
  });
  try {
    await Promise.race([pool.query("SELECT 1"), tempoEsgotado]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(temporizador);
  }
}
