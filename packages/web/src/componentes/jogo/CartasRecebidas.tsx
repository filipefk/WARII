// Aviso do fim da vez: quantas cartas o jogador recebeu ao encerrar a jogada, e por quê (sem
// conquista, limite da mão ou monte vazio). Aparece uma vez por fim de vez, até o OK.
import { useState } from "react";
import { type CartasDoFimDaVez, textoDasCartasDoFimDaVez } from "../../jogo/cartasDoFimDaVez";
import { Botao } from "../basicos";
import { JanelaPopup } from "../JanelaPopup";

const vistos = new Set<string>();

export function useCartasRecebidas(
  partidaId: string,
  fimDaVez: CartasDoFimDaVez | null | undefined,
): { aviso: CartasDoFimDaVez | null; fechar: () => void } {
  // Só para redesenhar depois do OK (o que já foi visto fica em `vistos`).
  const [, setVistos] = useState(0);
  const chave = fimDaVez ? `${partidaId}:${fimDaVez.seq}` : null;
  const aviso = fimDaVez && chave !== null && !vistos.has(chave) ? fimDaVez : null;
  const fechar = () => {
    if (chave !== null) vistos.add(chave);
    setVistos((n) => n + 1);
  };
  return { aviso, fechar };
}

export function CartasRecebidas({
  aviso,
  onFechar,
}: {
  aviso: CartasDoFimDaVez;
  onFechar: () => void;
}) {
  return (
    <JanelaPopup titulo="Fim da vez: Cartas" onEsc={onFechar}>
      <p>{textoDasCartasDoFimDaVez(aviso)}</p>
      <div className="mt-espaco-7 flex justify-end">
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- o OK recebe o foco para fechar com Enter */}
        <Botao autoFocus onClick={onFechar}>
          OK
        </Botao>
      </div>
    </JanelaPopup>
  );
}
