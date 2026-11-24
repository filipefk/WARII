// Janela sobre o jogo para conteúdo longo (componentes Modal e Abas do sistema): véu em tela cheia,
// painel centralizado com cabeçalho (título, abas, fechar) e corpo com rolagem própria.
import { type ReactNode, useEffect } from "react";

export interface Aba<T extends string> {
  id: T;
  rotulo: string;
}

export function Abas<T extends string>({
  abas,
  ativa,
  onEscolher,
}: {
  abas: readonly Aba<T>[];
  ativa: T;
  onEscolher: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-espaco-2" role="tablist">
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          aria-selected={a.id === ativa}
          className={`botao ${a.id === ativa ? "ativo" : ""}`}
          onClick={() => onEscolher(a.id)}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

interface Props {
  titulo: string;
  onFechar: () => void;
  // Abas ou outros controles ao lado do título.
  cabecalho?: ReactNode;
  // Linha logo abaixo do cabeçalho (filtros).
  filtros?: ReactNode;
  // Painel estreito, para decisões curtas (até 520px) em vez de 1180px.
  estreito?: boolean;
  children: ReactNode;
}

export function Modal({ titulo, onFechar, cabecalho, filtros, estreito = false, children }: Props) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-overlay p-espaco-7"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex w-full flex-col overflow-hidden rounded-raio-xl border border-border bg-panel ${
          estreito ? "max-h-full max-w-[520px]" : "h-full max-w-[1180px]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-espaco-5 border-b border-border px-espaco-7 pt-espaco-6 pb-espaco-4">
          <h2 className="flex-1 text-titulo">{titulo}</h2>
          {cabecalho}
          <button type="button" className="botao" aria-label="Fechar" onClick={onFechar}>
            ✕
          </button>
        </div>
        {filtros && <div className="px-espaco-7 py-espaco-4">{filtros}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-espaco-7 pt-espaco-1 pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}
