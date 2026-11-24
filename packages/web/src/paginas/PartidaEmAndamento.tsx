// Painel provisório da partida iniciada (o tabuleiro chega na etapa 9): mostra a mesa e confirma
// que a visão do jogo está chegando pelo socket.
import type { Fase } from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";
import {
  Aviso,
  Cartao,
  Carregando,
  CorJogador,
  Presenca,
  TituloDaTela,
} from "../componentes/basicos";
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
    <div className="space-y-espaco-8">
      <TituloDaTela
        titulo={lobby.nome}
        apoio={lobby.status === "encerrada" ? "Partida encerrada" : "Partida em andamento"}
      />

      <Aviso tipo="info">O tabuleiro chega na próxima etapa (9). Por ora, só a mesa.</Aviso>

      <Cartao titulo="Mesa">
        <ol className="space-y-espaco-3">
          {lobby.participantes.map((p) => {
            const online = presenca.includes(p.usuarioId);
            return (
              <li key={p.usuarioId} className="flex flex-wrap items-center gap-espaco-5">
                <span className="w-5 text-right text-muted tabular-nums">
                  {(p.assento ?? 0) + 1}.
                </span>
                <CorJogador cor={p.cor} />
                <span>{p.nome}</span>
                {p.usuarioId === daVez && !vencedor && <span className="tag">na vez</span>}
                {p.usuarioId === vencedor && <span className="tag">vencedor</span>}
                <span className="ml-auto">
                  <Presenca online={online} textos={["acompanhando", "fora"]} />
                </span>
              </li>
            );
          })}
        </ol>
      </Cartao>

      <Cartao titulo="Estado recebido">
        {!jogo || !visao ? (
          <Carregando texto="Aguardando o estado do jogo…" />
        ) : (
          <dl className="grid grid-cols-2 gap-x-espaco-8 gap-y-espaco-1 sm:grid-cols-4">
            <dt className="text-muted">Sequência</dt>
            <dd>{jogo.seq}</dd>
            <dt className="text-muted">Rodada</dt>
            <dd>{visao.rodada}</dd>
            <dt className="text-muted">Fase</dt>
            <dd>{NOMES_FASES[visao.fase]}</dd>
            <dt className="text-muted">Vez de</dt>
            <dd>{daVez ? nomeDe(daVez) : "—"}</dd>
          </dl>
        )}
      </Cartao>
    </div>
  );
}
