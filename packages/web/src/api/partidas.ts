// Rotas /api/partidas (lobby).
import type { CorId } from "@warii/engine";
import type {
  LogDetalhadoDto,
  ParametrosParciaisEntrada,
  PartidaLobbyDto,
  PartidaResumoDto,
  UsuarioResumoDto,
} from "@warii/shared";
import { requisitar } from "./cliente";

const caminho = (id: string, resto = "") => `/partidas/${encodeURIComponent(id)}${resto}`;

export const apiPartidas = {
  listar: () => requisitar<PartidaResumoDto[]>("GET", "/partidas"),
  criar: (nome: string, publica: boolean) =>
    requisitar<PartidaLobbyDto>("POST", "/partidas", { nome, publica }),
  // Partidas públicas aguardando jogadores, e a entrada numa delas sem convite.
  publicas: () => requisitar<PartidaResumoDto[]>("GET", "/partidas/publicas"),
  entrarNaPublica: (id: string) => requisitar<PartidaLobbyDto>("POST", caminho(id, "/entrar")),
  // O token do convite vai no corpo, nunca na URL.
  entrar: (token: string) => requisitar<PartidaLobbyDto>("POST", "/partidas/entrar", { token }),
  obter: (id: string) => requisitar<PartidaLobbyDto>("GET", caminho(id)),
  escolherCor: (id: string, cor: CorId) =>
    requisitar<PartidaLobbyDto>("PUT", caminho(id, "/cor"), { cor }),
  escolherCorDoRobo: (id: string, roboId: string, cor: CorId) =>
    requisitar<PartidaLobbyDto>(
      "PUT",
      caminho(id, `/participantes/${encodeURIComponent(roboId)}/cor`),
      { cor },
    ),
  adicionarRobo: (id: string) => requisitar<PartidaLobbyDto>("POST", caminho(id, "/robos")),
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
  logDetalhado: (id: string) => requisitar<LogDetalhadoDto>("GET", caminho(id, "/log-detalhado")),
  // Usuários online que o anfitrião pode chamar, e o convite direto a um deles.
  online: (id: string) => requisitar<UsuarioResumoDto[]>("GET", caminho(id, "/online")),
  convidar: (id: string, usuarioId: string) =>
    requisitar<void>("POST", caminho(id, "/convidar"), { usuarioId }),
  iniciar: (id: string) => requisitar<PartidaLobbyDto>("POST", caminho(id, "/iniciar")),
};
