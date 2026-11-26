// Todas as partidas, de qualquer status: encerrar (a que aguarda é cancelada; a em andamento
// termina sem vencedor) e apagar (some com o log inteiro).
import type { PartidaAdminDto, StatusPartida } from "@warii/shared";
import { useCallback, useEffect, useState } from "react";
import { apiAdmin } from "../../api/admin";
import { mensagemDoErro } from "../../api/cliente";
import { Aviso, Botao, Carregando, Cartao } from "../../componentes/basicos";
import { Abas } from "../../componentes/Modal";
import { Confirmar, formatoData } from "./Admin";

type Filtro = StatusPartida | "todas";

const ORDEM: StatusPartida[] = ["em_andamento", "aguardando", "encerrada", "cancelada"];

const NOMES: Record<StatusPartida, string> = {
  em_andamento: "Em andamento",
  aguardando: "Aguardando jogadores",
  encerrada: "Encerradas",
  cancelada: "Canceladas",
};

const SITUACAO: Record<StatusPartida, string> = {
  em_andamento: "em andamento",
  aguardando: "aguardando jogadores",
  encerrada: "encerrada",
  cancelada: "cancelada",
};

type Janela = { tipo: "encerrar" | "apagar"; partida: PartidaAdminDto };

function LinhaPartida({
  partida,
  abrir,
}: {
  partida: PartidaAdminDto;
  abrir: (janela: Janela) => void;
}) {
  const aberta = partida.status === "aguardando" || partida.status === "em_andamento";
  const fim = partida.encerradaEm ?? null;
  return (
    <li className="rounded-raio-md border border-border bg-panel-2 px-espaco-4 py-espaco-3">
      <div className="flex flex-wrap items-center gap-x-espaco-7 gap-y-espaco-1">
        <span className="text-destaque">{partida.nome}</span>
        <span className="tag">{SITUACAO[partida.status]}</span>
        <span className="text-muted">anfitrião: {partida.anfitriao.nome}</span>
        {partida.status === "encerrada" && (
          <span className="text-muted">
            {partida.vencedor ? `vencedor: ${partida.vencedor.nome}` : "sem vencedor"}
          </span>
        )}
        <span className="dica ml-auto tabular-nums">
          criada {formatoData.format(new Date(partida.criadaEm))}
          {fim && ` · fim ${formatoData.format(new Date(fim))}`}
        </span>
      </div>
      <p className="dica mt-espaco-1">
        {partida.participantes.map((p) => (p.robo ? `${p.nome} (robô)` : p.nome)).join(", ")}
        {partida.seq > 0 && ` · ${partida.seq} ${partida.seq === 1 ? "ação" : "ações"} no log`}
      </p>
      <div className="mt-espaco-3 flex flex-wrap gap-espaco-2">
        {aberta && (
          <Botao onClick={() => abrir({ tipo: "encerrar", partida })}>
            {partida.status === "aguardando" ? "Cancelar partida" : "Encerrar partida"}
          </Botao>
        )}
        <Botao onClick={() => abrir({ tipo: "apagar", partida })}>Apagar</Botao>
      </div>
    </li>
  );
}

export function AdminPartidas() {
  const [lista, setLista] = useState<PartidaAdminDto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [janela, setJanela] = useState<Janela | null>(null);

  const carregar = useCallback(
    () =>
      apiAdmin
        .listarPartidas()
        .then(setLista)
        .catch((falha: unknown) => setErro(mensagemDoErro(falha))),
    [],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const contar = (s: StatusPartida) => lista?.filter((p) => p.status === s).length ?? 0;
  const abas: { id: Filtro; rotulo: string }[] = [
    { id: "todas", rotulo: `Todas (${lista?.length ?? 0})` },
    ...ORDEM.map((s) => ({
      id: s,
      rotulo: `${NOMES[s]} (${contar(s)})`,
    })),
  ];
  const visiveis = lista?.filter((p) => filtro === "todas" || p.status === filtro) ?? [];

  return (
    <div className="space-y-espaco-8">
      {erro && <Aviso>{erro}</Aviso>}
      {!lista && !erro && <Carregando />}
      {lista && (
        <Cartao titulo="Partidas">
          <div className="mb-espaco-5">
            <Abas abas={abas} ativa={filtro} onEscolher={setFiltro} />
          </div>
          {visiveis.length === 0 ? (
            <p className="text-muted">Nenhuma partida aqui.</p>
          ) : (
            <ul className="space-y-espaco-2">
              {visiveis.map((p) => (
                <LinhaPartida key={p.id} partida={p} abrir={setJanela} />
              ))}
            </ul>
          )}
        </Cartao>
      )}

      {janela?.tipo === "encerrar" && (
        <Confirmar
          titulo={
            janela.partida.status === "aguardando"
              ? `Cancelar ${janela.partida.nome}`
              : `Encerrar ${janela.partida.nome}`
          }
          rotulo={janela.partida.status === "aguardando" ? "Cancelar partida" : "Encerrar partida"}
          onFechar={() => setJanela(null)}
          acao={async () => {
            await apiAdmin.encerrarPartida(janela.partida.id);
            await carregar();
          }}
        >
          {janela.partida.status === "aguardando"
            ? "A sala de espera fecha e o convite deixa de valer. Os participantes são avisados."
            : "A partida termina agora, sem vencedor. Os jogadores continuam vendo o tabuleiro, mas não jogam mais."}
        </Confirmar>
      )}
      {janela?.tipo === "apagar" && (
        <Confirmar
          titulo={`Apagar ${janela.partida.nome}`}
          rotulo="Apagar partida"
          onFechar={() => setJanela(null)}
          acao={async () => {
            await apiAdmin.apagarPartida(janela.partida.id);
            setLista((atual) => (atual ?? []).filter((p) => p.id !== janela.partida.id));
          }}
        >
          A partida <b>{janela.partida.nome}</b> será apagada com todo o log, sem como desfazer.
          Quem estiver nela volta para a lista de partidas.
        </Confirmar>
      )}
    </div>
  );
}
