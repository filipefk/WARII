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
  // Endereço do site visto pelo navegador (sem barra no fim): base dos links de senha
  // e origem aceita nas requisições que alteram dados.
  URL_PUBLICA: z
    .url({ protocol: /^https?$/, error: "deve ser uma URL http:// ou https://" })
    .transform((valor) => new URL(valor).origin)
    .default("http://localhost:5173"),
  // Atrás de proxy reverso (Traefik do Dokploy), para o servidor ver o IP real do cliente:
  // o número de proxies na frente (recomendado: 1), ou endereços/faixas confiáveis separados por
  // vírgula. "true" confia em qualquer X-Forwarded-For, que o cliente pode forjar (o IP do rate
  // limit e do bloqueio de login viraria o que ele quisesse): aceito, mas evite.
  TRUST_PROXY: z
    .string()
    .trim()
    .min(1)
    .default("false")
    .transform((valor): boolean | number | string => {
      if (valor === "true") return true;
      if (valor === "false") return false;
      if (/^\d+$/.test(valor)) return Number(valor);
      return valor;
    })
    .refine((valor) => typeof valor !== "string" || /^[0-9a-fA-F.:/,\s]+$/.test(valor), {
      error: 'deve ser "false", o número de proxies (ex.: 1) ou IPs/faixas separados por vírgula',
    }),
  // Token (Bearer) que libera GET /api/metricas. Sem ele, a rota não existe (404).
  METRICAS_TOKEN: z.string().min(32, "deve ter pelo menos 32 caracteres").optional(),
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
