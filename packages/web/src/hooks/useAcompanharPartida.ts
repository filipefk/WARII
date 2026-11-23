// Acompanha uma partida pelo socket enquanto o componente está montado: pede `entrarNaPartida`
// agora e a cada (re)conexão, e `deixarPartida` ao sair. Os dados chegam pelos stores.
import type { ErroApi } from "@warii/shared";
import { useEffect, useState } from "react";
import { socket } from "../socket";

export function useAcompanharPartida(partidaId: string): ErroApi | null {
  const [erro, setErro] = useState<ErroApi | null>(null);

  useEffect(() => {
    let ativo = true;
    const entrar = () => {
      socket.emit("entrarNaPartida", partidaId, (resposta) => {
        if (ativo) setErro(resposta.ok ? null : resposta.erro);
      });
    };
    // Só com a conexão aberta (o socket.io guardaria o pedido e o repetiria junto com o `connect`).
    if (socket.connected) entrar();
    socket.on("connect", entrar);
    return () => {
      ativo = false;
      socket.off("connect", entrar);
      if (socket.connected) socket.emit("deixarPartida", partidaId);
    };
  }, [partidaId]);

  return erro;
}
