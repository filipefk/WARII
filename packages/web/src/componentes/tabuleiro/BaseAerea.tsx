// Base aérea de um jogador na borda do tabuleiro (componente BaseAerea do sistema): 10 vagas de
// caça delta, preenchidas na cor do dono conforme os bombardeiros na base.
import { CORES, type CorId } from "@warii/engine";
import { TONS } from "../../ui/cores";
import { CACA_DELTA, RASTRO_CACA } from "./pecas";

export const VAGAS_DA_BASE = 10;

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
        x={x - 165}
        y={y - 23}
        width={330}
        height={46}
        rx={6}
        fill="var(--color-base-fill)"
        stroke={cor ?? "var(--color-base-frame)"}
        strokeWidth={cor ? 3 : 1.5}
      />
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
        return (
          <g
            key={k}
            className={ocupada ? "mapa-vaga ocupada" : "mapa-vaga"}
            transform={`translate(${x - 78 + k * 24} ${y + (k % 2 ? 1 : -1)}) scale(.4)${k % 2 ? "" : " rotate(180)"}`}
          >
            <path
              className="corpo"
              d={CACA_DELTA}
              style={ocupada && cor ? { fill: cor } : undefined}
            />
            <path className="rastro" d={RASTRO_CACA} />
          </g>
        );
      })}
    </g>
  );
}
