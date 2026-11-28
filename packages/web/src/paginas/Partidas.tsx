// Criação de uma partida (pública ou privada), as públicas abertas a todos e as partidas de que o
// usuário participa; à direita, quem está online.
import { CriarPartidaEntrada, type PartidaResumoDto, type StatusPartida } from "@warii/shared";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { apiPartidas } from "../api/partidas";
import { NomeComAvatar } from "../componentes/Avatar";
import { Aviso, Botao, Campo, Carregando, Cartao } from "../componentes/basicos";
import { JanelaPopup } from "../componentes/JanelaPopup";
import { JogadoresOnline } from "../componentes/JogadoresOnline";
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

const TIPOS_DE_PARTIDA: { publica: boolean; rotulo: string; dica: string }[] = [
  { publica: false, rotulo: "Privada", dica: "Só entra quem receber o convite do anfitrião." },
  {
    publica: true,
    rotulo: "Pública",
    dica: "Aparece na tela de partidas de todos e qualquer um pode entrar para jogar.",
  },
];

function FormularioNovaPartida({ onFechar }: { onFechar: () => void }) {
  const navegar = useNavigate();
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const [nome, setNome] = useState("");
  const [publica, setPublica] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    const entrada = CriarPartidaEntrada.safeParse({ nome, publica });
    if (!entrada.success) {
      setErro(entrada.error.issues[0]?.message ?? "dados inválidos");
      return;
    }
    setErro(null);
    setEnviando(true);
    apiPartidas
      .criar(entrada.data.nome, entrada.data.publica)
      .then((lobby) => {
        gravarLobby(lobby);
        void navegar(`/partidas/${lobby.id}`);
      })
      .catch((falha: unknown) => {
        setErro(mensagemDoErro(falha));
        setEnviando(false);
      });
  };

  const escolhido = TIPOS_DE_PARTIDA.find((t) => t.publica === publica);
  return (
    <JanelaPopup titulo="Nova partida" onEsc={onFechar}>
      <form onSubmit={aoEnviar} className="space-y-espaco-7">
        <Campo
          rotulo="Nome da partida"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Sexta à noite"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- a janela abre para digitar o nome
          autoFocus
        />
        <div>
          <span className="mb-espaco-1 block">Tipo da partida</span>
          <div role="radiogroup" aria-label="Tipo da partida" className="flex gap-espaco-2">
            {TIPOS_DE_PARTIDA.map((tipo) => (
              <Botao
                key={tipo.rotulo}
                role="radio"
                aria-checked={tipo.publica === publica}
                ativo={tipo.publica === publica}
                onClick={() => setPublica(tipo.publica)}
              >
                {tipo.rotulo}
              </Botao>
            ))}
          </div>
          {escolhido && <span className="dica mt-espaco-1 block">{escolhido.dica}</span>}
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-wrap gap-espaco-2">
          <Botao type="submit" ocupado={enviando}>
            Criar
          </Botao>
          <Botao onClick={onFechar}>Cancelar</Botao>
        </div>
      </form>
    </JanelaPopup>
  );
}

// Botão em destaque (borda e texto accent, maior que os outros) que abre o formulário.
function NovaPartida() {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <Botao
        className="border-accent px-espaco-7 py-espaco-4 text-destaque text-accent"
        onClick={() => setAberto(true)}
      >
        Criar nova partida
      </Botao>
      {aberto && <FormularioNovaPartida onFechar={() => setAberto(false)} />}
    </div>
  );
}

function DadosDaPartida({ partida }: { partida: PartidaResumoDto }) {
  return (
    <>
      <span className="text-destaque">{partida.nome}</span>
      <span className="inline-flex items-center gap-espaco-2 text-muted">
        anfitrião:
        <NomeComAvatar
          usuarioId={partida.anfitriao.id}
          avatar={partida.anfitriao.avatar}
          nome={partida.anfitriao.nome}
        />
      </span>
      <span className="text-muted">
        {partida.quantidadeParticipantes}{" "}
        {partida.quantidadeParticipantes === 1 ? "jogador" : "jogadores"}
      </span>
    </>
  );
}

const INTERVALO_PUBLICAS_MS = 10_000;

// Partidas públicas aguardando jogadores, com vaga, em que o usuário ainda não está; atualizada a
// cada 10 s. "Entrar" põe o usuário na sala de espera sem convite.
function PartidasPublicas() {
  const navegar = useNavigate();
  const gravarLobby = usePartidas((s) => s.gravarLobby);
  const [lista, setLista] = useState<PartidaResumoDto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const buscar = () => {
      apiPartidas
        .publicas()
        .then((partidas) => ativo && setLista(partidas))
        .catch((falha: unknown) => ativo && setErro(mensagemDoErro(falha)));
    };
    buscar();
    const relogio = setInterval(buscar, INTERVALO_PUBLICAS_MS);
    return () => {
      ativo = false;
      clearInterval(relogio);
    };
  }, []);

  const entrar = (id: string) => {
    setErro(null);
    setEntrando(id);
    apiPartidas
      .entrarNaPublica(id)
      .then((lobby) => {
        gravarLobby(lobby);
        void navegar(`/partidas/${lobby.id}`);
      })
      .catch((falha: unknown) => {
        setErro(mensagemDoErro(falha));
        setEntrando(null);
        // A partida pode ter enchido, começado ou sido cancelada: atualiza a lista.
        apiPartidas
          .publicas()
          .then(setLista)
          .catch(() => undefined);
      });
  };

  return (
    <Cartao titulo="Partidas públicas">
      {!lista && !erro && <Carregando />}
      {lista && lista.length === 0 && (
        <p className="text-muted">Nenhuma partida pública aguardando jogadores agora.</p>
      )}
      {lista && lista.length > 0 && (
        <ul className="space-y-espaco-2">
          {lista.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-espaco-7 gap-y-espaco-1 rounded-raio-md border border-border bg-panel-2 px-espaco-4 py-espaco-3"
            >
              <DadosDaPartida partida={p} />
              <Botao
                className="ml-auto"
                ocupado={entrando === p.id}
                disabled={entrando !== null}
                onClick={() => entrar(p.id)}
              >
                Entrar
              </Botao>
            </li>
          ))}
        </ul>
      )}
      {erro && (
        <div className="mt-espaco-5">
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
        className="flex flex-wrap items-center gap-x-espaco-7 gap-y-espaco-1 rounded-raio-md border border-border bg-panel-2 px-espaco-4 py-espaco-3 hover:border-accent"
      >
        <DadosDaPartida partida={partida} />
        {partida.status === "aguardando" && (
          <span className="dica">{partida.publica ? "pública" : "privada"}</span>
        )}
        <span className="dica ml-auto tabular-nums">{formatoData.format(new Date(quando))}</span>
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
    <div className="grid items-start gap-espaco-8 lg:grid-cols-[minmax(0,1fr)_240px]">
      <aside className="order-2">
        <JogadoresOnline />
      </aside>
      <div className="order-1 space-y-espaco-8">
        {aviso && <Aviso tipo="info">{aviso}</Aviso>}
        <NovaPartida />
        <PartidasPublicas />
        <Cartao titulo="Tabuleiro">
          <div className="flex flex-col gap-espaco-5 sm:flex-row sm:items-center">
            <p className="flex-1">
              Conheça o mapa, confira as fronteiras de cada território e leia as regras, as cartas e
              os dados antes de jogar.
            </p>
            <Link to="/tabuleiro" className="botao">
              Ver o tabuleiro
            </Link>
          </div>
        </Cartao>
        {erro && <Aviso>{erro}</Aviso>}
        {!lista && !erro && <Carregando />}
        {lista && lista.length === 0 && (
          <p className="text-muted">
            Você ainda não está em nenhuma partida. Crie uma, entre numa pública ou peça um convite
            a um amigo.
          </p>
        )}
        {lista &&
          GRUPOS.map(({ status, titulo }) => {
            const doGrupo = lista.filter((p) => p.status === status);
            if (doGrupo.length === 0) return null;
            return (
              <Cartao key={status} titulo={titulo}>
                <ul className="space-y-espaco-2">
                  {doGrupo.map((p) => (
                    <LinhaPartida key={p.id} partida={p} />
                  ))}
                </ul>
              </Cartao>
            );
          })}
      </div>
    </div>
  );
}
