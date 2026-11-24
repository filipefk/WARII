// Envio de uma ação do jogo pelo socket. O servidor valida e aplica; a visão nova chega pelo evento
// `eventos`. Aqui só se espera a confirmação (ack) e se mostra a recusa.
import type { Acao } from "@warii/engine";
import type { Confirmacao } from "@warii/shared";
import { useCallback, useState } from "react";
import { socket } from "../socket";

// Sem resposta neste prazo, a ação é dada como perdida (o estado é ressincronizado na reconexão).
const PRAZO_CONFIRMACAO_MS = 10_000;

export function enviarAcao(partidaId: string, acao: Acao): Promise<Confirmacao> {
  if (!socket.connected) {
    return Promise.resolve({
      ok: false,
      erro: { codigo: "SEM_CONEXAO", mensagem: "Sem conexão com o servidor. Aguarde a reconexão." },
    });
  }
  return new Promise((resolver) => {
    socket.timeout(PRAZO_CONFIRMACAO_MS).emit("acao", partidaId, acao, (falha, resposta) => {
      if (falha) {
        resolver({
          ok: false,
          erro: { codigo: "SEM_RESPOSTA", mensagem: "O servidor não respondeu. Tente de novo." },
        });
        return;
      }
      resolver(resposta);
    });
  });
}

// Mensagem a mostrar para uma recusa. ESTADO_DESATUALIZADO não é erro do jogador: o servidor já
// reenviou o estado, basta conferir o tabuleiro e repetir.
function mensagemDaRecusa(codigo: string, mensagem: string): string {
  if (codigo === "ESTADO_DESATUALIZADO") return "A partida mudou. Confira o tabuleiro e repita.";
  return mensagem;
}

// Envia ações de uma partida com indicador de "ocupado" e a última recusa.
export function useEnviarAcao(partidaId: string) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Devolve true se a ação foi aceita.
  const enviar = useCallback(
    async (acao: Acao): Promise<boolean> => {
      setOcupado(true);
      setErro(null);
      try {
        const resposta = await enviarAcao(partidaId, acao);
        if (!resposta.ok) {
          setErro(mensagemDaRecusa(resposta.erro.codigo, resposta.erro.mensagem));
        }
        return resposta.ok;
      } finally {
        setOcupado(false);
      }
    },
    [partidaId],
  );

  const limparErro = useCallback(() => setErro(null), []);
  return { ocupado, erro, enviar, limparErro };
}
