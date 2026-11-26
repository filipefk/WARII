// Aviso do início da vez: quantos bombardeiros o jogador recebeu pelos centros estratégicos.
import {
  type AvioesRecebidos as Avioes,
  textoDosAvioesRecebidos,
} from "../../jogo/avioesRecebidos";
import { Botao } from "../basicos";
import { JanelaPopup } from "../JanelaPopup";

export function AvioesRecebidos({ aviso, onFechar }: { aviso: Avioes; onFechar: () => void }) {
  return (
    <JanelaPopup titulo="Início da vez: Aviões" onEsc={onFechar}>
      <p>{textoDosAvioesRecebidos(aviso)}</p>
      <div className="mt-espaco-7 flex justify-end">
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- o OK recebe o foco para fechar com Enter */}
        <Botao autoFocus onClick={onFechar}>
          OK
        </Botao>
      </div>
    </JanelaPopup>
  );
}
