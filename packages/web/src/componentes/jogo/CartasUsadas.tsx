// Aviso para toda a mesa quando alguém usa cartas: quais cartas, onde e como (reforço, transporte,
// descarte ou bombardeiros para um ataque aéreo). As cartas usadas são públicas (§9.3).
import { cartaDeTroca, type Evento } from "@warii/engine";
import type { Mesa } from "../../jogo/mesa";
import type { Geografia } from "../../mapa/geografia";
import { USOU_CARTAS } from "../../stores/partidas";
import { textoDoEvento } from "../../ui/textosEventos";
import { Botao } from "../basicos";
import { JanelaPopup } from "../JanelaPopup";
import { CartaTroca } from "../tabuleiro/CartaTroca";

const COMO: Partial<Record<Evento["tipo"], string>> = {
  reforcoComCartas: "Reforço",
  transporteComCartas: "Transporte",
  cartasDescartadas: "Descarte",
  ataqueAereoIniciado: "Bombardeiros para o ataque aéreo",
};

export function CartasUsadas({
  aviso,
  mesa,
  geografia,
  onFechar,
}: {
  aviso: { seq: number; eventos: Evento[] };
  mesa: Mesa;
  geografia: Geografia;
  onFechar: () => void;
}) {
  const usos = aviso.eventos.filter(USOU_CARTAS);
  return (
    <JanelaPopup titulo="Cartas usadas" largura="max-w-[560px]" onEsc={onFechar}>
      {usos.map((e, k) => {
        if (!("cartas" in e) || !("jogador" in e)) return null;
        return (
          <div key={k} className={k > 0 ? "mt-espaco-5 border-t border-border pt-espaco-5" : ""}>
            <p className="secao">{COMO[e.tipo]}</p>
            <div className="mt-espaco-2 flex flex-wrap gap-espaco-2">
              {e.cartas.map((id) => {
                const carta = cartaDeTroca(id);
                return carta ? (
                  <CartaTroca key={id} carta={carta} geografia={geografia} largura={70} />
                ) : null;
              })}
            </div>
            <p className="mt-espaco-3">{textoDoEvento(e, mesa.nome)}</p>
          </div>
        );
      })}
      <div className="mt-espaco-7 flex justify-end">
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- o OK recebe o foco para fechar com Enter */}
        <Botao autoFocus onClick={onFechar}>
          OK
        </Botao>
      </div>
    </JanelaPopup>
  );
}
