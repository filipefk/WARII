// Conexão em tempo real. Só conecta com sessão (o handshake confere o mesmo cookie do REST).
// Os ouvintes são registrados uma vez, fora dos componentes, e gravam nos stores.
import type { ClientToServerEvents, ErroApi, ServerToClientEvents } from "@warii/shared";
import { io, type Socket } from "socket.io-client";
import { useConexao } from "./stores/conexao";
import { useAvisosDoAdmin } from "./stores/avisosDoAdmin";
import { useConvites } from "./stores/convites";
import { usePartidas } from "./stores/partidas";
import { useSessao } from "./stores/sessao";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  path: "/socket.io",
  autoConnect: false,
});

// Recusas do handshake e desconexões pedidas pelo servidor não reconectam sozinhas: tenta de
// novo depois deste tempo.
const ESPERA_NOVA_TENTATIVA_MS = 5000;
let novaTentativa: ReturnType<typeof setTimeout> | undefined;

function ehErroApi(dado: unknown): dado is ErroApi {
  return typeof dado === "object" && dado !== null && "codigo" in dado && "mensagem" in dado;
}

const logado = () => useSessao.getState().situacao === "logado";

// Pede de novo o estado completo de uma partida (ex.: buraco na sequência de eventos).
export function ressincronizar(partidaId: string): void {
  if (socket.connected) socket.emit("entrarNaPartida", partidaId, () => {});
}

function agendarNovaTentativa(): void {
  clearTimeout(novaTentativa);
  novaTentativa = setTimeout(() => {
    if (logado() && !socket.connected) socket.connect();
  }, ESPERA_NOVA_TENTATIVA_MS);
}

function ligarOuvintes(): void {
  const conexao = useConexao.getState();
  const partidas = usePartidas.getState();

  socket.on("connect", () => {
    conexao.definir("conectada");
    conexao.avisar(null);
  });

  socket.on("disconnect", (motivo) => {
    if (!logado()) {
      conexao.definir("desligada");
      return;
    }
    conexao.definir("reconectando");
    // O servidor derrubou de propósito (sessão encerrada em outro lugar, troca de senha): confere
    // a sessão; se ainda valer, reconecta. Nos demais motivos o próprio cliente reconecta.
    if (motivo === "io server disconnect") {
      void useSessao
        .getState()
        .carregar()
        .then(() => {
          if (logado()) socket.connect();
        });
    }
  });

  socket.on("connect_error", (erro) => {
    const dado: unknown = (erro as Error & { data?: unknown }).data;
    if (ehErroApi(dado) && dado.codigo === "NAO_AUTENTICADO") {
      useSessao.getState().limpar();
      return;
    }
    conexao.definir("reconectando");
    if (!socket.active) agendarNovaTentativa();
  });

  socket.on("lobby", (_partidaId, lobby) => partidas.gravarLobby(lobby));
  socket.on("removido", (partidaId) => partidas.marcarRemovido(partidaId));
  socket.on("apagada", (partidaId) => {
    partidas.marcarApagada(partidaId);
    useAvisosDoAdmin.getState().receber({ partidaId, tipo: "apagada" });
  });
  socket.on("encerrada", (partidaId) =>
    useAvisosDoAdmin.getState().receber({ partidaId, tipo: "encerrada" }),
  );
  socket.on("presenca", (partidaId, conectados) => partidas.gravarPresenca(partidaId, conectados));
  socket.on("escolha", (partidaId, escolha) => partidas.gravarEscolha(partidaId, escolha));
  socket.on("estado", (partidaId, visao, seq) => partidas.gravarEstado(partidaId, visao, seq));
  socket.on("eventos", (partidaId, eventos, visao, seq) => {
    if (!usePartidas.getState().gravarEventos(partidaId, eventos, visao, seq)) {
      ressincronizar(partidaId);
    }
  });
  socket.on("convite", (convite) => useConvites.getState().receber(convite));
  socket.on("erro", (erro) => conexao.avisar(erro));
}

function aplicarSessao(estaLogado: boolean): void {
  if (estaLogado) {
    if (!socket.connected && !socket.active) {
      useConexao.getState().definir("conectando");
      socket.connect();
    }
    return;
  }
  clearTimeout(novaTentativa);
  socket.disconnect();
  useConexao.getState().definir("desligada");
  usePartidas.getState().limpar();
  useConvites.getState().limpar();
  useAvisosDoAdmin.getState().limpar();
}

// Liga e desliga o socket conforme a sessão. Chamado uma vez, no main.tsx.
export function iniciarTempoReal(): void {
  ligarOuvintes();
  aplicarSessao(logado());
  useSessao.subscribe((estado, anterior) => {
    if (estado.situacao !== anterior.situacao && estado.situacao !== "carregando") {
      aplicarSessao(estado.situacao === "logado");
    }
  });
}
