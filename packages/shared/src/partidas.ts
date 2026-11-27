// Contrato das rotas /api/partidas (lobby): entradas validadas no servidor e DTOs de resposta.
import { type CorId, IDS_CORES, type Parametros } from "@warii/engine";
import { z } from "zod";
import { esquemaParametrosParciais } from "./parametros.js";

export const NOME_PARTIDA_MIN = 2;
export const NOME_PARTIDA_MAX = 40;

export const STATUS_PARTIDA = ["aguardando", "em_andamento", "encerrada", "cancelada"] as const;
export type StatusPartida = (typeof STATUS_PARTIDA)[number];

export const esquemaIdPartida = z.uuid({ error: "partida inexistente" });

// Token do convite: 32 bytes em base64url (mesmo formato dos tokens de sessão e de senha).
export const esquemaTokenConvite = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "convite inválido ou expirado");

export const esquemaCor = z.enum(IDS_CORES, { error: "cor inválida" });

export const CriarPartidaEntrada = z.strictObject({
  nome: z
    .string()
    .trim()
    .min(NOME_PARTIDA_MIN, `o nome deve ter pelo menos ${NOME_PARTIDA_MIN} caracteres`)
    .max(NOME_PARTIDA_MAX, `o nome deve ter no máximo ${NOME_PARTIDA_MAX} caracteres`),
});
export type CriarPartidaEntrada = z.infer<typeof CriarPartidaEntrada>;

// O token vai no corpo, nunca na URL (o link do front leva o token no fragmento: /convite#token=…).
export const EntrarPartidaEntrada = z.strictObject({ token: esquemaTokenConvite });
export type EntrarPartidaEntrada = z.infer<typeof EntrarPartidaEntrada>;

export const EscolherCorEntrada = z.strictObject({ cor: esquemaCor });
export type EscolherCorEntrada = z.infer<typeof EscolherCorEntrada>;

// Só os parâmetros alterados; o servidor junta com os atuais e roda validarParametros().
export const ConfigurarPartidaEntrada = z.strictObject({ parametros: esquemaParametrosParciais });
export type ConfigurarPartidaEntrada = z.infer<typeof ConfigurarPartidaEntrada>;

export interface ParticipanteDto {
  usuarioId: string;
  nome: string;
  cor: CorId | null;
  // Posição na mesa (0 = primeiro); sorteada ao iniciar, nula antes disso.
  assento: number | null;
  anfitriao: boolean;
  // Jogador controlado pelo servidor; o anfitrião escolhe a cor dele e pode removê-lo.
  robo: boolean;
}

export interface PartidaResumoDto {
  id: string;
  nome: string;
  status: StatusPartida;
  anfitriao: { id: string; nome: string };
  quantidadeParticipantes: number;
  criadaEm: string;
  iniciadaEm: string | null;
}

export interface PartidaLobbyDto extends PartidaResumoDto {
  participantes: ParticipanteDto[];
  parametros: Parametros;
  // Link de convite: só para o anfitrião e só enquanto a partida aguarda jogadores.
  convite: string | null;
}

// GET /api/partidas/:id/log-detalhado: o log da partida em texto, para baixar como .txt.
export interface LogDetalhadoDto {
  nomeArquivo: string;
  texto: string;
}
