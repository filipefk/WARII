// Entrada numa partida pelo link de convite (`/convite#token=…`). Se o usuário não estava logado,
// o ExigirLogin o trouxe de volta para cá depois do login, com o fragmento preservado.
import { esquemaTokenConvite } from "@warii/shared";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { Aviso, Carregando } from "../componentes/basicos";
import { useTokenDoFragmento } from "../hooks/useTokenDoFragmento";
import { usePartidas } from "../stores/partidas";

export function Convite() {
  const token = useTokenDoFragmento();
  const navegar = useNavigate();
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const [erro, setErro] = useState<string | null>(null);
  // Um pedido só, mesmo com o efeito repetido pelo StrictMode.
  const enviado = useRef(false);

  const tokenValido = token !== null && esquemaTokenConvite.safeParse(token).success;

  useEffect(() => {
    if (token === null || !tokenValido || enviado.current) return;
    enviado.current = true;
    apiPartidas
      .entrar(token)
      .then((lobby) => {
        gravarLobby(lobby);
        void navegar(`/partidas/${lobby.id}`, { replace: true });
      })
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)));
  }, [token, tokenValido, gravarLobby, navegar]);

  if (!tokenValido || erro) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Aviso>{erro ?? "convite inválido ou expirado"}</Aviso>
        <p className="text-sm text-slate-400">
          Peça um link novo ao anfitrião.{" "}
          <Link to="/partidas" className="text-amber-400 hover:underline">
            Ver minhas partidas
          </Link>
        </p>
      </div>
    );
  }
  return <Carregando texto="entrando na partida…" />;
}
