// Desenhos pequenos reutilizados no mapa, nas bases, nos dados e nas cartas.

// Caça a jato de asa delta visto de cima (nariz para cima), centrado na origem (ativo "caca-delta").
export const CACA_DELTA =
  "M0,-34 L3,-24 L4,-8 L17,16 L17,22 L5,20 L6,26 L10,30 L-10,30 L-6,26 L-5,20 L-17,22 L-17,16 L-4,-8 L-3,-24Z";
// Nervura central (fuselagem) e cabine, que dão relevo ao caça em 3D.
const NERVURA_CACA = "M0,-30 L0,26";
const CABINE_CACA = "M0,-24 C2.2,-20 2.2,-14 0,-11 C-2.2,-14 -2.2,-20 0,-24Z";
// Gradiente de volume do caça, definido no <defs> do Tabuleiro.
export const ID_VOLUME_CACA = "caca-volume";

// Caça com volume: sombra projetada no tabuleiro (a luz vem do alto à esquerda, então a sombra
// não gira com o avião), corpo na cor do dono, luz e sombra de um lado ao outro da asa, nervura e
// cabine. `altura` afasta a sombra, como se o avião estivesse mais alto.
export function Caca3D({
  cor,
  rotacao = 0,
  altura = 1,
  classeSombra,
}: {
  cor: string;
  rotacao?: number;
  altura?: number;
  classeSombra?: string;
}) {
  const giro = rotacao ? `rotate(${rotacao})` : undefined;
  return (
    <g className="caca-3d">
      <g transform={`translate(${4 * altura} ${7 * altura})`}>
        <g className={classeSombra}>
          <path d={CACA_DELTA} transform={giro} fill="#000" opacity={0.45} />
        </g>
      </g>
      <g transform={giro}>
        <path d={CACA_DELTA} fill={cor} />
        <path d={CACA_DELTA} fill={`url(#${ID_VOLUME_CACA})`} />
        <path d={NERVURA_CACA} stroke="#fff" strokeOpacity={0.55} strokeWidth={1.6} />
        <path d={CABINE_CACA} fill="#0b1a26" stroke="#fff" strokeOpacity={0.6} strokeWidth={0.8} />
        <path
          d={CACA_DELTA}
          fill="none"
          stroke="#000"
          strokeOpacity={0.55}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

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
