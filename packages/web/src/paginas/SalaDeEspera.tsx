// Sala de espera de uma partida que aguarda jogadores: participantes, cores, convite,
// parâmetros e início. O servidor decide tudo; aqui só se desabilita o que ele recusaria.
import { CORES, type CorId, IDS_CORES, MAXIMO_JOGADORES, MINIMO_JOGADORES } from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";
import { useState } from "react";
import { useNavigate } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { Aviso, Botao, Cartao, CorJogador } from "../componentes/basicos";
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

  const remover = (alvoId: string, nome: string) => {
    if (!window.confirm(`Remover ${nome} da partida?`)) return;
    executar(`remover:${alvoId}`, async () =>
      gravarLobby(await apiPartidas.remover(lobby.id, alvoId)),
    );
  };

  return (
    <Cartao titulo={`Jogadores (${lobby.participantes.length} de ${MAXIMO_JOGADORES})`}>
      <ul className="space-y-2">
        {lobby.participantes.map((p) => {
          const online = presenca.includes(p.usuarioId);
          return (
            <li key={p.usuarioId} className="flex items-center gap-3">
              <span
                title={online ? "na sala" : "fora da sala"}
                className={`inline-block h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-slate-600"}`}
              />
              <CorJogador cor={p.cor} />
              <span className={p.usuarioId === usuarioId ? "font-semibold" : ""}>
                {p.nome}
                {p.usuarioId === usuarioId && " (você)"}
              </span>
              {p.anfitriao && (
                <span className="rounded bg-amber-500/20 px-1.5 text-xs text-amber-300">
                  anfitrião
                </span>
              )}
              {p.cor === null && <span className="text-xs text-slate-500">escolhendo cor…</span>}
              {souAnfitriao && !p.anfitriao && (
                <button
                  type="button"
                  className="ml-auto text-xs text-slate-400 hover:text-red-400 disabled:opacity-50"
                  disabled={ocupado !== null}
                  onClick={() => remover(p.usuarioId, p.nome)}
                >
                  remover
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {erro && (
        <div className="mt-3">
          <Aviso>{erro}</Aviso>
        </div>
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
      <div className="flex flex-wrap gap-2">
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
              className={`rounded px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${
                escolhida ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-800" : ""
              } ${ocupada ? "opacity-30" : "hover:brightness-110"}`}
              style={{ backgroundColor: TONS[cor].fundo, color: TONS[cor].texto }}
            >
              {CORES[cor].nome}
              {ocupada && <span className="block text-[10px] font-normal">{dono.nome}</span>}
            </button>
          );
        })}
      </div>
      {erro && (
        <div className="mt-3">
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

  const renovar = () => {
    if (!window.confirm("Gerar um novo link? O link atual deixa de funcionar.")) return;
    executar("renovar", async () => gravarLobby(await apiPartidas.renovarConvite(lobby.id)));
  };

  return (
    <Cartao titulo="Convite">
      <p className="mb-2 text-sm text-slate-300">
        Envie este link aos amigos. Ele vale até a partida começar.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="flex-1 rounded border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300"
        />
        <Botao onClick={copiar}>{copiado ? "Copiado!" : "Copiar"}</Botao>
        <Botao variante="secundario" ocupado={ocupado === "renovar"} onClick={renovar}>
          Gerar novo link
        </Botao>
      </div>
      {erro && (
        <div className="mt-3">
          <Aviso>{erro}</Aviso>
        </div>
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

  const voltar = (aviso: string) => {
    const estado: EstadoAviso = { aviso };
    void navegar("/partidas", { replace: true, state: estado });
  };

  const iniciar = () =>
    executar("iniciar", async () => gravarLobby(await apiPartidas.iniciar(lobby.id)));
  const cancelar = () => {
    if (!window.confirm("Cancelar a partida? Ela some da lista de todos.")) return;
    executar("cancelar", async () => {
      await apiPartidas.cancelar(lobby.id);
      voltar("Partida cancelada.");
    });
  };
  const sair = () => {
    if (!window.confirm("Sair desta partida?")) return;
    executar("sair", async () => {
      await apiPartidas.sair(lobby.id);
      voltar("Você saiu da partida.");
    });
  };

  return (
    <Cartao>
      {souAnfitriao ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Botao
              ocupado={ocupado === "iniciar"}
              disabled={pendencias.length > 0 || ocupado !== null}
              onClick={iniciar}
            >
              Iniciar partida
            </Botao>
            <Botao
              variante="perigo"
              ocupado={ocupado === "cancelar"}
              disabled={ocupado !== null}
              onClick={cancelar}
            >
              Cancelar partida
            </Botao>
          </div>
          {pendencias.length > 0 && (
            <ul className="list-inside list-disc text-sm text-slate-400">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-300">
            Aguardando {lobby.anfitriao.nome} iniciar a partida.
          </p>
          <Botao
            variante="secundario"
            ocupado={ocupado === "sair"}
            onClick={sair}
            className="ml-auto"
          >
            Sair da partida
          </Botao>
        </div>
      )}
      {erro && (
        <div className="mt-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </Cartao>
  );
}

export function SalaDeEspera(props: Props) {
  const { lobby, usuarioId } = props;
  const souAnfitriao = lobby.anfitriao.id === usuarioId;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{lobby.nome}</h1>
        <p className="text-sm text-slate-400">Sala de espera · anfitrião: {lobby.anfitriao.nome}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Participantes {...props} />
        <EscolhaDeCor lobby={lobby} usuarioId={usuarioId} />
      </div>
      {souAnfitriao && <ConviteDaPartida lobby={lobby} />}
      <Comandos lobby={lobby} usuarioId={usuarioId} />
      <ParametrosPartida lobby={lobby} editavel={souAnfitriao} />
    </div>
  );
}
