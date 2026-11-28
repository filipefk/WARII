// Painel com os jogadores online (algum socket aberto), com avatar e nome; a lista é pedida de
// novo a cada tanto enquanto o painel está na tela.
import type { UsuarioResumoDto } from "@warii/shared";
import { useEffect, useState } from "react";
import { mensagemDoErro } from "../api/cliente";
import { apiUsuarios } from "../api/usuarios";
import { useSessao } from "../stores/sessao";
import { NomeComAvatar } from "./Avatar";
import { Aviso, Cartao, Carregando } from "./basicos";

const INTERVALO_MS = 10000;

export function JogadoresOnline() {
  const eu = useSessao((s) => s.usuario?.id);
  const [online, setOnline] = useState<UsuarioResumoDto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const buscar = () => {
      apiUsuarios
        .online()
        .then((lista) => {
          if (!ativo) return;
          setOnline(lista);
          setErro(null);
        })
        .catch((falha: unknown) => ativo && setErro(mensagemDoErro(falha)));
    };
    buscar();
    const relogio = setInterval(buscar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(relogio);
    };
  }, []);

  return (
    <Cartao titulo={online ? `Online (${online.length})` : "Online"}>
      {!online && !erro && <Carregando />}
      {online && online.length === 0 && <p className="text-muted">Ninguém online agora.</p>}
      {online && online.length > 0 && (
        <ul className="space-y-espaco-2">
          {online.map((u) => (
            <li key={u.id}>
              <NomeComAvatar usuarioId={u.id} avatar={u.avatar} nome={u.nome} tamanho={28}>
                {u.id === eu && <span className="dica">você</span>}
              </NomeComAvatar>
            </li>
          ))}
        </ul>
      )}
      {erro && <Aviso>{erro}</Aviso>}
    </Cartao>
  );
}
