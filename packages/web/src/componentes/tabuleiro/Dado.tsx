// Face de dado em SVG (componente Dado do sistema). Desenha o valor recebido; as faces possíveis dos
// dados aéreos vêm dos parâmetros da partida, nunca de valores fixos aqui.
import { CACA_DELTA, RASTRO_CACA } from "./pecas";

export type TipoDado = "ataque" | "defesa" | "aereo" | "antiaereo";

// Símbolos brancos (o token route é o branco puro do sistema).
const BRANCO = "var(--color-route)";

const COR: Record<TipoDado, string> = {
  ataque: "var(--color-dado-ataque)",
  defesa: "var(--color-dado-defesa)",
  aereo: "var(--color-dado-aereo)",
  antiaereo: "var(--color-dado-aereo)",
};

const PONTOS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 26],
    [72, 26],
    [28, 50],
    [72, 50],
    [28, 74],
    [72, 74],
  ],
};
// Fichas de exército na face do ataque aéreo.
const FICHAS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [30, 32],
    [70, 68],
  ],
  3: [
    [50, 28],
    [28, 68],
    [72, 68],
  ],
};
// Caças na face antiaérea: x, y, escala; alternam nariz para baixo e para cima.
const CACAS: Record<number, [number, number, number][]> = {
  1: [[50, 46, 1]],
  2: [
    [32, 47, 0.62],
    [68, 53, 0.62],
  ],
  3: [
    [22, 47, 0.5],
    [50, 53, 0.5],
    [78, 47, 0.5],
  ],
};

export function rotuloDaFace(tipo: TipoDado, valor: number): string {
  if (tipo === "ataque" || tipo === "defesa") return String(valor);
  if (!valor) return "lisa";
  if (tipo === "aereo") return `${valor} exército${valor > 1 ? "s" : ""}`;
  return valor > 1 ? `${valor} aviões` : "1 avião";
}

function Simbolos({ tipo, valor }: { tipo: TipoDado; valor: number }) {
  if (tipo === "ataque" || tipo === "defesa") {
    const tinta = tipo === "ataque" ? BRANCO : "var(--color-dado-defesa-tinta)";
    return (PONTOS[valor] ?? []).map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r={9} fill={tinta} />
    ));
  }
  if (valor <= 0) return null;
  const n = Math.min(valor, 3);
  if (tipo === "aereo") {
    return (FICHAS[n] ?? []).map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r={14} fill={BRANCO} />
        <circle cx={x} cy={y} r={9} fill="none" stroke={COR.aereo} strokeWidth={2.5} />
      </g>
    ));
  }
  return (CACAS[n] ?? []).map(([x, y, s], i) => (
    <g key={i} transform={`translate(${x} ${y}) scale(${s})${i % 2 === 0 ? " rotate(180)" : ""}`}>
      <path d={CACA_DELTA} fill={BRANCO} />
      <ellipse cy={-19} rx={1.8} ry={4.5} fill={COR.antiaereo} />
      <path d={RASTRO_CACA} stroke={BRANCO} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ));
}

interface Props {
  tipo: TipoDado;
  valor: number;
  // Lado em px.
  tamanho?: number;
  // Animação de rolagem (CSS; desligada com prefers-reduced-motion).
  rolando?: boolean;
  className?: string;
}

export function Dado({ tipo, valor, tamanho = 38, rolando = false, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      className={`dado ${rolando ? "rolando" : ""} ${className}`}
      role="img"
      aria-label={rotuloDaFace(tipo, valor)}
    >
      <rect
        x={3}
        y={3}
        width={94}
        height={94}
        rx={17}
        fill={COR[tipo]}
        stroke="rgba(0,0,0,.35)"
        strokeWidth={2}
      />
      <rect
        x={9}
        y={9}
        width={82}
        height={82}
        rx={12}
        fill="none"
        stroke="rgba(255,255,255,.35)"
        strokeWidth={1.5}
      />
      <Simbolos tipo={tipo} valor={valor} />
    </svg>
  );
}
