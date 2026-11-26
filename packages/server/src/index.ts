import { fileURLToPath } from "node:url";
import { conferirDados } from "@warii/engine";
import { adminsSemSenha } from "./admin/usuarios.js";
import { criarApp } from "./app.js";
import { limparVencidas } from "./auth/sessoes.js";
import { auditar, mascararEmail } from "./auditoria.js";
import { config } from "./config.js";
import { pool } from "./db/index.js";
import { prepararBanco } from "./db/preparar.js";
import { opcoesDoLogger } from "./logger.js";
import { INTERVALO_LOG_METRICAS_MS, lerMetricas } from "./metricas.js";

// Pasta gerada pelo `drizzle-kit generate`. Resolvida a partir deste arquivo de propósito:
// em dev ele é src/index.ts e em produção o tsup gera um único dist/index.js — ambos um nível
// abaixo da raiz do pacote, então "../drizzle" aponta para packages/server/drizzle nos dois casos.
const pastaDeMigrations = fileURLToPath(new URL("../drizzle", import.meta.url));

// Tempo máximo para fechar tudo ao receber SIGTERM/SIGINT antes de forçar a saída.
const PRAZO_ENCERRAMENTO_MS = 10_000;

// Intervalo da limpeza de sessões e links de senha vencidos (também roda ao iniciar).
const INTERVALO_LIMPEZA_MS = 6 * 60 * 60 * 1000;

const app = await criarApp(opcoesDoLogger);

// Erros que escaparam de todo tratamento: a promessa rejeitada só vai para o log; a exceção
// deixa o processo num estado desconhecido, então ele sai (o Dokploy o reinicia).
process.on("unhandledRejection", (motivo) => {
  app.log.error({ err: motivo }, "promessa rejeitada sem tratamento");
});
process.on("uncaughtException", (erro) => {
  app.log.fatal({ err: erro }, "exceção não capturada; encerrando");
  process.exit(1);
});

if (config.NODE_ENV === "production" && config.TRUST_PROXY === true) {
  app.log.warn(
    "TRUST_PROXY=true confia em qualquer X-Forwarded-For; use o número de proxies (ex.: 1)",
  );
}

// Conexões ociosas que caem (ex.: Postgres reiniciou) não podem derrubar o processo.
pool.on("error", (erro) => {
  app.log.error({ err: erro }, "erro em conexão ociosa do pool do banco");
});

// O Socket.IO fecha no preClose (tempoReal/servidor.ts); o pool fecha por último, depois que
// nenhuma requisição pode mais usá-lo.
app.addHook("onClose", async () => {
  await pool.end();
});

// Administrador sem senha (criado sem senha e ainda não ativado): lembra no log como entrar.
async function avisarAdminSemSenha(): Promise<void> {
  for (const email of await adminsSemSenha()) {
    // E-mail mascarado, como em toda a auditoria (o do seed é admin@warii.local).
    auditar(app.log, "admin_sem_senha", {
      email: mascararEmail(email),
      comando: "cli senha:link <e-mail do administrador>",
    });
  }
}

async function limparSessoes(): Promise<void> {
  try {
    const apagados = await limparVencidas();
    app.log.info(apagados, "limpeza de sessões e links de senha vencidos");
  } catch (erro) {
    app.log.error({ err: erro }, "falha na limpeza de sessões vencidas");
  }
}

let encerrando = false;
async function encerrar(sinal: NodeJS.Signals): Promise<void> {
  if (encerrando) return;
  encerrando = true;
  app.log.info({ sinal }, "encerrando o servidor");
  setTimeout(() => {
    app.log.error("encerramento demorou demais; saindo à força");
    process.exit(1);
  }, PRAZO_ENCERRAMENTO_MS).unref();
  try {
    await app.close();
  } catch (erro) {
    app.log.error({ err: erro }, "erro ao encerrar o servidor");
    process.exitCode = 1;
  }
}

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.once(sinal, () => void encerrar(sinal));
}

try {
  // Dados do jogo errados (mapa, cartas, objetivos) invalidariam qualquer partida: nem sobe.
  const errosNosDados = conferirDados();
  if (errosNosDados.length > 0) {
    throw new Error(`dados estáticos do engine inválidos:\n- ${errosNosDados.join("\n- ")}`);
  }
  await prepararBanco(app.log, pastaDeMigrations);
  await app.listen({ port: config.PORT, host: config.HOST });
  await avisarAdminSemSenha();
  await limparSessoes();
  setInterval(() => void limparSessoes(), INTERVALO_LIMPEZA_MS).unref();
  setInterval(() => {
    app.log.info({ metricas: lerMetricas(app) }, "métricas");
  }, INTERVALO_LOG_METRICAS_MS).unref();
} catch (erro) {
  app.log.fatal({ err: erro }, "falha ao iniciar o servidor");
  process.exitCode = 1;
  // Fecha o pool e o socket para o processo terminar sozinho (e o log ser escrito).
  await app.close().catch(() => undefined);
}
