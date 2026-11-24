// Rótulo de um território sobre o mapa (componente MarcadorTerritorio do sistema): selo com os
// exércitos na cor do dono, nome com halo, países incluídos e alfinete de centro estratégico.
import type { CorId } from "@warii/engine";
import { TONS } from "../../ui/cores";
import type { Ponto } from "../../mapa/geografia";
import { AlfineteCE } from "./pecas";

interface Props {
  ponto: Ponto;
  nome: string;
  sub?: string;
  centro: boolean;
  dono: CorId | null;
  exercitos: number;
}

export function MarcadorTerritorio({ ponto: [x, y], nome, sub, centro, dono, exercitos }: Props) {
  const yNome = dono ? y + 18 : y;
  return (
    <g className="mapa-rotulo">
      {dono && (
        <>
          <circle
            cx={x}
            cy={y - 4}
            r={10}
            fill={TONS[dono].fundo}
            stroke="var(--color-bg)"
            strokeWidth={1.5}
          />
          <text className="mapa-exercitos" x={x} y={y - 4} fill={TONS[dono].texto}>
            {exercitos}
          </text>
        </>
      )}
      <text className="mapa-nome" x={x} y={yNome}>
        {nome}
      </text>
      {sub && (
        <text className="mapa-sub" x={x} y={yNome + 10}>
          {sub}
        </text>
      )}
      {centro && <AlfineteCE x={dono ? x + 16 : x} y={dono ? y - 10 : y - 14} />}
    </g>
  );
}
