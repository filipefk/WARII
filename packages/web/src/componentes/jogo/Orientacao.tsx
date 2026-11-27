// Mensagens de orientação: um popup no meio da tela, com "OK", no começo da ocupação do mapa e no
// começo de cada passo do recebimento (bônus de cada continente, livres, cartas), do ataque e do
// deslocamento de cada vez do jogador. Cada mensagem aparece até o OK, uma vez só por partida, vez e passo
// (lembrada também no sessionStorage, para não voltar ao recarregar a página).
// Enquanto aberta, o texto acompanha a etapa (no recebimento, o passo e a quantidade atuais).
import { CONTINENTES, type VisaoPartida } from "@warii/engine";
import { type ReactNode, useState } from "react";
import type { Etapa } from "../../jogo/interacao";
import { eu } from "../../jogo/previa";
import { chaveDaVez } from "../../stores/jogo";
import { Botao } from "../basicos";
import { JanelaPopup } from "../JanelaPopup";

interface Mensagem {
  chave: string;
  titulo: string;
  corpo: ReactNode;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function mensagemPara(visao: VisaoPartida, etapa: Etapa): Mensagem | null {
  if (visao.voce === null) return null;
  const vez = chaveDaVez(visao.rodada, visao.vez, visao.etapaPrimeiraRodada);
  if (visao.fase === "PREP_OCUPACAO") {
    return {
      chave: "ocupacao",
      titulo: "Ocupação do mapa",
      corpo: (
        <>
          <p>
            Os centros estratégicos foram sorteados, agora cada jogador escolhe um território até
            ocupar todo o mapa.
          </p>
          <p className="mt-espaco-3">
            Na sua vez, clique num território vago (os destacados) para ocupá-lo com 1 exército.
          </p>
        </>
      ),
    };
  }
  // Recebimento: uma mensagem para cada passo (o bônus de cada continente, os livres e as cartas).
  if (etapa.tipo === "receber" && etapa.passo === "cartas") {
    if (!etapa.temCartas) return null;
    const cartas = eu(visao)?.cartas?.length ?? 0;
    return {
      chave: `receber:${vez}:cartas`,
      titulo: "Sua vez: Recebimento",
      corpo: (
        <>
          <p>Todos os exércitos foram colocados.</p>
          <p className="mt-espaco-3">
            Você tem {plural(cartas, "carta", "cartas")}.{" "}
            {etapa.usaCartas
              ? "Pode usá-las agora para reforçar, transportar ou descartar, no painel ao lado."
              : "Pode descartá-las agora, no painel ao lado."}
          </p>
        </>
      ),
    };
  }
  if (etapa.tipo === "receber") {
    const quantos = plural(etapa.doPasso, "exército", "exércitos");
    const continente = etapa.continente === null ? null : CONTINENTES[etapa.continente].nome;
    return {
      chave: `receber:${vez}:${etapa.passo}:${etapa.continente ?? ""}`,
      titulo: "Sua vez: Recebimento",
      corpo:
        etapa.passo === "continente" && continente !== null ? (
          <>
            <p>
              Coloque <b>{quantos}</b> na <b>{continente}</b>, o bônus do continente.
            </p>
            <p className="mt-espaco-3">
              Clique num território seu da {continente} (os destacados).
            </p>
          </>
        ) : (
          <p>
            Coloque <b>{quantos}</b> em qualquer território seu.
          </p>
        ),
    };
  }
  if (etapa.tipo === "terrestre" || etapa.tipo === "aereo") {
    return {
      chave: `atacar:${vez}`,
      titulo: "Sua vez: Ataque",
      corpo: (
        <p>
          Escolha ataque terrestre ou aéreo, defina a origem em caso de terrestre e defina o destino
          do ataque.
        </p>
      ),
    };
  }
  if (etapa.tipo === "deslocar") {
    return {
      chave: `deslocar:${vez}`,
      titulo: "Sua vez: Deslocamento",
      corpo: (
        <>
          <p>Agora você pode movimentar os exércitos selecionando origem, destino e quantidade.</p>
          <p className="mt-espaco-3">Ao terminar, clique em "Encerrar jogada".</p>
        </>
      ),
    };
  }
  return null;
}

const mostradas = new Set<string>();

function jaMostrada(chave: string): boolean {
  if (mostradas.has(chave)) return true;
  try {
    return sessionStorage.getItem(`orientacao:${chave}`) !== null;
  } catch {
    return false;
  }
}

function marcarMostrada(chave: string) {
  mostradas.add(chave);
  try {
    sessionStorage.setItem(`orientacao:${chave}`, "1");
  } catch {
    // Sem armazenamento, vale só a memória desta aba.
  }
}

export function useOrientacao(
  partidaId: string,
  visao: VisaoPartida | undefined,
  etapa: Etapa,
  ativa: boolean,
): { mensagem: Mensagem | null; fechar: () => void } {
  // Só para redesenhar depois do OK (o que já foi visto fica em `mostradas`).
  const [, setVistas] = useState(0);
  const m = visao && ativa && visao.fase !== "FIM" ? mensagemPara(visao, etapa) : null;
  const chave = m ? `${partidaId}:${m.chave}` : null;
  const mensagem = m && chave !== null && !jaMostrada(chave) ? m : null;
  const fechar = () => {
    if (chave !== null) marcarMostrada(chave);
    setVistas((n) => n + 1);
  };
  return { mensagem, fechar };
}

// Fecha pelo OK (com o foco, também pelo Enter) ou pelo Esc.
export function Orientacao({ mensagem, onFechar }: { mensagem: Mensagem; onFechar: () => void }) {
  return (
    <JanelaPopup titulo={mensagem.titulo} onEsc={onFechar}>
      {mensagem.corpo}
      <div className="mt-espaco-7 flex justify-end">
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- o OK recebe o foco para fechar com Enter */}
        <Botao autoFocus onClick={onFechar}>
          OK
        </Botao>
      </div>
    </JanelaPopup>
  );
}
