// Avisos que aparecem uma vez por lote de eventos (chave `tipo:partida:seq`), até o OK.
import { useState } from "react";

const vistos = new Set<string>();

export function useAvisoUnico<T extends { seq: number }>(
  tipo: string,
  partidaId: string,
  aviso: T | null | undefined,
): { aviso: T | null; fechar: () => void } {
  // Só para redesenhar depois do OK (o que já foi visto fica em `vistos`).
  const [, setVistos] = useState(0);
  const chave = aviso ? `${tipo}:${partidaId}:${aviso.seq}` : null;
  const visivel = aviso && chave !== null && !vistos.has(chave) ? aviso : null;
  const fechar = () => {
    if (chave !== null) vistos.add(chave);
    setVistos((n) => n + 1);
  };
  return { aviso: visivel, fechar };
}
