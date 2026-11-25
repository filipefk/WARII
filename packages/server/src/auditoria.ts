// Log de auditoria: eventos de segurança e de administração das partidas, uma linha estruturada
// por evento (campo `auditoria` com o nome), no mesmo log do servidor. Filtrar por
// `"auditoria":` no log do container. Nunca levar senha, token nem cookie (o logger também oculta).
import type { FastifyBaseLogger } from "fastify";

export type EventoDeAuditoria =
  | "login"
  | "login_falhou"
  | "login_bloqueado"
  | "logout"
  | "senha_definida"
  | "senha_definir_falhou"
  | "senha_trocada"
  | "senha_trocar_falhou"
  | "sair_de_todas"
  | "origem_recusada"
  | "socket_recusado"
  | "socket_excesso_de_mensagens"
  | "partida_criada"
  | "partida_entrou"
  | "partida_saiu"
  | "participante_removido"
  | "convite_renovado"
  | "partida_iniciada"
  | "partida_cancelada"
  | "partida_encerrada"
  | "partida_corrompida";

// Eventos que indicam ataque ou falha vão como `warn`; o resto como `info`.
const ALERTAS = new Set<EventoDeAuditoria>([
  "login_falhou",
  "login_bloqueado",
  "senha_definir_falhou",
  "senha_trocar_falhou",
  "origem_recusada",
  "socket_recusado",
  "socket_excesso_de_mensagens",
  "partida_corrompida",
]);

export function auditar(
  log: FastifyBaseLogger,
  evento: EventoDeAuditoria,
  dados: Record<string, unknown> = {},
): void {
  const registro = { auditoria: evento, ...dados };
  if (ALERTAS.has(evento)) log.warn(registro, `auditoria: ${evento}`);
  else log.info(registro, `auditoria: ${evento}`);
}

// E-mail digitado numa tentativa de login, só com o bastante para reconhecer a conta visada:
// "fulano@exemplo.com" → "f***@exemplo.com".
export function mascararEmail(email: string): string {
  const arroba = email.lastIndexOf("@");
  if (arroba < 1) return "***";
  return `${email[0]}***${email.slice(arroba)}`;
}
