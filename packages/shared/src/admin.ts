// Contrato das rotas /api/admin (só para contas com `admin`): cadastro de usuários e partidas.
import { z } from "zod";
import { esquemaEmail, esquemaNome, esquemaSenha } from "./auth.js";
import type { StatusPartida } from "./partidas.js";

export const esquemaIdUsuario = z.uuid({ error: "usuário inexistente" });

export const CriarUsuarioEntrada = z.strictObject({
  email: esquemaEmail,
  nome: esquemaNome,
  admin: z.boolean().default(false),
});
export type CriarUsuarioEntrada = z.input<typeof CriarUsuarioEntrada>;

// Só os campos alterados.
export const EditarUsuarioEntrada = z.strictObject({
  email: esquemaEmail.optional(),
  nome: esquemaNome.optional(),
  admin: z.boolean().optional(),
});
export type EditarUsuarioEntrada = z.infer<typeof EditarUsuarioEntrada>;

// Senha definida pelo administrador (as sessões do usuário são encerradas).
export const DefinirSenhaDoUsuarioEntrada = z.strictObject({ senha: esquemaSenha });
export type DefinirSenhaDoUsuarioEntrada = z.infer<typeof DefinirSenhaDoUsuarioEntrada>;

export interface UsuarioAdminDto {
  id: string;
  email: string;
  nome: string;
  admin: boolean;
  // Já tem senha (ativou a conta pelo link ou o administrador a definiu).
  ativa: boolean;
  // Partidas de que participa ou participou (um usuário com partidas não pode ser apagado).
  partidas: number;
  criadoEm: string;
}

// Link de uso único para o próprio usuário definir a senha: de ativação se a conta ainda não tem
// senha, senão de redefinição.
export interface LinkSenhaDto {
  link: string;
  finalidade: "ativacao" | "redefinicao";
  expiraEm: string;
}

export interface PartidaAdminDto {
  id: string;
  nome: string;
  status: StatusPartida;
  anfitriao: { id: string; nome: string };
  participantes: { usuarioId: string; nome: string; robo: boolean }[];
  vencedor: { id: string; nome: string } | null;
  // Ações gravadas no log (-1 antes de iniciar).
  seq: number;
  criadaEm: string;
  iniciadaEm: string | null;
  encerradaEm: string | null;
}

// Log simples por jogador (GET /api/admin/usuarios/:id/log), do mais recente ao mais antigo.
// login: entrou no jogo (login ou link de senha); partida_criada: criou a partida;
// partida_iniciada: jogou (a partida começou com ele na mesa). `partida.id` é nulo se a partida
// foi apagada depois; o nome e os adversários ficam guardados no log.
export type TipoLogUsuario = "login" | "partida_criada" | "partida_iniciada";

export interface LogUsuarioDto {
  id: string;
  tipo: TipoLogUsuario;
  criadoEm: string;
  partida: { id: string | null; nome: string } | null;
  adversarios: { nome: string; robo: boolean }[];
  ip: string | null;
}
