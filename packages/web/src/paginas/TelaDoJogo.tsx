// Tela da partida em andamento ou encerrada: o tabuleiro e o painel lateral (componentes
// Tabuleiro e InfoTerritorio do sistema). A visão vem do socket; a interação fica em useJogo.
import type { TerritorioId } from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Aviso, Botao, Carregando } from "../componentes/basicos";
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
import { PainelCombate } from "../componentes/jogo/Combate";
import { PainelAcao } from "../componentes/jogo/PainelAcao";
import { TelaDeVitoria } from "../componentes/jogo/TelaDeVitoria";
import { Galeria } from "../componentes/guia/Galeria";
import { GuiaDeRegras } from "../componentes/guia/GuiaDeRegras";
import { DefsDoJogo } from "../componentes/tabuleiro/DefsDoJogo";
import { Tabuleiro } from "../componentes/tabuleiro/Tabuleiro";
import { useEnviarAcao } from "../jogo/enviarAcao";
import { cliqueNoMapa, derivarEtapa, destaquesDoMapa, type Etapa } from "../jogo/interacao";
import { montarMesa } from "../jogo/mesa";
import { carregarGeografia, type Geografia } from "../mapa/geografia";
import { chaveDaFase, useJogo } from "../stores/jogo";
import type { JogoRecebido } from "../stores/partidas";

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
  const definirOrigem = useJogo((s) => s.definirOrigem);
  const definirDestino = useJogo((s) => s.definirDestino);
  const modo = useJogo((s) => s.modo);
  const origem = useJogo((s) => s.origem);
  const destino = useJogo((s) => s.destino);
  const daBase = useJogo((s) => s.daBase);
  const { ocupado, erro: erroAcao, enviar, limparErro } = useEnviarAcao(partidaId);
  const [vitoriaFechada, setVitoriaFechada] = useState(false);
  const [janela, setJanela] = useState<"galeria" | "guia" | null>(null);

  const visao = jogo?.visao;
  const seq = jogo?.seq;
  useEffect(() => {
    if (seq !== undefined) abrirPartida(partidaId, seq);
  }, [partidaId, seq, abrirPartida]);
  useEffect(() => {
    if (!visao) return;
    sincronizarVez(chaveDaFase(visao.rodada, visao.vez, visao.etapaPrimeiraRodada, visao.fase));
  }, [visao, sincronizarVez]);
  // A recusa da ação anterior não vale para a próxima vez nem para a próxima fase.
  const chave = visao
    ? chaveDaFase(visao.rodada, visao.vez, visao.etapaPrimeiraRodada, visao.fase)
    : null;
  const chaveDoErro = useRef(chave);
  useEffect(() => {
    if (chaveDoErro.current === chave) return;
    chaveDoErro.current = chave;
    limparErro();
  }, [chave, limparErro]);

  const mesa = useMemo(() => (visao ? montarMesa(lobby, visao) : null), [lobby, visao]);
  const etapa: Etapa = useMemo(
    () =>
      visao
        ? derivarEtapa(visao, { modo, origem, destino, cartas: cartasMarcadas, daBase })
        : { tipo: "espera" },
    [visao, modo, origem, destino, cartasMarcadas, daBase],
  );
  const destaques = useMemo(() => destaquesDoMapa(etapa), [etapa]);

  if (erro) return <Aviso>{erro}</Aviso>;
  if (!visao || !mesa || !geografia || !jogo) return <Carregando texto="Carregando a partida…" />;

  // Um clique que faz parte da interação escolhe o território; os outros só o mostram no painel.
  const clicar = (t: TerritorioId | null) => {
    const efeito = t === null ? null : cliqueNoMapa(etapa, t);
    if (efeito === null) {
      selecionar(t === selecionado ? null : t);
      return;
    }
    limparErro();
    selecionar(t);
    if (efeito.tipo === "origem") definirOrigem(efeito.territorio);
    else if (efeito.tipo === "destino") definirDestino(efeito.territorio);
    else if (!ocupado) void enviar(efeito.acao);
  };
  const fim = visao.fase === "FIM";

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
          marcados={destaques.marcados}
          opcoes={destaques.opcoes}
          onClicar={clicar}
        />
      </div>
      <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-panel p-espaco-7 min-[861px]:w-[340px] min-[861px]:border-t-0 min-[861px]:border-l">
        <h1 className="text-titulo">{lobby.nome}</h1>
        <p className="dica">Use a roda do mouse para dar zoom e arraste para mover.</p>
        <div className="mt-espaco-4 flex flex-wrap gap-espaco-2">
          <Botao onClick={() => setJanela("guia")}>📖 Regras do jogo</Botao>
          <Botao onClick={() => setJanela("galeria")}>🃏 Ver cartas e dados</Botao>
        </div>

        <PainelVez visao={visao} mesa={mesa} presenca={presenca} />

        {fim ? (
          <div className="mt-espaco-3">
            <Botao onClick={() => setVitoriaFechada(false)}>Ver resultado</Botao>
          </div>
        ) : (
          <PainelAcao
            visao={visao}
            mesa={mesa}
            geografia={geografia}
            etapa={etapa}
            envio={{ ocupado, erro: erroAcao, enviar }}
          />
        )}

        <PainelCombate jogo={jogo} visao={visao} mesa={mesa} />

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
      {janela === "galeria" && (
        <Galeria
          geografia={geografia}
          parametros={visao.parametros}
          onFechar={() => setJanela(null)}
        />
      )}
      {janela === "guia" && (
        <GuiaDeRegras
          visao={visao}
          geografia={geografia}
          onFechar={() => setJanela(null)}
          onVerNoMapa={(t) => {
            setJanela(null);
            selecionar(t);
          }}
        />
      )}
      {fim && !vitoriaFechada && (
        <TelaDeVitoria visao={visao} mesa={mesa} onFechar={() => setVitoriaFechada(true)} />
      )}
    </div>
  );
}
