// Rótulo de um território sobre o mapa (componente MarcadorTerritorio do sistema): pilha de fichas
// cilíndricas de plástico na cor do dono com os exércitos no topo (brilho, reflexo, sulco e sombra),
// nome com halo, países incluídos e alfinete de centro estratégico.
import type { CorId, TerritorioId } from "@warii/engine";
import { TONS } from "../../ui/cores";
import type { Ponto } from "../../mapa/geografia";
import { ID_SELO_BRILHO, ID_SELO_LATERAL } from "./DefsDoJogo";
import { AlfineteCE } from "./pecas";

interface Props {
  // Território do marcador: clicar na pilha de fichas vale como clicar nele.
  id: TerritorioId;
  ponto: Ponto;
  nome: string;
  sub?: string;
  centro: boolean;
  dono: CorId | null;
  exercitos: number;
}

// Ficha vista um pouco de cima: topo elíptico e lateral com espessura.
const RX = 10;
const RY = 8;
const ESPESSURA = 4;

// Quantas fichas aparecem empilhadas: a pilha cresce com o exército, como no tabuleiro de verdade.
function fichasDaPilha(exercitos: number): number {
  if (exercitos >= 10) return 3;
  if (exercitos >= 5) return 2;
  return 1;
}

function Ficha({ x, cy, cor, topo }: { x: number; cy: number; cor: string; topo: boolean }) {
  const lateral = `M${x - RX},${cy} v${ESPESSURA} a${RX},${RY} 0 0,0 ${2 * RX},0 v${-ESPESSURA} a${RX},${RY} 0 0,1 ${-2 * RX},0z`;
  return (
    <g>
      <path d={lateral} fill={cor} stroke="var(--color-bg)" strokeWidth={1} />
      <path d={lateral} fill={`url(#${ID_SELO_LATERAL})`} />
      <ellipse
        cx={x}
        cy={cy}
        rx={RX}
        ry={RY}
        fill={cor}
        stroke="var(--color-bg)"
        strokeWidth={topo ? 1.5 : 1}
      />
      {topo && (
        <>
          <ellipse cx={x} cy={cy} rx={RX - 0.7} ry={RY - 0.6} fill={`url(#${ID_SELO_BRILHO})`} />
          <ellipse className="mapa-selo-sulco" cx={x} cy={cy} rx={RX - 2.4} ry={RY - 2} />
          <ellipse className="mapa-selo-reflexo" cx={x - 3.5} cy={cy - 4} rx={3.5} ry={1.6} />
        </>
      )}
    </g>
  );
}

export function MarcadorTerritorio({
  id,
  ponto: [x, y],
  nome,
  sub,
  centro,
  dono,
  exercitos,
}: Props) {
  const yNome = dono ? y + 18 : y;
  const n = dono ? fichasDaPilha(exercitos) : 0;
  // A ficha de baixo fica no lugar do antigo selo; as de cima sobem.
  const yBase = y - 5;
  const yTopo = yBase - (n - 1) * ESPESSURA;
  return (
    <g className="mapa-rotulo">
      {dono && (
        <g className="mapa-selo" data-marcador={id}>
          {Array.from({ length: n }, (_, k) => (
            <Ficha
              key={k}
              x={x}
              cy={yBase - k * ESPESSURA}
              cor={TONS[dono].fundo}
              topo={k === n - 1}
            />
          ))}
          <text className="mapa-exercitos" x={x} y={yTopo + 0.5} fill={TONS[dono].texto}>
            {exercitos}
          </text>
        </g>
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
