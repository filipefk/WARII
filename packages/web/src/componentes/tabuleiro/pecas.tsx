// Desenhos pequenos reutilizados no mapa, nas bases, nos dados e nas cartas.

// Caça a jato de asa delta visto de cima (nariz para cima), centrado na origem (ativo "caca-delta").
export const CACA_DELTA =
  "M0,-34 L3,-24 L4,-8 L17,16 L17,22 L5,20 L6,26 L10,30 L-10,30 L-6,26 L-5,20 L-17,22 L-17,16 L-4,-8 L-3,-24Z";
// Três riscos de movimento atrás da cauda do caça.
export const RASTRO_CACA = "M-6,36V43M0,36V45M6,36V43";

// Alfinete de centro estratégico com a ponta na origem (ativo "centro-estrategico").
export function AlfineteCE({ x, y, escala = 1 }: { x: number; y: number; escala?: number }) {
  return (
    <g transform={`translate(${x} ${y})${escala === 1 ? "" : ` scale(${escala})`}`}>
      <path
        d="M0,0 c-6,-7 -8,-10 -8,-14 a8,8 0 1,1 16,0 c0,4 -2,7 -8,14z"
        fill="var(--color-route)"
        stroke="var(--color-bg)"
        strokeWidth={1.2}
      />
      <circle cy={-14} r={3.2} fill="var(--color-ce-dot)" />
    </g>
  );
}
