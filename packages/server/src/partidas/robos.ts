// Grupo fixo de contas-robô: jogadores controlados pelo servidor (tempoReal/robos.ts). São linhas
// comuns de `usuarios` (as FKs, o log e o vencedor funcionam igual), com `robo = true`, sem senha.
// Criadas sob demanda, na primeira vez que um anfitrião adiciona um robô.
import { asc, eq } from "drizzle-orm";
import { DOMINIO_ROBOS } from "../auth/contas.js";
import type { Executor } from "../db/index.js";
import { usuarios } from "../db/schema.js";

const NOMES = ["Robô Alfa", "Robô Bravo", "Robô Charlie", "Robô Delta", "Robô Eco"] as const;

export const CONTAS_ROBO = NOMES.map((nome, i) => ({
  email: `robo${i + 1}${DOMINIO_ROBOS}`,
  nome,
  robo: true,
}));

// Ids dos robôs, na ordem do grupo.
export async function garantirRobos(executor: Executor): Promise<string[]> {
  await executor
    .insert(usuarios)
    .values(CONTAS_ROBO)
    .onConflictDoNothing({ target: usuarios.email });
  const linhas = await executor
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.robo, true))
    .orderBy(asc(usuarios.email));
  return linhas.map((l) => l.id);
}

export async function ehRobo(executor: Executor, usuarioId: string): Promise<boolean> {
  const [linha] = await executor
    .select({ robo: usuarios.robo })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId));
  return linha?.robo === true;
}
