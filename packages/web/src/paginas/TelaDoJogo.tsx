// Tela da partida em andamento ou encerrada: o tabuleiro e o painel lateral (componentes
// Tabuleiro e InfoTerritorio do sistema). A visão vem do socket; a interação fica em useJogo.
import type { TerritorioId } from "@warii/engine";
import type { PartidaLobbyDto } from "@warii/shared";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Aviso, Botao, Carregando } from "../componentes/basicos";
import { Modal } from "../componentes/Modal";
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
import { PainelCombate } from "../componentes/jogo/Combate";
import { PainelAcao } from "../componentes/jogo/PainelAcao";
import { TelaDeVitoria } from "../componentes/jogo/TelaDeVitoria";
import { Galeria } from "../componentes/guia/Galeria";
import { GuiaDeRegras } from "../componentes/guia/GuiaDeRegras";
import { DefsDoJogo } from "../componentes/tabuleiro/DefsDoJogo";
import { Tabuleiro } from "../componentes/tabuleiro/Tabuleiro";
import { useEnviarAcao } from "../jogo/enviarAcao";
import { eu } from "../jogo/previa";
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

// Botão só com o ícone: o nome vai na dica (title) e no rótulo para leitores de tela.
function BotaoIcone({
  dica,
  onClick,
  children,
}: {
  dica: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="botao" title={dica} aria-label={dica} onClick={onClick}>
      {children}
    </button>
  );
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
  const [janela, setJanela] = useState<"galeria" | "guia" | "cartas" | null>(null);

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

  // Encerrada pelo administrador antes do fim: o tabuleiro fica como estava, sem ações.
  const interrompida = lobby.status === "encerrada" && visao.fase !== "FIM";
  // Um clique que faz parte da interação escolhe o território; os outros só o mostram no painel.
  const clicar = (t: TerritorioId | null) => {
    const efeito = t === null || interrompida ? null : cliqueNoMapa(etapa, t);
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
  // Espectador não tem mão nem objetivo.
  const minhasCartas = eu(visao)?.cartas;
  // Fim de ataque aéreo no último lote: os sobreviventes voltam voando para a base.
  const encerrado = jogo?.ultimos.find((e) => e.tipo === "ataqueAereoEncerrado");
  const iniciado = jogo?.ultimos.find((e) => e.tipo === "ataqueAereoIniciado");
  const ciclo = jogo?.ultimos.find((e) => e.tipo === "cicloAereo");
  const antiaereo = jogo?.ultimos.find((e) => e.tipo === "antiaereoRolado");
  const assentoDoAtacante = encerrado
    ? visao.jogadores.findIndex((j) => j.id === encerrado.jogador)
    : -1;
  const atacante = visao.jogadores[assentoDoAtacante];
  // Perdas do último lote: os bombardeiros caem quando o defensor rola a antiaérea e os exércitos
  // quando o atacante rola o ataque (cada um num lote). Se o ataque começou neste lote, espera a
  // esquadrilha chegar: 1,5 s no voo ou 1,37 s na ida e volta (ataque que já acabou).
  const perdas =
    antiaereo?.tipo === "antiaereoRolado"
      ? {
          jogador: antiaereo.jogador,
          alvo: antiaereo.alvo,
          avioes: antiaereo.bombardeirosAbatidos,
          exercitos: 0,
        }
      : ciclo?.tipo === "cicloAereo"
        ? {
            jogador: ciclo.jogador,
            alvo: ciclo.alvo,
            avioes: ciclo.dadoAtaque === null ? ciclo.bombardeirosAbatidos : 0,
            exercitos: ciclo.exercitosAbatidos,
          }
        : null;
  const atacanteDoCiclo = perdas ? visao.jogadores.findIndex((j) => j.id === perdas.jogador) : -1;
  const explosoes =
    perdas && atacanteDoCiclo >= 0 && (perdas.avioes > 0 || perdas.exercitos > 0)
      ? {
          seq: jogo?.seqEventos ?? 0,
          base: atacanteDoCiclo,
          alvo: perdas.alvo,
          restantes:
            visao.turno.ataqueAereo?.emCombate ??
            (encerrado?.tipo === "ataqueAereoEncerrado" ? encerrado.sobreviventes : 0),
          avioes: perdas.avioes,
          exercitos: perdas.exercitos,
          atraso: iniciado ? (encerrado ? 1370 : 1500) : 0,
        }
      : null;
  const volta =
    encerrado?.tipo === "ataqueAereoEncerrado" &&
    (encerrado.sobreviventes > 0 || iniciado) &&
    atacante
      ? {
          base: assentoDoAtacante,
          cor: atacante.cor,
          alvo: encerrado.alvo,
          bombardeiros: encerrado.sobreviventes,
          seq: jogo?.seqEventos ?? 0,
          saida:
            iniciado?.tipo === "ataqueAereoIniciado" ? iniciado.daBase + iniciado.daCaixa : null,
        }
      : null;

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
          voo={
            visao.turno.ataqueAereo && mesa.jogadorDaVez
              ? {
                  base: visao.vez,
                  cor: mesa.jogadorDaVez.cor,
                  alvo: visao.turno.ataqueAereo.alvo,
                  bombardeiros: visao.turno.ataqueAereo.emCombate,
                  abatidosNaChegada: iniciado && perdas ? perdas.avioes : 0,
                }
              : null
          }
          volta={volta}
          explosoes={explosoes}
          onClicar={clicar}
          cantoInferiorEsquerdo={<PainelMesa visao={visao} mesa={mesa} presenca={presenca} />}
        />
      </div>
      <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-panel p-espaco-7 min-[861px]:w-[340px] min-[861px]:border-t-0 min-[861px]:border-l">
        <h1 className="text-titulo">{lobby.nome}</h1>
        <p className="dica">Use a roda do mouse para dar zoom e arraste para mover.</p>

        <PainelVez visao={visao} mesa={mesa} presenca={presenca} />

        {fim ? (
          <div className="mt-espaco-3">
            <Botao onClick={() => setVitoriaFechada(false)}>Ver resultado</Botao>
          </div>
        ) : interrompida ? (
          <div className="mt-espaco-3">
            <Aviso tipo="info">A partida foi encerrada pelo administrador, sem vencedor.</Aviso>
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

        <div className="mt-5 flex flex-wrap gap-espaco-2">
          <BotaoIcone dica="Regras" onClick={() => setJanela("guia")}>
            📖
          </BotaoIcone>
          <BotaoIcone dica="Todas cartas e dados" onClick={() => setJanela("galeria")}>
            🎲
          </BotaoIcone>
          {minhasCartas && (
            <BotaoIcone dica="Minhas cartas" onClick={() => setJanela("cartas")}>
              🃏 <span className="tabular-nums">{minhasCartas.length}</span>
            </BotaoIcone>
          )}
        </div>

        <LogDaPartida eventos={jogo.eventos} mesa={mesa} />
      </aside>
      {janela === "galeria" && (
        <Galeria
          geografia={geografia}
          parametros={visao.parametros}
          onFechar={() => setJanela(null)}
        />
      )}
      {janela === "cartas" && (
        <Modal titulo="Minhas cartas e objetivo" estreito onFechar={() => setJanela(null)}>
          <MinhasCartas visao={visao} geografia={geografia} marcadas={cartasMarcadas} />
          <MeuObjetivo visao={visao} />
        </Modal>
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
