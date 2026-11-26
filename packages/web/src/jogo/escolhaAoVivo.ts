// Transmite à mesa as escolhas em andamento de quem age (painel espelhado dos outros jogadores).
// Só a contagem das cartas marcadas segue: a mão continua oculta. Com intervalo mínimo entre
// envios, para não estourar o limite de mensagens do socket.
import { jogadorQueAge, type VisaoPartida } from "@warii/engine";
import type { Escolha } from "@warii/shared";
import { useEffect, useRef } from "react";
import { socket } from "../socket";
import { useJogo } from "../stores/jogo";
import { euSouDaVez } from "./previa";

const INTERVALO_MS = 150;

export function useTransmitirEscolha(
  partidaId: string,
  visao: VisaoPartida | undefined,
  seq: number | undefined,
): void {
  const modo = useJogo((s) => s.modo);
  const origem = useJogo((s) => s.origem);
  const destino = useJogo((s) => s.destino);
  const daBase = useJogo((s) => s.daBase);
  const cartas = useJogo((s) => s.cartas.length);
  const quantidade = useJogo((s) => s.quantidadeMostrada);
  const dados = useJogo((s) => s.dadosMostrados);
  const ultima = useRef<string | null>(null);

  const ativo =
    visao !== undefined &&
    seq !== undefined &&
    visao.fase !== "FIM" &&
    euSouDaVez(visao) &&
    jogadorQueAge(visao) === visao.voce;

  useEffect(() => {
    if (!ativo || seq === undefined) return undefined;
    const escolha: Escolha = {
      seq,
      modo,
      origem,
      destino,
      quantidade,
      daBase,
      dados,
      cartasMarcadas: cartas,
    };
    const texto = JSON.stringify(escolha);
    if (texto === ultima.current) return undefined;
    const temporizador = setTimeout(() => {
      if (!socket.connected) return;
      ultima.current = texto;
      socket.emit("escolha", partidaId, escolha);
    }, INTERVALO_MS);
    return () => clearTimeout(temporizador);
  }, [ativo, partidaId, seq, modo, origem, destino, quantidade, daBase, dados, cartas]);
}
