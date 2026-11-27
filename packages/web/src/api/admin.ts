// Rotas /api/admin (só para administradores).
import type {
  CriarUsuarioEntrada,
  EditarUsuarioEntrada,
  LinkSenhaDto,
  LogUsuarioDto,
  PartidaAdminDto,
  UsuarioAdminDto,
} from "@warii/shared";
import { requisitar } from "./cliente";

const usuario = (id: string, resto = "") => `/admin/usuarios/${encodeURIComponent(id)}${resto}`;
const partida = (id: string, resto = "") => `/admin/partidas/${encodeURIComponent(id)}${resto}`;

export const apiAdmin = {
  listarUsuarios: () => requisitar<UsuarioAdminDto[]>("GET", "/admin/usuarios"),
  criarUsuario: (entrada: CriarUsuarioEntrada) =>
    requisitar<UsuarioAdminDto>("POST", "/admin/usuarios", entrada),
  editarUsuario: (id: string, entrada: EditarUsuarioEntrada) =>
    requisitar<UsuarioAdminDto>("PUT", usuario(id), entrada),
  apagarUsuario: (id: string) => requisitar<void>("DELETE", usuario(id)),
  gerarLinkSenha: (id: string) => requisitar<LinkSenhaDto>("POST", usuario(id, "/link-senha")),
  definirSenha: (id: string, senha: string) =>
    requisitar<UsuarioAdminDto>("PUT", usuario(id, "/senha"), { senha }),
  logDoUsuario: (id: string) => requisitar<LogUsuarioDto[]>("GET", usuario(id, "/log")),

  listarPartidas: () => requisitar<PartidaAdminDto[]>("GET", "/admin/partidas"),
  encerrarPartida: (id: string) => requisitar<void>("POST", partida(id, "/encerrar")),
  apagarPartida: (id: string) => requisitar<void>("DELETE", partida(id)),
};
