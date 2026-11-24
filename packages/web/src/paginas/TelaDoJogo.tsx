// Tela da partida em andamento ou encerrada: o tabuleiro e o painel lateral (componentes
// Tabuleiro e InfoTerritorio do sistema). A visão vem do socket; a interação fica em useJogo.
import type { TerritorioId } from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";
import { useEffect, useMemo, useState } from "react";
import { Aviso, Carregando } from "../componentes/basicos";
import { InfoTerritorio } from "../componentes/jogo/InfoTerritorio";
import {
  Bloco,
  LogDaPartida,
  MeuObjetivo,
  MinhasCartas,
  PainelMesa,
  PainelRecebimento,
  PainelVez,
} from "../componentes/jogo/Paineis";
import { TabelaContinentes } from "../componentes/jogo/TabelaContinentes";
import { DefsDoJogo } from "../componentes/tabuleiro/DefsDoJogo";
import { Tabuleiro } from "../componentes/tabuleiro/Tabuleiro";
import { montarMesa } from "../jogo/mesa";
import { euSouDaVez } from "../jogo/previa";
import { carregarGeografia, type Geografia } from "../mapa/geografia";
import { chaveDaVez, useJogo } from "../stores/jogo";
import type { JogoRecebido } from "../stores/partidas";
import { NOMES_FASES } from "../ui/textosEventos";

function useGeografia(): { geografia: Geografia | null; erro: string | null } {
  const [geografia, setGeografia] = useState<Geografia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    carregarGeografia()
      .then((g) => ativo && setGeografia(g))
      .catch(() => ativo && setErro("Não foi possível carregar o mapa. Recarregue a página."));
    return () => {
      ativo = false;
    };
  }, []);
  return { geografia, erro };
}

interface Props {
  partidaId: string;
  lobby: PartidaLobbyDto;
  presenca: string[];
  jogo: JogoRecebido | null;
}

export function TelaDoJogo({ partidaId, lobby, presenca, jogo }: Props) {
  const { geografia, erro } = useGeografia();
  const selecionado = useJogo((s) => s.selecionado);
  const selecionar = useJogo((s) => s.selecionar);
  const cartasMarcadas = useJogo((s) => s.cartas);
  const abrirPartida = useJogo((s) => s.abrirPartida);
  const sincronizarVez = useJogo((s) => s.sincronizarVez);

  const visao = jogo?.visao;
  const seq = jogo?.seq;
  useEffect(() => {
    if (seq !== undefined) abrirPartida(partidaId, seq);
  }, [partidaId, seq, abrirPartida]);
  useEffect(() => {
    if (visao) sincronizarVez(chaveDaVez(visao.rodada, visao.vez, visao.etapaPrimeiraRodada));
  }, [visao, sincronizarVez]);

  const mesa = useMemo(() => (visao ? montarMesa(lobby, visao) : null), [lobby, visao]);

  if (erro) return <Aviso>{erro}</Aviso>;
  if (!visao || !mesa || !geografia || !jogo) return <Carregando texto="Carregando a partida…" />;

  const clicar = (t: TerritorioId | null) => selecionar(t === selecionado ? null : t);
  const daVez = mesa.jogadorDaVez;
  const minhaVez = euSouDaVez(visao);

  return (
    // No desktop a tela ocupa a altura da janela (menos o cabeçalho de ~60px e o respiro do
    // main): o mapa se ajusta ao espaço e o painel rola sozinho.
    <div className="flex flex-col overflow-hidden rounded-raio-tabuleiro border border-border bg-bg min-[861px]:h-[calc(100vh-84px)] min-[861px]:flex-row">
      <DefsDoJogo geografia={geografia} />
      <div className="h-[62vh] min-w-0 flex-1 min-[861px]:h-full">
        <Tabuleiro
          geografia={geografia}
          territorio={(t) => ({
            dono: mesa.cor(visao.territorios[t].dono),
            exercitos: visao.territorios[t].exercitos,
          })}
          bases={visao.jogadores.map((j) =>
            j.eliminado ? null : { dono: j.cor, bombardeiros: j.bombardeirosBase },
          )}
          selecionado={selecionado}
          onClicar={clicar}
        />
      </div>
      <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-panel p-espaco-7 min-[861px]:w-[340px] min-[861px]:border-t-0 min-[861px]:border-l">
        <h1 className="text-titulo">{lobby.nome}</h1>
        <p className="dica">Use a roda do mouse para dar zoom e arraste para mover.</p>

        <PainelVez visao={visao} mesa={mesa} presenca={presenca} />

        {visao.fase !== "FIM" && (
          <Bloco titulo="Ação">
            {minhaVez ? (
              <p>
                Sua vez: <b>{NOMES_FASES[visao.fase]}</b>.
              </p>
            ) : (
              <p className="dica">Aguardando {mesa.nome(daVez?.id ?? null)}.</p>
            )}
          </Bloco>
        )}

        <PainelRecebimento visao={visao} />

        <Bloco titulo="Território">
          <InfoTerritorio territorio={selecionado} visao={visao} mesa={mesa} />
        </Bloco>

        <PainelMesa visao={visao} mesa={mesa} presenca={presenca} />
        <MinhasCartas visao={visao} geografia={geografia} marcadas={cartasMarcadas} />
        <MeuObjetivo visao={visao} />

        <Bloco titulo="Continentes">
          <TabelaContinentes visao={visao} jogador={visao.voce} />
        </Bloco>

        <LogDaPartida eventos={jogo.eventos} mesa={mesa} />
      </aside>
    </div>
  );
}
