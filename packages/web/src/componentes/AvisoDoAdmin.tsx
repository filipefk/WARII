// Popup para quem acompanhava uma partida que o administrador encerrou ou apagou; aparece em
// qualquer tela (a partida apagada leva o jogador de volta à lista).
import { useAvisosDoAdmin } from "../stores/avisosDoAdmin";
import { Botao } from "./basicos";
import { JanelaPopup } from "./JanelaPopup";

export function AvisoDoAdmin() {
  const aviso = useAvisosDoAdmin((s) => s.pendentes[0]);
  const descartar = useAvisosDoAdmin((s) => s.descartar);
  if (!aviso) return null;

  const apagada = aviso.tipo === "apagada";
  return (
    <JanelaPopup titulo={apagada ? "Partida excluída" : "Partida encerrada"} onEsc={descartar}>
      <div className="space-y-espaco-7">
        <p>
          {apagada ? "O administrador excluiu a partida." : "O administrador encerrou a partida."}
        </p>
        <div className="flex flex-wrap gap-espaco-2">
          <Botao onClick={descartar}>OK</Botao>
        </div>
      </div>
    </JanelaPopup>
  );
}
