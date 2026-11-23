// Partidas de que o usuário participa e criação de uma nova.
import { CriarPartidaEntrada, type PartidaResumoDto, type StatusPartida } from "@warii/shared";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { Aviso, Botao, Campo, Carregando, Cartao } from "../componentes/basicos";
import { usePartidas } from "../stores/partidas";

export interface EstadoAviso {
  aviso?: string;
}

// Lê o aviso deixado por quem navegou para cá (o `state` do histórico é desconhecido).
function avisoDoEstado(estado: unknown): string | undefined {
  if (typeof estado !== "object" || estado === null) return undefined;
  const aviso: unknown = Reflect.get(estado, "aviso");
  return typeof aviso === "string" ? aviso : undefined;
}

const GRUPOS: { status: StatusPartida; titulo: string }[] = [
  { status: "em_andamento", titulo: "Em andamento" },
  { status: "aguardando", titulo: "Aguardando jogadores" },
  { status: "encerrada", titulo: "Encerradas" },
];

const formatoData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function NovaPartida() {
  const navegar = useNavigate();
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    const entrada = CriarPartidaEntrada.safeParse({ nome });
    if (!entrada.success) {
      setErro(entrada.error.issues[0]?.message ?? "dados inválidos");
      return;
    }
    setErro(null);
    setEnviando(true);
    apiPartidas
      .criar(entrada.data.nome)
      .then((lobby) => {
        gravarLobby(lobby);
        void navegar(`/partidas/${lobby.id}`);
      })
      .catch((falha: unknown) => {
        setErro(mensagemDoErro(falha));
        setEnviando(false);
      });
  };

  return (
    <Cartao titulo="Nova partida">
      <form onSubmit={aoEnviar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Campo
            rotulo="Nome da partida"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Sexta à noite"
          />
        </div>
        <Botao type="submit" ocupado={enviando}>
          Criar
        </Botao>
      </form>
      {erro && (
        <div className="mt-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </Cartao>
  );
}

function LinhaPartida({ partida }: { partida: PartidaResumoDto }) {
  const quando = partida.iniciadaEm ?? partida.criadaEm;
  return (
    <li>
      <Link
        to={`/partidas/${partida.id}`}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded px-3 py-2 hover:bg-slate-700/60"
      >
        <span className="font-semibold">{partida.nome}</span>
        <span className="text-sm text-slate-400">anfitrião: {partida.anfitriao.nome}</span>
        <span className="text-sm text-slate-400">
          {partida.quantidadeParticipantes}{" "}
          {partida.quantidadeParticipantes === 1 ? "jogador" : "jogadores"}
        </span>
        <span className="ml-auto text-xs text-slate-500">{formatoData.format(new Date(quando))}</span>
      </Link>
    </li>
  );
}

export function Partidas() {
  const local = useLocation();
  const aviso = avisoDoEstado(local.state);
  const [lista, setLista] = useState<PartidaResumoDto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    apiPartidas
      .listar()
      .then((partidas) => ativo && setLista(partidas))
      .catch((falha: unknown) => ativo && setErro(mensagemDoErro(falha)));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {aviso && <Aviso tipo="info">{aviso}</Aviso>}
      <NovaPartida />
      {erro && <Aviso>{erro}</Aviso>}
      {!lista && !erro && <Carregando />}
      {lista && lista.length === 0 && (
        <p className="text-slate-400">
          Você ainda não está em nenhuma partida. Crie uma ou peça um convite a um amigo.
        </p>
      )}
      {lista &&
        GRUPOS.map(({ status, titulo }) => {
          const doGrupo = lista.filter((p) => p.status === status);
          if (doGrupo.length === 0) return null;
          return (
            <Cartao key={status} titulo={titulo}>
              <ul className="-mx-3 divide-y divide-slate-700/60">
                {doGrupo.map((p) => (
                  <LinhaPartida key={p.id} partida={p} />
                ))}
              </ul>
            </Cartao>
          );
        })}
    </div>
  );
}
