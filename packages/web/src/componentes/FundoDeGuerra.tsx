// Fundo ilustrado das telas: um trecho do mapa-múndi (mesma projeção do tabuleiro) com o radar
// do jogo, caças voando e um panorama de batalha em silhueta no pé da tela. Fica fixo atrás do
// conteúdo, só decora (aria-hidden) e não recebe cliques. Imagens em public/fundos/.
import type { CSSProperties } from "react";
import { useLocation } from "react-router";

const MASCARA_CENAS = "linear-gradient(to bottom, transparent 0%, #000 55%)";

// Largura e altura do mapa-mundi.svg (as mesmas do tabuleiro).
const MAPA_L = 1640;

interface Caca {
  src: string;
  // Largura em vw, com teto em px.
  largura: number;
  maximo: number;
  // Posição do canto superior esquerdo ou direito, em % da tela.
  lado: "esquerda" | "direita";
  x: number;
  y: number;
  opacidade: number;
}

interface Composicao {
  // Ponto do mapa (em px do SVG 1640×900) que fica no ponto (x%, y%) da tela.
  foco: [number, number];
  na: [number, number];
  // Largura do mapa em múltiplos da largura da tela.
  escala: number;
  cacas: Caca[];
}

const ESQUADRILHA = "/fundos/caca-esquadrilha.png";
const INCLINADO = "/fundos/caca-inclinado.png";
const TRES_QUARTOS = "/fundos/caca-tres-quartos.png";

// Cada grupo de telas mostra outra parte do mundo e outros aviões.
const COMPOSICOES = {
  // Login, definir senha e convite: Europa e Atlântico, esquadrilha grande.
  abertura: {
    foco: [840, 330],
    na: [62, 40],
    escala: 2.4,
    cacas: [
      { src: ESQUADRILHA, largura: 46, maximo: 640, lado: "direita", x: 2, y: 10, opacidade: 0.5 },
      {
        src: TRES_QUARTOS,
        largura: 16,
        maximo: 220,
        lado: "esquerda",
        x: 6,
        y: 18,
        opacidade: 0.35,
      },
    ],
  },
  // Lista de partidas: as Américas.
  lobby: {
    foco: [425, 450],
    na: [30, 45],
    escala: 2.2,
    cacas: [
      { src: ESQUADRILHA, largura: 30, maximo: 440, lado: "direita", x: 2, y: 42, opacidade: 0.4 },
    ],
  },
  // Sala de espera e partida: Ásia e Oceania.
  partida: {
    foco: [1250, 470],
    na: [65, 50],
    escala: 2.3,
    cacas: [
      { src: INCLINADO, largura: 26, maximo: 380, lado: "esquerda", x: 2, y: 48, opacidade: 0.35 },
    ],
  },
  // Conta e demais: África.
  outras: {
    foco: [862, 560],
    na: [50, 55],
    escala: 2.6,
    cacas: [
      { src: TRES_QUARTOS, largura: 18, maximo: 260, lado: "direita", x: 4, y: 50, opacidade: 0.4 },
    ],
  },
} satisfies Record<string, Composicao>;

type Variante = keyof typeof COMPOSICOES;

function varianteDaRota(caminho: string): Variante {
  if (/^\/(entrar|definir-senha|convite)/.test(caminho)) return "abertura";
  if (caminho === "/partidas" || caminho === "/") return "lobby";
  if (caminho.startsWith("/partidas/") || caminho === "/tabuleiro") return "partida";
  return "outras";
}

// Radar do tabuleiro: 5 anéis concêntricos e raios a cada 15°, em board-rings.
function Radar({ x, y }: { x: number; y: number }) {
  const raios = [120, 230, 340, 450, 560];
  const linhas = Array.from({ length: 24 }, (_, i) => (i * 15 * Math.PI) / 180);
  return (
    <svg
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%`, width: 1240, height: 1240, translate: "-50% -50%" }}
      viewBox="-620 -620 1240 1240"
    >
      <g fill="none" stroke="var(--color-board-rings)" opacity={0.14}>
        {raios.map((r, i) => (
          <circle key={r} r={r} strokeWidth={i % 2 ? 6 : 2} />
        ))}
        {linhas.map((a) => (
          <line
            key={a}
            x1={120 * Math.cos(a)}
            y1={120 * Math.sin(a)}
            x2={620 * Math.cos(a)}
            y2={620 * Math.sin(a)}
            strokeWidth={1.5}
          />
        ))}
      </g>
    </svg>
  );
}

export function FundoDeGuerra() {
  const { pathname } = useLocation();
  const { foco, na, escala, cacas }: Composicao = COMPOSICOES[varianteDaRota(pathname)];
  const [fx, fy] = foco;
  const [px, py] = na;
  const fator = escala / MAPA_L;

  const mapa: CSSProperties = {
    width: `${escala * 100}vw`,
    left: `calc(${px}vw - ${fx * fator * 100}vw)`,
    top: `calc(${py}vh - ${fy * fator * 100}vw)`,
  };
  // O mapa e o radar somem em direção às bordas.
  const mascara = `radial-gradient(ellipse 70% 65% at ${px}% ${py}%, #000 25%, transparent 80%)`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      <div className="absolute inset-0" style={{ maskImage: mascara, WebkitMaskImage: mascara }}>
        <img
          src="/fundos/mapa-mundi.svg"
          alt=""
          className="absolute max-w-none opacity-45"
          style={mapa}
        />
        <Radar x={px} y={py} />
      </div>

      {/* O desenho tem céu opaco: o alto some aos poucos para emendar com o mapa. */}
      <img
        src="/fundos/cenas-de-guerra.svg"
        alt=""
        className="absolute bottom-0 left-0 h-[clamp(150px,34vh,380px)] w-full object-cover object-bottom"
        style={{ maskImage: MASCARA_CENAS, WebkitMaskImage: MASCARA_CENAS }}
      />

      {cacas.map((c) => (
        <img
          key={c.src}
          src={c.src}
          alt=""
          className="fundo-caca absolute h-auto"
          style={{
            width: `min(${c.largura}vw, ${c.maximo}px)`,
            [c.lado === "direita" ? "right" : "left"]: `${c.x}%`,
            top: `${c.y}%`,
            opacity: c.opacidade,
          }}
        />
      ))}

      {/* Véu: escurece o alto da tela, onde ficam os títulos, e o centro, onde fica o conteúdo. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, var(--color-bg) 0%, rgba(27,20,16,0.55) 22%, rgba(27,20,16,0.25) 60%, transparent 85%)",
        }}
      />
    </div>
  );
}
