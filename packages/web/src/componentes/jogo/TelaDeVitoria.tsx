// Fim da partida: tela cheia e opaca com o logotipo ferrugem (momento de destaque), o vencedor e o
// objetivo revelado. Cobre o cabeçalho, para o logotipo cromado não aparecer junto.
import type { VisaoPartida } from "@warii/engine";
import { useNavigate } from "react-router";
import type { Mesa } from "../../jogo/mesa";
import { Botao, CorJogador } from "../basicos";
import { CartaObjetivo } from "../tabuleiro/CartaObjetivo";

export function TelaDeVitoria({
  visao,
  mesa,
  onFechar,
}: {
  visao: VisaoPartida;
  mesa: Mesa;
  onFechar: () => void;
}) {
  const navegar = useNavigate();
  const vencedor = visao.jogadores.find((j) => j.id === visao.vencedor);
  const voceVenceu = visao.voce !== null && visao.voce === visao.vencedor;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fim de jogo"
      className="fixed inset-0 z-30 overflow-y-auto bg-bg"
    >
      <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-espaco-7 p-espaco-8 text-center">
        <img src="/WARII-ferrugem.svg" alt="War II" width={360} className="block h-auto" />
        <p className="secao">Fim de jogo</p>
        <h1 className="flex items-center gap-espaco-3 text-titulo">
          <CorJogador cor={vencedor?.cor ?? null} />
          {voceVenceu ? "Você venceu!" : `${mesa.nome(visao.vencedor)} venceu`}
        </h1>
        {vencedor?.objetivoId && (
          <div className="flex flex-col items-center gap-espaco-3">
            <p className="dica">Objetivo cumprido</p>
            <CartaObjetivo id={vencedor.objetivoId} largura={220} />
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-espaco-2">
          <Botao onClick={onFechar}>Ver o tabuleiro</Botao>
          <Botao onClick={() => void navegar("/partidas")}>Voltar às partidas</Botao>
        </div>
      </div>
    </div>
  );
}
