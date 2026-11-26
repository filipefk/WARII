// Carta que se aproxima no hover e, no clique, aparece ampliada no meio da tela. Clicar em qualquer
// lugar fora da carta ampliada (ou o Esc) desfaz o zoom. A carta é a mesma peça, só escalada.
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Parte da tela que a carta ampliada pode ocupar, e o limite de aumento.
const OCUPACAO = 0.85;
const ESCALA_MAXIMA = 4;

export function CartaAmpliavel({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const [escala, setEscala] = useState<number | null>(null);
  const peca = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (escala === null) return;
    // Na captura: o Esc fecha só o zoom, não a janela onde a carta está.
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setEscala(null);
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [escala]);

  const ampliar = () => {
    const caixa = peca.current?.getBoundingClientRect();
    if (!caixa || caixa.width === 0 || caixa.height === 0) return;
    setEscala(
      Math.min(
        (window.innerWidth * OCUPACAO) / caixa.width,
        (window.innerHeight * OCUPACAO) / caixa.height,
        ESCALA_MAXIMA,
      ),
    );
  };

  return (
    <>
      <button
        ref={peca}
        type="button"
        className="carta-ampliavel"
        aria-label={`Ampliar ${rotulo}`}
        onClick={ampliar}
      >
        {children}
      </button>
      {escala !== null &&
        createPortal(
          <div
            className="fixed inset-0 z-30 flex items-center justify-center bg-overlay"
            onClick={() => setEscala(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={rotulo}
              className="carta-ampliada"
              style={{ "--escala": escala } as CSSProperties}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
