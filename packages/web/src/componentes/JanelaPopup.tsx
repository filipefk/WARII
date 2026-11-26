// Janela popup padrão do jogo (orientações e confirmações): no meio da tela, sem escurecer o fundo;
// uma camada transparente por trás só barra os cliques no resto da tela. O cabeçalho arrasta a
// janela (para ver o que está embaixo) e não há "X": fecha pelos botões ou pelo Esc.
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mensagemDoErro } from "../api/cliente";
import { Aviso, Botao } from "./basicos";

const preso = (v: number, limite: number) => Math.max(-limite, Math.min(limite, v));

export function JanelaPopup({
  titulo,
  onEsc,
  children,
}: {
  titulo: string;
  // Chamado com o Esc (o mesmo que o botão de sair da janela).
  onEsc: () => void;
  children: ReactNode;
}) {
  const [deslocamento, setDeslocamento] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const janela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEsc();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onEsc]);

  const comecar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { x: e.clientX, y: e.clientY, dx: deslocamento.x, dy: deslocamento.y };
  };
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const a = arrasto.current;
    const caixa = janela.current;
    if (!a || !caixa) return;
    // A janela não sai da tela: o centro anda no máximo até a borda menos meia janela.
    const limiteX = Math.max(0, (window.innerWidth - caixa.offsetWidth) / 2);
    const limiteY = Math.max(0, (window.innerHeight - caixa.offsetHeight) / 2);
    setDeslocamento({
      x: preso(a.dx + e.clientX - a.x, limiteX),
      y: preso(a.dy + e.clientY - a.y, limiteY),
    });
  };
  const soltar = () => {
    arrasto.current = null;
  };

  // No body: dentro de um cartão com filtro de fundo, o `fixed` ficaria preso ao cartão.
  return createPortal(
    <div className="fixed inset-0 z-20 flex items-center justify-center p-espaco-7">
      <div
        ref={janela}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-[520px] overflow-hidden rounded-raio-xl border border-border bg-panel"
        style={{ transform: `translate(${deslocamento.x}px, ${deslocamento.y}px)` }}
      >
        <div
          className="cursor-move touch-none border-b border-border px-espaco-7 pt-espaco-6 pb-espaco-4 select-none"
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <h2 className="text-titulo">{titulo}</h2>
        </div>
        <div className="px-espaco-7 pt-espaco-4 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// Confirmação de uma ação. A ação em destaque vem primeiro; o foco começa em "Voltar". Se a ação
// devolve uma Promise, a janela espera e, em caso de erro, mostra a mensagem e continua aberta.
export function Confirmar({
  titulo,
  rotulo,
  children,
  acao,
  onFechar,
}: {
  titulo: string;
  rotulo: string;
  children: ReactNode;
  acao: () => Promise<unknown> | void;
  onFechar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const confirmar = () => {
    const resultado = acao();
    if (!resultado) {
      onFechar();
      return;
    }
    setErro(null);
    setEnviando(true);
    resultado.then(onFechar).catch((falha: unknown) => {
      setErro(mensagemDoErro(falha));
      setEnviando(false);
    });
  };
  return (
    <JanelaPopup titulo={titulo} onEsc={onFechar}>
      <div className="space-y-espaco-7">
        <div>{children}</div>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex flex-wrap gap-espaco-2">
          <Botao onClick={confirmar} ocupado={enviando}>
            {rotulo}
          </Botao>
          {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- o foco começa na opção segura */}
          <Botao autoFocus onClick={onFechar}>
            Voltar
          </Botao>
        </div>
      </div>
    </JanelaPopup>
  );
}
