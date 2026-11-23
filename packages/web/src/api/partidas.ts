// Rotas /api/partidas (lobby).
import type { CorId } from "@warii/engine";
import type {
  ParametrosParciaisEntrada,
  PartidaLobbyDto,
  PartidaResumoDto,
} from "@warii/shared";
import { requisitar } from "./cliente";

const caminho = (id: string, resto = "") => `/partidas/${encodeURIComponent(id)}${resto}`;

export const apiPartidas = {
  listar: () => requisitar<PartidaResumoDto[]>("GET", "/partidas"),
  criar: (nome: string) => requisitar<PartidaLobbyDto>("POST", "/partidas", { nome }),
  // O token do convite vai no corpo, nunca na URL.
  entrar: (token: string) => requisitar<PartidaLobbyDto>("POST", "/partidas/entrar", { token }),
  obter: (id: string) => requisitar<PartidaLobbyDto>("GET", caminho(id)),
  escolherCor: (id: string, cor: CorId) =>
    requisitar<PartidaLobbyDto>("PUT", caminho(id, "/cor"), { cor }),
  configurar: (id: string, parametros: ParametrosParciaisEntrada) =>
    requisitar<PartidaLobbyDto>("PUT", caminho(id, "/parametros"), { parametros }),
  renovarConvite: (id: string) => requisitar<PartidaLobbyDto>("POST", caminho(id, "/convite")),
  sair: (id: string) => requisitar<void>("POST", caminho(id, "/sair")),
  remover: (id: string, usuarioId: string) =>
    requisitar<PartidaLobbyDto>(
      "DELETE",
      caminho(id, `/participantes/${encodeURIComponent(usuarioId)}`),
    ),
  cancelar: (id: string) => requisitar<void>("POST", caminho(id, "/cancelar")),
  iniciar: (id: string) => requisitar<PartidaLobbyDto>("POST", caminho(id, "/iniciar")),
};
