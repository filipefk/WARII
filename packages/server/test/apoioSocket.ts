// Apoio aos testes do Socket.IO: app escutando numa porta livre, clientes socket.io-client com o
// cookie da sessão, registro de tudo o que cada cliente recebe e conferência da informação oculta.
import { fileURLToPath } from "node:url";

import type { Acao, Evento, VisaoPartida } from "@warii/engine";
import type {
  ClientToServerEvents,
  ErroApi,
  PartidaLobbyDto,
  ServerToClientEvents,
} from "@warii/shared";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { io as criarCliente, type Socket } from "socket.io-client";

import { criarApp } from "../src/app.js";
import { NOME_COOKIE_SESSAO } from "../src/auth/plugin.js";
import { config } from "../src/config.js";
import { prepararBanco } from "../src/db/preparar.js";
import { ipNovo, requisitar } from "./apoio.js";

const pastaDeMigrations = fileURLToPath(new URL("../drizzle", import.meta.url));

export const PRAZO_MS = 5_000;

export type Cliente = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface Conta {
  id: string;
  sessao: string;
  nome: string;
}

export async function iniciarAppComPorta(): Promise<{ app: FastifyInstance; url: string }> {
  const app = await criarApp(false);
  await prepararBanco(app.log, pastaDeMigrations);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const endereco = app.server.address();
  if (endereco === null || typeof endereco === "string") throw new Error("sem porta TCP");
  return { app, url: `http://127.0.0.1:${endereco.port}` };
}

interface OpcoesConexao {
  sessao?: string | undefined;
  // undefined = a origem do site; null = sem cabeçalho Origin.
  origem?: string | null | undefined;
  cabecalhos?: Record<string, string> | undefined;
}

export function novoCliente(
  url: string,
  { sessao, origem, cabecalhos: extras = {} }: OpcoesConexao = {},
): Cliente {
  const cabecalhos: Record<string, string> = { ...extras };
  if (sessao !== undefined) cabecalhos.cookie = `${NOME_COOKIE_SESSAO}=${sessao}`;
  const origemUsada = origem === undefined ? config.URL_PUBLICA : origem;
  if (origemUsada !== null) cabecalhos.origin = origemUsada;
  return criarCliente(url, {
    path: "/socket.io",
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    autoConnect: false,
    extraHeaders: cabecalhos,
  });
}

function codigoDaRecusa(erro: Error): string {
  const dados: unknown = "data" in erro ? erro.data : undefined;
  if (typeof dados === "object" && dados !== null && "codigo" in dados) {
    return String(dados.codigo);
  }
  return erro.message;
}

// Conecta e devolve o código da recusa (connect_error), ou null se conectou.
export function conectar(cliente: Cliente): Promise<string | null> {
  return new Promise((resolver) => {
    cliente.once("connect", () => resolver(null));
    cliente.once("connect_error", (erro) => resolver(codigoDaRecusa(erro)));
    cliente.connect();
  });
}

export function esperarDesconexao(cliente: Cliente): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    if (cliente.disconnected) {
      resolver("já desconectado");
      return;
    }
    const prazo = setTimeout(() => rejeitar(new Error("o socket não foi desconectado")), PRAZO_MS);
    cliente.once("disconnect", (motivo) => {
      clearTimeout(prazo);
      resolver(motivo);
    });
  });
}

// Pedidos com conteúdo arbitrário (para testar a validação): passam pelo JSON, como na rede.
export function semTipo(valor: unknown): Acao {
  const copia: Acao = JSON.parse(JSON.stringify(valor));
  return copia;
}

export type Mensagem =
  | { nome: "estado"; partidaId: string; visao: VisaoPartida; seq: number }
  | { nome: "eventos"; partidaId: string; eventos: Evento[]; visao: VisaoPartida; seq: number }
  | { nome: "lobby"; partidaId: string; lobby: PartidaLobbyDto }
  | { nome: "removido"; partidaId: string }
  | { nome: "presenca"; partidaId: string; conectados: string[] }
  | { nome: "erro"; erro: ErroApi };

// Guarda, em ordem, tudo o que o cliente recebe, e permite esperar uma mensagem específica.
export class Escuta {
  readonly mensagens: Mensagem[] = [];
  private esperas: { teste: (m: Mensagem) => boolean; resolver: (m: Mensagem) => void }[] = [];

  constructor(readonly cliente: Cliente) {
    cliente.on("estado", (partidaId, visao, seq) =>
      this.registrar({ nome: "estado", partidaId, visao, seq }),
    );
    cliente.on("eventos", (partidaId, eventos, visao, seq) =>
      this.registrar({ nome: "eventos", partidaId, eventos, visao, seq }),
    );
    cliente.on("lobby", (partidaId, lobby) => this.registrar({ nome: "lobby", partidaId, lobby }));
    cliente.on("removido", (partidaId) => this.registrar({ nome: "removido", partidaId }));
    cliente.on("presenca", (partidaId, conectados) =>
      this.registrar({ nome: "presenca", partidaId, conectados }),
    );
    cliente.on("erro", (erro) => this.registrar({ nome: "erro", erro }));
  }

  private registrar(m: Mensagem): void {
    this.mensagens.push(m);
    this.esperas = this.esperas.filter((e) => {
      if (!e.teste(m)) return true;
      e.resolver(m);
      return false;
    });
  }

  // Primeira mensagem (a partir do índice `desde`) que passa no teste; espera se ainda não chegou.
  esperar<T extends Mensagem>(teste: (m: Mensagem) => m is T, desde = 0): Promise<T> {
    for (const m of this.mensagens.slice(desde)) if (teste(m)) return Promise.resolve(m);
    return new Promise((resolver, rejeitar) => {
      const espera = {
        teste,
        resolver: (m: Mensagem) => {
          clearTimeout(temporizador);
          if (teste(m)) resolver(m);
        },
      };
      const temporizador = setTimeout(() => {
        this.esperas = this.esperas.filter((e) => e !== espera);
        rejeitar(new Error("mensagem esperada não chegou"));
      }, PRAZO_MS);
      this.esperas.push(espera);
    });
  }

  esperarEstado(partidaId: string, desde = 0) {
    return this.esperar(
      (m): m is Extract<Mensagem, { nome: "estado" }> =>
        m.nome === "estado" && m.partidaId === partidaId,
      desde,
    );
  }

  async esperarEventos(partidaId: string, seq: number): Promise<Evento[]> {
    const m = await this.esperar(
      (x): x is Extract<Mensagem, { nome: "eventos" }> =>
        x.nome === "eventos" && x.partidaId === partidaId && x.seq === seq,
    );
    return m.eventos;
  }

  async esperarLobby(
    partidaId: string,
    teste: (l: PartidaLobbyDto) => boolean = () => true,
    desde = 0,
  ): Promise<PartidaLobbyDto> {
    const m = await this.esperar(
      (x): x is Extract<Mensagem, { nome: "lobby" }> =>
        x.nome === "lobby" && x.partidaId === partidaId && teste(x.lobby),
      desde,
    );
    return m.lobby;
  }

  async esperarRemovido(partidaId: string): Promise<void> {
    await this.esperar(
      (x): x is Extract<Mensagem, { nome: "removido" }> =>
        x.nome === "removido" && x.partidaId === partidaId,
    );
  }

  async esperarPresenca(partidaId: string, conectados: readonly string[], desde = 0) {
    const esperado = JSON.stringify([...conectados].toSorted());
    await this.esperar(
      (x): x is Extract<Mensagem, { nome: "presenca" }> =>
        x.nome === "presenca" &&
        x.partidaId === partidaId &&
        JSON.stringify(x.conectados) === esperado,
      desde,
    );
  }
}

// Lança se alguma mensagem recebida por `eu` contém objetivo ou cartas de outro jogador.
export function conferirSemSegredosAlheios(mensagens: readonly Mensagem[], eu: string): void {
  const conferirVisao = (visao: VisaoPartida) => {
    if ("monte" in visao) throw new Error(`${eu} recebeu a ordem do monte`);
    if (visao.voce !== eu) throw new Error(`${eu} recebeu a visão de ${String(visao.voce)}`);
    for (const j of visao.jogadores) {
      if (j.id === eu) continue;
      const vencedorRevelado = visao.fase === "FIM" && visao.vencedor === j.id;
      if (j.cartas !== null) throw new Error(`${eu} vê as cartas de ${j.id}`);
      if (!vencedorRevelado && (j.objetivoId !== null || j.objetivoOriginalId !== null)) {
        throw new Error(`${eu} vê o objetivo de ${j.id}`);
      }
    }
  };
  for (const m of mensagens) {
    if (m.nome === "estado") conferirVisao(m.visao);
    if (m.nome === "eventos") {
      conferirVisao(m.visao);
      for (const e of m.eventos) {
        switch (e.tipo) {
          case "objetivoSorteado":
          case "objetivoAlterado":
            if (e.jogador !== eu) throw new Error(`${eu} recebeu o objetivo de ${e.jogador}`);
            break;
          case "cartasCompradas":
          case "cartasHerdadas":
            if (e.jogador !== eu && e.cartas.length > 0) {
              throw new Error(`${eu} recebeu as cartas de ${e.jogador}`);
            }
            break;
          default:
            break;
        }
      }
    }
  }
}

// ---- REST do lobby (app.inject) ----

export function pedir(
  app: FastifyInstance,
  conta: Conta,
  metodo: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  corpo?: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return requisitar(app, {
    metodo,
    url: `/api/partidas${url}`,
    corpo,
    sessao: conta.sessao,
    ip: ipNovo(),
  });
}

export function tokenDoConvite(lobby: PartidaLobbyDto): string {
  if (!lobby.convite) throw new Error("lobby sem convite");
  return new URL(lobby.convite).hash.replace(/^#token=/, "");
}

const CORES = ["branco", "vermelho", "azul", "preto", "verde", "amarelo"] as const;

export async function criarSala(app: FastifyInstance, anfitriao: Conta): Promise<PartidaLobbyDto> {
  const criada = await pedir(app, anfitriao, "POST", "", { nome: "Partida de teste" });
  if (criada.statusCode !== 201) throw new Error(`criar: ${criada.statusCode}`);
  return criada.json<PartidaLobbyDto>();
}

// O primeiro cria a partida; os outros entram pelo convite; todos escolhem cor. Não inicia.
export async function montarLobby(app: FastifyInstance, contas: readonly Conta[]): Promise<string> {
  const [anfitriao, ...convidados] = contas;
  if (!anfitriao) throw new Error("sem contas");
  const lobby = await criarSala(app, anfitriao);
  const token = tokenDoConvite(lobby);
  for (const conta of convidados) {
    const r = await pedir(app, conta, "POST", "/entrar", { token });
    if (r.statusCode !== 200) throw new Error(`entrar: ${r.statusCode}`);
  }
  for (const [i, conta] of contas.entries()) {
    const r = await pedir(app, conta, "PUT", `/${lobby.id}/cor`, { cor: CORES[i] });
    if (r.statusCode !== 200) throw new Error(`cor: ${r.statusCode}`);
  }
  return lobby.id;
}

export async function iniciar(
  app: FastifyInstance,
  anfitriao: Conta,
  partidaId: string,
): Promise<void> {
  const r = await pedir(app, anfitriao, "POST", `/${partidaId}/iniciar`);
  if (r.statusCode !== 200) throw new Error(`iniciar: ${r.statusCode} ${r.body}`);
}
