// Configuração do servidor, lida e validada de process.env na inicialização.
// Se algo estiver faltando ou inválido, o processo encerra antes de abrir a porta.
import { z } from "zod";

// Valor de exemplo do .env-exemplo: recusado para ninguém subir com ele por descuido.
const SEGREDO_DE_EXEMPLO = "troque-por-um-segredo-aleatorio-de-pelo-menos-32-caracteres";

const esquema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z
    .string({ error: "obrigatória" })
    .regex(/^postgres(ql)?:\/\/.+/, "deve ser uma URL postgres:// ou postgresql://"),
  SESSION_SECRET: z
    .string({ error: "obrigatória" })
    .min(32, "deve ter pelo menos 32 caracteres")
    .refine(
      (valor) => valor !== SEGREDO_DE_EXEMPLO,
      "ainda é o valor do .env-exemplo; gere um novo",
    ),
});

export type Config = Readonly<z.infer<typeof esquema>>;

function carregarConfig(): Config {
  const resultado = esquema.safeParse(process.env);
  if (!resultado.success) {
    // Mostra só o nome da variável e o motivo, nunca o valor recebido.
    const problemas = resultado.error.issues
      .map((problema) => `  - ${problema.path.join(".")}: ${problema.message}`)
      .join("\n");
    console.error(`Configuração inválida. Corrija as variáveis de ambiente:\n${problemas}`);
    process.exit(1);
  }
  return Object.freeze(resultado.data);
}

export const config = carregarConfig();
