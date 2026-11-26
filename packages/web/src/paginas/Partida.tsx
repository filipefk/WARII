// Uma partida: carrega o lobby pela API, acompanha pelo socket e escolhe a tela conforme o status.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { Aviso, Carregando } from "../componentes/basicos";
import { useAcompanharPartida } from "../hooks/useAcompanharPartida";
import { useDadosPartida, usePartidas } from "../stores/partidas";
import { useSessao } from "../stores/sessao";
import type { EstadoAviso } from "./Partidas";
import { SalaDeEspera } from "./SalaDeEspera";
import { TelaDoJogo } from "./TelaDoJogo";

function TelaDaPartida({ partidaId }: { partidaId: string }) {
  const navegar = useNavigate();
  const usuarioId = useSessao((s) => s.usuario?.id ?? "");
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const esquecer = usePartidas((s) => s.esquecer);
  const { lobby, presenca, jogo, removido, apagada } = useDadosPartida(partidaId);
  const erroSocket = useAcompanharPartida(partidaId);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    apiPartidas
      .obter(partidaId)
      .then((dados) => ativo && gravarLobby(dados))
      .catch((falha: unknown) => ativo && setErro(mensagemDoErro(falha)));
    return () => {
      ativo = false;
      esquecer(partidaId);
    };
  }, [partidaId, gravarLobby, esquecer]);

  // Saída forçada: removido pelo anfitrião (ou saiu em outra aba), partida cancelada (pelo
  // anfitrião ou pelo administrador) ou apagada pelo administrador.
  const cancelada = lobby?.status === "cancelada";
  useEffect(() => {
    if (!removido && !cancelada && !apagada) return;
    const estado: EstadoAviso = {
      aviso: apagada
        ? "A partida foi apagada pelo administrador."
        : removido
          ? "Você saiu ou foi removido da partida."
          : "A partida foi cancelada.",
    };
    void navegar("/partidas", { replace: true, state: estado });
  }, [removido, cancelada, apagada, navegar]);

  const falha = erro ?? (lobby ? null : erroSocket?.mensagem);
  if (falha) {
    return (
      <div className="space-y-espaco-7">
        <Aviso>{falha}</Aviso>
        <Link to="/partidas" className="link">
          Voltar às partidas
        </Link>
      </div>
    );
  }
  if (!lobby || cancelada || removido || apagada) return <Carregando />;

  if (lobby.status === "aguardando") {
    return <SalaDeEspera lobby={lobby} presenca={presenca} usuarioId={usuarioId} />;
  }
  return <TelaDoJogo partidaId={partidaId} lobby={lobby} presenca={presenca} jogo={jogo} />;
}

export function Partida() {
  const { id } = useParams();
  if (!id) return null;
  // A chave remonta tudo ao trocar de partida (estado local, socket e store).
  return <TelaDaPartida key={id} partidaId={id} />;
}
