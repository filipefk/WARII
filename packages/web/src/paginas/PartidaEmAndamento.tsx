// Painel provisório da partida iniciada (o tabuleiro chega na etapa 9): mostra a mesa e confirma
// que a visão do jogo está chegando pelo socket.
import type { Fase } from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";
import { Aviso, Cartao, Carregando, CorJogador } from "../componentes/basicos";
import type { JogoRecebido } from "../stores/partidas";

const NOMES_FASES: Record<Fase, string> = {
  PREP_ESCOLHA_5J: "preparação (escolha com 5 jogadores)",
  PREP_OCUPACAO: "preparação (ocupação)",
  RECEBER: "recebimento",
  ATACAR: "ataque",
  DESLOCAR: "deslocamento",
  FIM: "fim de jogo",
};

export function PartidaEmAndamento({
  lobby,
  presenca,
  jogo,
}: {
  lobby: PartidaLobbyDto;
  presenca: string[];
  jogo: JogoRecebido | null;
}) {
  const visao = jogo?.visao;
  const daVez = visao?.jogadores[visao.vez]?.id;
  const vencedor = visao?.vencedor ?? null;
  const nomeDe = (id: string) => lobby.participantes.find((p) => p.usuarioId === id)?.nome ?? "?";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{lobby.nome}</h1>
        <p className="text-sm text-slate-400">
          {lobby.status === "encerrada" ? "Partida encerrada" : "Partida em andamento"}
        </p>
      </div>

      <Aviso tipo="info">O tabuleiro chega na próxima etapa (9). Por ora, só a mesa.</Aviso>

      <Cartao titulo="Mesa">
        <ol className="space-y-2">
          {lobby.participantes.map((p) => {
            const online = presenca.includes(p.usuarioId);
            return (
              <li key={p.usuarioId} className="flex items-center gap-3">
                <span className="w-5 text-right text-sm text-slate-500">
                  {(p.assento ?? 0) + 1}.
                </span>
                <span
                  title={online ? "acompanhando" : "fora"}
                  className={`inline-block h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-slate-600"}`}
                />
                <CorJogador cor={p.cor} />
                <span>{p.nome}</span>
                {p.usuarioId === daVez && !vencedor && (
                  <span className="rounded bg-amber-500/20 px-1.5 text-xs text-amber-300">
                    na vez
                  </span>
                )}
                {p.usuarioId === vencedor && (
                  <span className="rounded bg-emerald-500/20 px-1.5 text-xs text-emerald-300">
                    vencedor
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </Cartao>

      <Cartao titulo="Estado recebido">
        {!jogo || !visao ? (
          <Carregando texto="aguardando o estado do jogo…" />
        ) : (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <dt className="text-slate-400">Sequência</dt>
            <dd>{jogo.seq}</dd>
            <dt className="text-slate-400">Rodada</dt>
            <dd>{visao.rodada}</dd>
            <dt className="text-slate-400">Fase</dt>
            <dd>{NOMES_FASES[visao.fase]}</dd>
            <dt className="text-slate-400">Vez de</dt>
            <dd>{daVez ? nomeDe(daVez) : "—"}</dd>
          </dl>
        )}
      </Cartao>
    </div>
  );
}
