// Rotas /api/auth.
import type {
  DefinirSenhaEntrada,
  LoginEntrada,
  TrocarSenhaEntrada,
  UsuarioDto,
  VersaoAvatar,
} from "@warii/shared";
import { requisitar } from "./cliente";

export const apiAuth = {
  eu: () => requisitar<UsuarioDto>("GET", "/auth/eu"),
  login: (entrada: LoginEntrada) => requisitar<UsuarioDto>("POST", "/auth/login", entrada),
  logout: () => requisitar<void>("POST", "/auth/logout"),
  definirSenha: (entrada: DefinirSenhaEntrada) =>
    requisitar<UsuarioDto>("POST", "/auth/senha/definir", entrada),
  trocarSenha: (entrada: TrocarSenhaEntrada) => requisitar<void>("PUT", "/auth/senha", entrada),
  sairDeTodas: () => requisitar<void>("POST", "/auth/sair-de-todas"),
  definirAvatar: (imagem: string) =>
    requisitar<{ avatar: VersaoAvatar }>("PUT", "/auth/avatar", { imagem }),
  removerAvatar: () => requisitar<{ avatar: VersaoAvatar }>("DELETE", "/auth/avatar"),
};
