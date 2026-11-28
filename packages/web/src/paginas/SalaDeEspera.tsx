// Sala de espera de uma partida que aguarda jogadores: participantes, cores, convite,
// parâmetros e início. O servidor decide tudo; aqui só se desabilita o que ele recusaria.
import { CORES, type CorId, IDS_CORES, MAXIMO_JOGADORES, MINIMO_JOGADORES } from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";
import { useState } from "react";
import { useNavigate } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { NomeComAvatar } from "../componentes/Avatar";
import { Aviso, Botao, Cartao, CorJogador, Presenca, TituloDaTela } from "../componentes/basicos";
import { ConvidarOnline } from "../componentes/ConvidarOnline";
import { Confirmar } from "../componentes/JanelaPopup";
import { usePartidas } from "../stores/partidas";
import { TONS } from "../ui/cores";
import { ParametrosPartida } from "./ParametrosPartida";
import type { EstadoAviso } from "./Partidas";

interface Props {
  lobby: PartidaLobbyDto;
  presenca: string[];
  usuarioId: string;
}

// Roda uma operação da API com indicador de "ocupado" e mensagem de erro.
function useOperacao() {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const executar = (nome: string, operacao: () => Promise<unknown>) => {
    setOcupado(nome);
    setErro(null);
    operacao()
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setOcupado(null));
  };
  return { ocupado, erro, executar };
}

function Participantes({ lobby, presenca, usuarioId }: Props) {
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const { ocupado, erro, executar } = useOperacao();
  const souAnfitriao = lobby.anfitriao.id === usuarioId;

  const adicionarRobo = () =>
    executar("robo", async () => gravarLobby(await apiPartidas.adicionarRobo(lobby.id)));
  const corDoRobo = (roboId: string, cor: CorId) =>
    executar(`cor:${roboId}`, async () =>
      gravarLobby(await apiPartidas.escolherCorDoRobo(lobby.id, roboId, cor)),
    );
  const livres = (atual: CorId | null) =>
    IDS_CORES.filter((c) => c === atual || !lobby.participantes.some((p) => p.cor === c));

  // Pessoa a remover, à espera da confirmação (robô sai direto).
  const [removendo, setRemovendo] = useState<{ id: string; nome: string } | null>(null);
  const remover = (alvoId: string) =>
    executar(`remover:${alvoId}`, async () =>
      gravarLobby(await apiPartidas.remover(lobby.id, alvoId)),
    );

  return (
    <Cartao titulo={`Jogadores (${lobby.participantes.length} de ${MAXIMO_JOGADORES})`}>
      <ul className="space-y-espaco-3">
        {lobby.participantes.map((p) => {
          const online = presenca.includes(p.usuarioId);
          return (
            <li key={p.usuarioId} className="flex flex-wrap items-center gap-espaco-5">
              <CorJogador cor={p.cor} />
              <NomeComAvatar
                usuarioId={p.usuarioId}
                avatar={p.avatar}
                nome={p.usuarioId === usuarioId ? `${p.nome} (você)` : p.nome}
                className={p.usuarioId === usuarioId ? "font-bold" : ""}
              />
              {p.anfitriao && <span className="tag">anfitrião</span>}
              {p.robo && <span className="tag">robô</span>}
              {p.cor === null && !p.robo && <span className="dica">escolhendo cor…</span>}
              {p.robo && souAnfitriao ? (
                <select
                  className="campo ml-auto"
                  aria-label={`Cor de ${p.nome}`}
                  value={p.cor ?? ""}
                  disabled={ocupado !== null}
                  onChange={(e) => {
                    const cor = IDS_CORES.find((c) => c === e.target.value);
                    if (cor) corDoRobo(p.usuarioId, cor);
                  }}
                >
                  {p.cor === null && <option value="">sem cor</option>}
                  {livres(p.cor).map((c) => (
                    <option key={c} value={c}>
                      {CORES[c].nome}
                    </option>
                  ))}
                </select>
              ) : p.robo ? (
                <span className="dica ml-auto">{p.cor ? CORES[p.cor].nome : "sem cor"}</span>
              ) : (
                <span className="ml-auto">
                  <Presenca online={online} textos={["na sala", "fora da sala"]} />
                </span>
              )}
              {souAnfitriao && !p.anfitriao && (
                <button
                  type="button"
                  className="link dica"
                  disabled={ocupado !== null}
                  onClick={() =>
                    p.robo ? remover(p.usuarioId) : setRemovendo({ id: p.usuarioId, nome: p.nome })
                  }
                >
                  remover
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {souAnfitriao && lobby.participantes.length < MAXIMO_JOGADORES && (
        <div className="mt-espaco-5 flex flex-wrap items-center gap-espaco-5">
          <Botao ocupado={ocupado === "robo"} disabled={ocupado !== null} onClick={adicionarRobo}>
            Adicionar robô
          </Botao>
          <span className="dica">O servidor joga por ele.</span>
        </div>
      )}
      {erro && (
        <div className="mt-espaco-5">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {removendo && (
        <Confirmar
          titulo="Remover jogador"
          rotulo="Remover"
          acao={() => remover(removendo.id)}
          onFechar={() => setRemovendo(null)}
        >
          Remover <b>{removendo.nome}</b> da partida?
        </Confirmar>
      )}
    </Cartao>
  );
}

function EscolhaDeCor({ lobby, usuarioId }: Omit<Props, "presenca">) {
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const { ocupado, erro, executar } = useOperacao();
  const minha = lobby.participantes.find((p) => p.usuarioId === usuarioId)?.cor ?? null;
  const donoDa = (cor: CorId) => lobby.participantes.find((p) => p.cor === cor);

  return (
    <Cartao titulo="Sua cor">
      <div className="flex flex-wrap gap-espaco-2">
        {IDS_CORES.map((cor) => {
          const dono = donoDa(cor);
          const ocupada = dono !== undefined && dono.usuarioId !== usuarioId;
          const escolhida = cor === minha;
          return (
            <button
              key={cor}
              type="button"
              disabled={ocupada || escolhida || ocupado !== null}
              onClick={() =>
                executar(cor, async () => gravarLobby(await apiPartidas.escolherCor(lobby.id, cor)))
              }
              title={ocupada ? `escolhida por ${dono.nome}` : CORES[cor].nome}
              className={`min-w-20 rounded-raio-sm border-2 px-espaco-4 py-espaco-2 font-bold ${
                escolhida
                  ? "border-accent outline-2 outline-offset-2 outline-accent"
                  : "border-[#888] hover:border-accent"
              } ${ocupada ? "cursor-default opacity-(--opacidade-esmaecido) hover:border-[#888]" : "cursor-pointer"}`}
              style={{ backgroundColor: TONS[cor].fundo, color: TONS[cor].texto }}
            >
              {CORES[cor].nome}
              {ocupada && <span className="block text-etiqueta font-normal">{dono.nome}</span>}
            </button>
          );
        })}
      </div>
      {erro && (
        <div className="mt-espaco-5">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </Cartao>
  );
}

function ConviteDaPartida({ lobby }: { lobby: PartidaLobbyDto }) {
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const { ocupado, erro, executar } = useOperacao();
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  if (!lobby.convite) return null;
  const link = lobby.convite;

  const copiar = () => {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => window.prompt("Copie o link do convite:", link));
  };

  const renovar = () =>
    executar("renovar", async () => gravarLobby(await apiPartidas.renovarConvite(lobby.id)));

  return (
    <Cartao titulo="Convite">
      {lobby.participantes.length < MAXIMO_JOGADORES && (
        <div className="mb-espaco-7 flex flex-wrap items-center gap-espaco-5">
          <ConvidarOnline lobby={lobby} />
          <span className="dica">O convite aparece na tela de quem está com o jogo aberto.</span>
        </div>
      )}
      <p className="mb-espaco-3">Ou envie este link aos amigos. Ele vale até a partida começar.</p>
      <div className="flex flex-col gap-espaco-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="campo flex-1 font-mono text-dica"
        />
        <Botao onClick={copiar}>{copiado ? "Copiado!" : "Copiar"}</Botao>
        <Botao ocupado={ocupado === "renovar"} onClick={() => setConfirmando(true)}>
          Gerar novo link
        </Botao>
      </div>
      {erro && (
        <div className="mt-espaco-5">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {confirmando && (
        <Confirmar
          titulo="Gerar novo link"
          rotulo="Gerar novo link"
          acao={renovar}
          onFechar={() => setConfirmando(false)}
        >
          O link atual deixa de funcionar.
        </Confirmar>
      )}
    </Cartao>
  );
}

// O que ainda impede o início (o servidor confere de novo).
function pendenciasParaIniciar(lobby: PartidaLobbyDto): string[] {
  const pendencias: string[] = [];
  const total = lobby.participantes.length;
  if (total < MINIMO_JOGADORES) {
    pendencias.push(`faltam jogadores: mínimo de ${MINIMO_JOGADORES}, há ${total}`);
  }
  if (total > MAXIMO_JOGADORES) pendencias.push(`máximo de ${MAXIMO_JOGADORES} jogadores`);
  const semCor = lobby.participantes.filter((p) => p.cor === null).map((p) => p.nome);
  if (semCor.length > 0) pendencias.push(`sem cor: ${semCor.join(", ")}`);
  return pendencias;
}

function Comandos({ lobby, usuarioId }: Omit<Props, "presenca">) {
  const navegar = useNavigate();
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const { ocupado, erro, executar } = useOperacao();
  const souAnfitriao = lobby.anfitriao.id === usuarioId;
  const pendencias = pendenciasParaIniciar(lobby);
  const [confirmando, setConfirmando] = useState<"cancelar" | "sair" | null>(null);

  const voltar = (aviso: string) => {
    const estado: EstadoAviso = { aviso };
    void navegar("/partidas", { replace: true, state: estado });
  };

  const iniciar = () =>
    executar("iniciar", async () => gravarLobby(await apiPartidas.iniciar(lobby.id)));
  const cancelar = () =>
    executar("cancelar", async () => {
      await apiPartidas.cancelar(lobby.id);
      voltar("Partida cancelada.");
    });
  const sair = () =>
    executar("sair", async () => {
      await apiPartidas.sair(lobby.id);
      voltar("Você saiu da partida.");
    });

  return (
    <Cartao>
      {souAnfitriao ? (
        <div className="space-y-espaco-5">
          <div className="flex flex-wrap gap-espaco-2">
            <Botao
              ocupado={ocupado === "iniciar"}
              disabled={pendencias.length > 0 || ocupado !== null}
              onClick={iniciar}
            >
              Iniciar partida
            </Botao>
            <Botao
              ocupado={ocupado === "cancelar"}
              disabled={ocupado !== null}
              onClick={() => setConfirmando("cancelar")}
            >
              Cancelar partida
            </Botao>
          </div>
          {pendencias.length > 0 && (
            <ul className="dica list-inside list-disc">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-espaco-5">
          <p className="flex flex-wrap items-center gap-espaco-2">
            Aguardando
            <NomeComAvatar
              usuarioId={lobby.anfitriao.id}
              avatar={lobby.anfitriao.avatar}
              nome={lobby.anfitriao.nome}
            />
            iniciar a partida.
          </p>
          <Botao
            ocupado={ocupado === "sair"}
            onClick={() => setConfirmando("sair")}
            className="ml-auto"
          >
            Sair da partida
          </Botao>
        </div>
      )}
      {erro && (
        <div className="mt-espaco-5">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      {confirmando === "cancelar" && (
        <Confirmar
          titulo="Cancelar partida"
          rotulo="Cancelar partida"
          acao={cancelar}
          onFechar={() => setConfirmando(null)}
        >
          A partida some da lista de todos.
        </Confirmar>
      )}
      {confirmando === "sair" && (
        <Confirmar
          titulo="Sair da partida"
          rotulo="Sair da partida"
          acao={sair}
          onFechar={() => setConfirmando(null)}
        >
          Sair desta partida?
        </Confirmar>
      )}
    </Cartao>
  );
}

export function SalaDeEspera(props: Props) {
  const { lobby, usuarioId } = props;
  const souAnfitriao = lobby.anfitriao.id === usuarioId;
  return (
    <div className="space-y-espaco-8">
      <TituloDaTela
        titulo={lobby.nome}
        apoio={`Sala de espera · anfitrião: ${lobby.anfitriao.nome}`}
      />
      <div className="grid gap-espaco-8 md:grid-cols-2">
        <Participantes {...props} />
        <EscolhaDeCor lobby={lobby} usuarioId={usuarioId} />
      </div>
      {souAnfitriao && <ConviteDaPartida lobby={lobby} />}
      <Comandos lobby={lobby} usuarioId={usuarioId} />
      <ParametrosPartida lobby={lobby} editavel={souAnfitriao} />
    </div>
  );
}
