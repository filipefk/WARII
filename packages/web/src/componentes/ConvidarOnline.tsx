// Convite direto na sala de espera: o anfitrião vê quem está online (com o avatar) e chama alguém;
// o convite aparece na tela do convidado (ConviteRecebido), que aceita e entra na sala.
import type { PartidaLobbyDto, UsuarioResumoDto } from "@warii/shared";
import { useEffect, useState } from "react";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { NomeComAvatar } from "./Avatar";
import { Aviso, Botao, Carregando } from "./basicos";
import { JanelaPopup } from "./JanelaPopup";

// A lista é pedida de novo enquanto a janela está aberta.
const INTERVALO_MS = 5000;

function JanelaDeOnline({ lobby, onFechar }: { lobby: PartidaLobbyDto; onFechar: () => void }) {
  const [online, setOnline] = useState<UsuarioResumoDto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [convidados, setConvidados] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let ativo = true;
    const buscar = () => {
      apiPartidas
        .online(lobby.id)
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
  }, [lobby.id]);

  const convidar = (alvo: UsuarioResumoDto) => {
    setEnviando(alvo.id);
    setErro(null);
    apiPartidas
      .convidar(lobby.id, alvo.id)
      .then(() => setConvidados((s) => new Set(s).add(alvo.id)))
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setEnviando(null));
  };

  return (
    <JanelaPopup titulo="Convidar quem está online" onEsc={onFechar}>
      <div className="space-y-espaco-7">
        {!online && !erro && <Carregando />}
        {online && online.length === 0 && (
          <p className="text-muted">Ninguém de fora da partida está online agora.</p>
        )}
        {online && online.length > 0 && (
          <ul className="max-h-80 space-y-espaco-2 overflow-y-auto">
            {online.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-espaco-5 rounded-raio-md border border-border bg-panel-2 px-espaco-4 py-espaco-2"
              >
                <NomeComAvatar usuarioId={u.id} avatar={u.avatar} nome={u.nome} tamanho={32} />
                <span className="ml-auto">
                  {convidados.has(u.id) ? (
                    <span className="dica">convite enviado</span>
                  ) : (
                    <Botao ocupado={enviando === u.id} onClick={() => convidar(u)}>
                      Convidar
                    </Botao>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {erro && <Aviso>{erro}</Aviso>}
        <Botao onClick={onFechar}>Fechar</Botao>
      </div>
    </JanelaPopup>
  );
}

export function ConvidarOnline({ lobby }: { lobby: PartidaLobbyDto }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <Botao onClick={() => setAberta(true)}>Convidar quem está online</Botao>
      {aberta && <JanelaDeOnline lobby={lobby} onFechar={() => setAberta(false)} />}
    </>
  );
}
