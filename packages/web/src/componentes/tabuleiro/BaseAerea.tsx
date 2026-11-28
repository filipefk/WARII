// Base aérea de um jogador na borda do tabuleiro (componente BaseAerea do sistema): 10 vagas de
// caça delta, preenchidas na cor do dono conforme os bombardeiros na base.
import { CORES, type CorId } from "@warii/engine";
import { TONS } from "../../ui/cores";
import { CACA_DELTA, Caca3D, RASTRO_CACA } from "./pecas";

export const VAGAS_DA_BASE = 10;
// Gradiente de relevo da bandeja, definido no <defs> do Tabuleiro.
export const ID_RELEVO_BASE = "base-relevo";

interface Props {
  x: number;
  y: number;
  // null = base sem jogador.
  dono: CorId | null;
  bombardeiros: number;
}

export function BaseAerea({ x, y, dono, bombardeiros }: Props) {
  const cor = dono ? TONS[dono].fundo : null;
  const n = dono ? Math.min(VAGAS_DA_BASE, bombardeiros) : 0;
  return (
    <g className="mapa-base">
      <rect
        x={x - 178}
        y={y - 27}
        width={356}
        height={54}
        rx={6}
        fill="var(--color-base-fill)"
        stroke={cor ?? "var(--color-base-frame)"}
        strokeWidth={cor ? 3 : 1.5}
      />
      {/* Bandeja em baixo-relevo, com a pista pintada sob as vagas. */}
      <rect
        x={x - 176}
        y={y - 25}
        width={352}
        height={50}
        rx={5}
        fill={`url(#${ID_RELEVO_BASE})`}
      />
      <rect className="mapa-base-pista" x={x - 92} y={y - 15} width={244} height={30} rx={3} />
      <line className="mapa-base-faixa" x1={x - 88} y1={y} x2={x + 148} y2={y} />
      <text className="mapa-base-rotulo" x={x - 124} y={y - 6}>
        BASE AÉREA
      </text>
      {dono && cor && (
        <text className="mapa-base-dono" x={x - 124} y={y + 9} style={{ fill: cor }}>
          {`${CORES[dono].nome.toUpperCase()} · ${bombardeiros}/${VAGAS_DA_BASE}`}
        </text>
      )}
      {Array.from({ length: VAGAS_DA_BASE }, (_, k) => {
        const ocupada = k < n;
        const deCabeca = k % 2 === 0;
        const posicao = `translate(${x - 78 + k * 24} ${y + (k % 2 ? 1 : -1)}) scale(.4)`;
        if (ocupada && cor) {
          return (
            <g key={k} className="mapa-vaga ocupada" transform={posicao}>
              <path
                className="rastro"
                d={RASTRO_CACA}
                transform={deCabeca ? "rotate(180)" : undefined}
              />
              <Caca3D cor={cor} rotacao={deCabeca ? 180 : 0} />
            </g>
          );
        }
        return (
          <g
            key={k}
            className="mapa-vaga"
            transform={`${posicao}${deCabeca ? " rotate(180)" : ""}`}
          >
            <path className="corpo" d={CACA_DELTA} />
            <path className="rastro" d={RASTRO_CACA} />
          </g>
        );
      })}
    </g>
  );
}
