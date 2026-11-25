// Face de dado em SVG (componente Dado do sistema). Desenha o valor recebido; as faces possíveis dos
// dados aéreos vêm dos parâmetros da partida, nunca de valores fixos aqui. Tem volume de peça física
// (luz no alto à esquerda, quinas sombreadas, pontos cavados) e, ao rolar, quica e troca de face
// algumas vezes antes de parar no valor sorteado.
import { useEffect, useId, useState } from "react";
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

// Faces dos dados terrestres; as dos aéreos vêm de quem usa (parâmetros da partida).
const FACES_TERRESTRES = [1, 2, 3, 4, 5, 6] as const;
// Tempo (ms) em que a face fica trocando durante a rolagem, e o intervalo entre as trocas.
const TROCA_MS = 560;
const INTERVALO_TROCA_MS = 70;

function Simbolos({ tipo, valor, cova }: { tipo: TipoDado; valor: number; cova: string }) {
  if (tipo === "ataque" || tipo === "defesa") {
    const tinta = tipo === "ataque" ? BRANCO : "var(--color-dado-defesa-tinta)";
    return (PONTOS[valor] ?? []).map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r={9} fill={tinta} />
        <circle cx={x} cy={y} r={9} fill={`url(#${cova})`} />
      </g>
    ));
  }
  if (valor <= 0) return null;
  const n = Math.min(valor, 3);
  if (tipo === "aereo") {
    return (FICHAS[n] ?? []).map(([x, y], i) => (
      <g key={i}>
        <circle cx={x + 1.5} cy={y + 2} r={14} fill="#000" opacity={0.3} />
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
  // Faces mostradas enquanto rola (dados aéreos: as dos parâmetros). Sem elas, o aéreo não troca.
  faces?: readonly number[];
  className?: string;
}

function reduzMovimento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Face mostrada durante a rolagem: sorteia entre as faces possíveis por um instante e depois
// devolve null (vale o valor recebido). Só visual; o valor do combate vem do servidor.
function useFaceRolando(rolando: boolean, faces: readonly number[]): number | null {
  const [face, setFace] = useState<number | null>(null);
  const chave = faces.join(",");
  useEffect(() => {
    const opcoes = chave ? chave.split(",").map(Number) : [];
    if (!rolando || opcoes.length < 2 || reduzMovimento()) return () => {};
    const sortear = () => setFace(opcoes[Math.floor(Math.random() * opcoes.length)] ?? null);
    sortear();
    const troca = window.setInterval(sortear, INTERVALO_TROCA_MS);
    const fim = window.setTimeout(() => {
      window.clearInterval(troca);
      setFace(null);
    }, TROCA_MS);
    return () => {
      window.clearInterval(troca);
      window.clearTimeout(fim);
      setFace(null);
    };
  }, [rolando, chave]);
  return face;
}

export function Dado({
  tipo,
  valor,
  tamanho = 38,
  rolando = false,
  faces,
  className = "",
}: Props) {
  const terrestre = tipo === "ataque" || tipo === "defesa";
  const girando = useFaceRolando(rolando, faces ?? (terrestre ? FACES_TERRESTRES : []));
  const id = useId().replace(/\W/g, "");
  const volume = `dado-volume-${id}`;
  const cova = `dado-cova-${id}`;
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      className={`dado ${rolando ? "rolando" : ""} ${className}`}
      role="img"
      aria-label={rotuloDaFace(tipo, valor)}
    >
      <defs>
        {/* Luz vinda do alto à esquerda: face clara de um lado, quina escura do outro. */}
        <linearGradient id={volume} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.34} />
          <stop offset=".45" stopColor="#fff" stopOpacity={0} />
          <stop offset=".6" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.34} />
        </linearGradient>
        {/* Ponto cavado: a borda de cima fica na sombra e a de baixo pega luz. */}
        <radialGradient id={cova} cx="62%" cy="64%" r="62%">
          <stop offset="0" stopColor="#fff" stopOpacity={0.2} />
          <stop offset=".55" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.5} />
        </radialGradient>
      </defs>
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
      <rect x={3} y={3} width={94} height={94} rx={17} fill={`url(#${volume})`} />
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
      <ellipse
        cx={30}
        cy={20}
        rx={20}
        ry={7}
        transform="rotate(-18 30 20)"
        fill="#fff"
        opacity={0.2}
      />
      <Simbolos tipo={tipo} valor={girando ?? valor} cova={cova} />
    </svg>
  );
}
