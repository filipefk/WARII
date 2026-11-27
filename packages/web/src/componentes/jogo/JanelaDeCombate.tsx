// Janela de combate: aberta para toda a mesa enquanto há um ataque em curso (o terrestre declarado
// com "Iniciar ataque" ou o aéreo). À esquerda, o mapa ampliado no local do conflito; à direita,
// atacante e defensor, os dados e os controles de quem deve agir (rolar o ataque, a defesa ou a
// antiaérea, mover após a conquista, encerrar). Só o atacante a fecha (encerrando o ataque
// terrestre ou fechando o resultado do aéreo); os outros só assistem, e ela some para todos.
import {
  type Evento,
  type JogadorId,
  territorio,
  type TerritorioId,
  type VisaoPartida,
} from "@warii/engine";
import type { ReactNode } from "react";
import type { Etapa } from "../../jogo/interacao";
import type { Mesa } from "../../jogo/mesa";
import type { Geografia } from "../../mapa/geografia";
import type { JogoRecebido } from "../../stores/partidas";
import { Aviso, Botao, CorJogador } from "../basicos";
import { JanelaPopup } from "../JanelaPopup";
import { type ExplosoesNoMapa, Tabuleiro, type VooNoMapa } from "../tabuleiro/Tabuleiro";
import { DadosDoCombate } from "./Combate";
import {
  AereoEmCurso,
  Antiaereo,
  ConflitoTerrestre,
  Conquista,
  type Contexto,
  criarContexto,
  Defesa,
  type Envio,
} from "./PainelAcao";

const nomeT = (t: TerritorioId) => territorio(t).nome;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

type De<K extends Evento["tipo"]> = Extract<Evento, { tipo: K }>;

export type CombateNaTela =
  | {
      tipo: "terrestre";
      // Identifica o combate: o que foi ocultado fica oculto até começar outro.
      chave: string;
      origem: TerritorioId;
      alvo: TerritorioId;
      atacante: JogadorId | null;
      defensor: JogadorId | null;
    }
  | {
      tipo: "aereo";
      chave: string;
      alvo: TerritorioId;
      atacante: JogadorId | null;
      defensor: JogadorId | null;
      // O ataque acabou no último lote: a janela fica com o resultado até o atacante fechá-la.
      encerrado: De<"ataqueAereoEncerrado"> | null;
    };

// Combate que a janela mostra agora, a partir da visão (e do último lote, para o aéreo que acabou).
export function combateNaTela(visao: VisaoPartida, jogo: JogoRecebido): CombateNaTela | null {
  if (visao.fase !== "ATACAR") return null;
  const t = visao.turno;
  const atacante = visao.jogadores[visao.vez]?.id ?? null;
  const daVez = `${visao.rodada}:${visao.vez}`;
  if (t.ataqueAereo) {
    const { alvo, defensor } = t.ataqueAereo;
    return {
      tipo: "aereo",
      chave: `a:${daVez}:${alvo}`,
      alvo,
      atacante,
      defensor,
      encerrado: null,
    };
  }
  const par =
    t.conflitoTerrestre ??
    t.ataqueTerrestre ??
    (t.conquistaPendente ? { ...t.conquistaPendente, defensor: null } : null);
  if (par) {
    const { origem, alvo, defensor } = par;
    return {
      tipo: "terrestre",
      chave: `t:${daVez}:${origem}:${alvo}`,
      origem,
      alvo,
      atacante,
      defensor,
    };
  }
  const encerrado = jogo.ultimos.find(
    (e): e is De<"ataqueAereoEncerrado"> => e.tipo === "ataqueAereoEncerrado",
  );
  if (!encerrado) return null;
  // O defensor sai do último evento do ataque que o cita.
  const comDefensor = jogo.eventos.findLast(
    (e) =>
      (e.tipo === "ataqueAereoIniciado" ||
        e.tipo === "antiaereoRolado" ||
        e.tipo === "cicloAereo") &&
      e.alvo === encerrado.alvo,
  );
  return {
    tipo: "aereo",
    chave: `a:${daVez}:${encerrado.alvo}`,
    alvo: encerrado.alvo,
    atacante: encerrado.jogador,
    defensor: comDefensor && "defensor" in comDefensor ? comDefensor.defensor : null,
    encerrado,
  };
}

// Etapas cujos controles ficam na janela.
export function etapaDoCombate(etapa: Etapa): boolean {
  return (
    etapa.tipo === "conflito" ||
    etapa.tipo === "conquista" ||
    etapa.tipo === "defesa" ||
    etapa.tipo === "antiaereo" ||
    etapa.tipo === "aereoEmCurso"
  );
}

function Controles({ ctx, etapa }: { ctx: Contexto; etapa: Etapa }) {
  switch (etapa.tipo) {
    case "conflito":
      return <ConflitoTerrestre ctx={ctx} etapa={etapa} />;
    case "conquista":
      return <Conquista ctx={ctx} etapa={etapa} />;
    case "defesa":
      return <Defesa ctx={ctx} etapa={etapa} />;
    case "antiaereo":
      return <Antiaereo ctx={ctx} etapa={etapa} />;
    case "aereoEmCurso":
      return <AereoEmCurso ctx={ctx} etapa={etapa} />;
    default:
      return null;
  }
}

// O que falta acontecer, para quem só acompanha.
function aguardando(combate: CombateNaTela, visao: VisaoPartida, mesa: Mesa): string | null {
  const t = visao.turno;
  const atacante = mesa.nome(combate.atacante);
  if (combate.tipo === "aereo") {
    if (combate.encerrado) return null;
    const etapa = t.ataqueAereo?.etapa;
    if (etapa === "antiaereo")
      return `Aguardando ${mesa.nome(combate.defensor)} rolar a antiaérea.`;
    if (etapa === "ataque") return `Aguardando ${atacante} rolar o ataque aéreo.`;
    return `Aguardando ${atacante} continuar ou encerrar o ataque.`;
  }
  if (t.ataqueTerrestre) return `Aguardando ${mesa.nome(combate.defensor)} rolar a defesa.`;
  if (t.conquistaPendente)
    return `Aguardando ${atacante} mover os exércitos para ${nomeT(combate.alvo)}.`;
  return `Aguardando ${atacante} rolar o ataque ou encerrá-lo.`;
}

function Lado({
  papel,
  jogador,
  mesa,
  children,
}: {
  papel: string;
  jogador: JogadorId | null;
  mesa: Mesa;
  children: ReactNode;
}) {
  return (
    <div className="rounded-raio-md border border-border bg-panel-2 px-espaco-4 py-espaco-3">
      <p className="dica">{papel}</p>
      <p className="flex items-center gap-espaco-2">
        <CorJogador cor={mesa.cor(jogador)} tamanho="h-4 w-4 shrink-0" />
        <b>{mesa.nome(jogador)}</b>
      </p>
      <p className="dica">{children}</p>
    </div>
  );
}

export interface AnimacoesDoMapa {
  voo: VooNoMapa | null;
  volta: (VooNoMapa & { seq: number; saida: number | null }) | null;
  explosoes: ExplosoesNoMapa | null;
}

interface Props {
  combate: CombateNaTela;
  visao: VisaoPartida;
  mesa: Mesa;
  geografia: Geografia;
  jogo: JogoRecebido;
  etapa: Etapa;
  envio: Envio;
  animacoes: AnimacoesDoMapa;
  // Só para o atacante, com o resultado do ataque aéreo na tela.
  onFechar?: () => void;
}

export function JanelaDeCombate({
  combate,
  visao,
  mesa,
  geografia,
  jogo,
  etapa,
  envio,
  animacoes,
  onFechar,
}: Props) {
  const ctx = criarContexto(visao, mesa, geografia, envio);
  const deveAgir = etapaDoCombate(etapa);
  const exercitos = (t: TerritorioId) =>
    plural(visao.territorios[t].exercitos, "exército", "exércitos");
  const foco = combate.tipo === "terrestre" ? [combate.origem, combate.alvo] : [combate.alvo];
  const titulo =
    combate.tipo === "terrestre"
      ? `Ataque terrestre: ${nomeT(combate.origem)} → ${nomeT(combate.alvo)}`
      : `Ataque aéreo sobre ${nomeT(combate.alvo)}`;
  const espera = deveAgir ? null : aguardando(combate, visao, mesa);
  const emCombate = visao.turno.ataqueAereo?.emCombate ?? 0;
  return (
    <JanelaPopup
      titulo={titulo}
      largura="max-w-[960px]"
      fundo="bg-panel"
      onEsc={!deveAgir && onFechar ? onFechar : () => {}}
    >
      <div className="grid gap-espaco-7 min-[760px]:grid-cols-[minmax(0,1fr)_290px]">
        <div className="aspect-[29/20] w-full self-start overflow-hidden rounded-raio-tabuleiro border border-border bg-bg">
          <Tabuleiro
            geografia={geografia}
            territorio={(t) => ({
              dono: mesa.cor(visao.territorios[t].dono),
              exercitos: visao.territorios[t].exercitos,
            })}
            bases={visao.jogadores.map((j) =>
              j.eliminado ? null : { dono: j.cor, bombardeiros: j.bombardeirosBase },
            )}
            marcados={new Set(foco)}
            voo={animacoes.voo}
            volta={animacoes.volta}
            explosoes={animacoes.explosoes}
            foco={foco}
          />
        </div>
        <div className="flex flex-col gap-espaco-5">
          <div className="grid grid-cols-2 gap-espaco-3">
            <Lado papel="Ataque" jogador={combate.atacante} mesa={mesa}>
              {combate.tipo === "terrestre"
                ? `${nomeT(combate.origem)}: ${exercitos(combate.origem)}`
                : combate.encerrado
                  ? plural(combate.encerrado.sobreviventes, "sobrevivente", "sobreviventes")
                  : `${plural(emCombate, "bombardeiro", "bombardeiros")} em combate`}
            </Lado>
            <Lado papel="Defesa" jogador={combate.defensor} mesa={mesa}>
              {nomeT(combate.alvo)}: {exercitos(combate.alvo)}
            </Lado>
          </div>

          <section>
            <h3 className="secao mb-espaco-3">Dados</h3>
            <DadosDoCombate
              jogo={jogo}
              visao={visao}
              mesa={mesa}
              par={
                combate.tipo === "terrestre"
                  ? { tipo: "terrestre", origem: combate.origem, alvo: combate.alvo }
                  : { tipo: "aereo", alvo: combate.alvo }
              }
            />
          </section>

          {combate.tipo === "aereo" && combate.encerrado && (
            <p>
              Ataque aéreo encerrado:{" "}
              {plural(
                combate.encerrado.sobreviventes,
                "sobrevivente volta",
                "sobreviventes voltam",
              )}{" "}
              para a {combate.encerrado.destino === "base" ? "base aérea" : "caixa"}.
            </p>
          )}

          <section>
            {deveAgir ? (
              <Controles ctx={ctx} etapa={etapa} />
            ) : (
              <>
                {espera && <p className="dica">{espera}</p>}
                {onFechar ? (
                  <div className="mt-espaco-3 flex flex-wrap gap-espaco-2">
                    <Botao onClick={onFechar}>Fechar</Botao>
                  </div>
                ) : (
                  combate.tipo === "aereo" &&
                  combate.encerrado && (
                    <p className="dica">
                      Aguardando {mesa.nome(combate.atacante)} fechar a janela.
                    </p>
                  )
                )}
              </>
            )}
            {envio.erro && (
              <div className="mt-espaco-3">
                <Aviso>{envio.erro}</Aviso>
              </div>
            )}
          </section>
        </div>
      </div>
    </JanelaPopup>
  );
}
