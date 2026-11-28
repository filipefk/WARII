// Convite direto recebido (o anfitrião chamou da sala de espera): aparece em qualquer tela.
// Aceitar entra na partida com o token do convite e abre a sala de espera.
import { useState } from "react";
import { useNavigate } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { useConvites } from "../stores/convites";
import { usePartidas } from "../stores/partidas";
import { NomeComAvatar } from "./Avatar";
import { Aviso, Botao } from "./basicos";
import { JanelaPopup } from "./JanelaPopup";

export function ConviteRecebido() {
  const convite = useConvites((s) => s.pendentes[0]);
  const descartar = useConvites((s) => s.descartar);
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const navegar = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!convite) return null;

  const recusar = () => {
    setErro(null);
    descartar(convite.partidaId);
  };
  const aceitar = () => {
    setErro(null);
    setEnviando(true);
    apiPartidas
      .entrar(convite.token)
      .then((lobby) => {
        gravarLobby(lobby);
        descartar(convite.partidaId);
        void navegar(`/partidas/${lobby.id}`);
      })
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setEnviando(false));
  };

  return (
    <JanelaPopup titulo="Convite para jogar" onEsc={recusar}>
      <div className="space-y-espaco-7">
        <p className="flex flex-wrap items-center gap-espaco-2">
          <NomeComAvatar
            usuarioId={convite.anfitriao.id}
            avatar={convite.anfitriao.avatar}
            nome={convite.anfitriao.nome}
            tamanho={32}
            className="font-bold"
          />
          chamou você para a partida <b>{convite.partidaNome}</b>.
        </p>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-wrap gap-espaco-2">
          <Botao onClick={aceitar} ocupado={enviando}>
            Aceitar e entrar
          </Botao>
          <Botao onClick={recusar} disabled={enviando}>
            Recusar
          </Botao>
        </div>
      </div>
    </JanelaPopup>
  );
}
