// Aviso das cartas herdadas ao eliminar um adversário (§11): quantas vieram e, se o limite da mão
// cortou, que o resto foi sorteado. Aparece uma vez por eliminação, até o OK.
import { type CartasHerdadas, textoDasCartasHerdadas } from "../../jogo/cartasHerdadas";
import { Botao } from "../basicos";
import { JanelaPopup } from "../JanelaPopup";

export function AvisoCartasHerdadas({
  aviso,
  onFechar,
}: {
  aviso: CartasHerdadas;
  onFechar: () => void;
}) {
  return (
    <JanelaPopup titulo="Cartas do adversário" onEsc={onFechar}>
      <p>{textoDasCartasHerdadas(aviso)}</p>
      <div className="mt-espaco-7 flex justify-end">
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- o OK recebe o foco para fechar com Enter */}
        <Botao autoFocus onClick={onFechar}>
          OK
        </Botao>
      </div>
    </JanelaPopup>
  );
}
