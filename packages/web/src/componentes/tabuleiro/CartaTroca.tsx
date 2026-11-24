// Carta de troca em SVG (componente CartaTroca do sistema). Moldura igual para as 61 cartas; o miolo
// é o número (carta numérica) ou a silhueta dos territórios recortada do próprio mapa. Precisa do
// <DefsDoJogo> montado na mesma tela.
import {
  type CartaDeTroca,
  territorio as dadosDoTerritorio,
  territoriosDaCarta,
} from "@warii/engine";
import type { Geografia } from "../../mapa/geografia";
import { corDoTerritorio } from "../../ui/tokens";
import {
  ID_CARTA_AVIAO,
  ID_CARTA_MIOLO,
  ID_CARTA_SOLDADO,
  ID_CARTA_VERMELHO,
  UsoDaParte,
} from "./DefsDoJogo";
import { AlfineteCE } from "./pecas";

// Área do desenho dentro da carta: x 7..87, y 32..104.
const AREA_L = 80;
const AREA_A = 72;
const RAIOS_RADAR = [12, 24, 36, 48, 60];

function Moldura({ linhas, children }: { linhas: string[]; children: React.ReactNode }) {
  const n = linhas.length;
  const fonte = n === 1 ? 9.5 : n === 2 ? 8.2 : 7.2;
  const entrelinha = fonte * 1.12;
  const y0 = 120 - (n * entrelinha) / 2 + fonte * 0.78;
  return (
    <>
      <rect width={94} height={140} rx={7} fill="var(--color-carta-moldura)" />
      <rect x={4} y={4} width={86} height={132} rx={4} fill={`url(#${ID_CARTA_VERMELHO})`} />
      <g
        clipPath={`url(#${ID_CARTA_MIOLO})`}
        fill="none"
        stroke="var(--color-route)"
        strokeOpacity={0.25}
        strokeWidth={0.8}
      >
        {RAIOS_RADAR.map((r) => (
          <circle key={r} cx={47} cy={68} r={r} />
        ))}
        <path d="M47 0V140M0 68H94" />
      </g>
      <rect x={8} y={8} width={22} height={20} rx={2.5} fill="var(--color-carta-papel)" />
      <use
        href={`#${ID_CARTA_AVIAO}`}
        transform="translate(9 8) scale(.83)"
        fill="var(--color-carta-moldura)"
      />
      <rect x={64} y={8} width={22} height={20} rx={2.5} fill="var(--color-carta-papel)" />
      <use
        href={`#${ID_CARTA_SOLDADO}`}
        transform="translate(65 8) scale(.83)"
        fill="var(--color-carta-moldura)"
      />
      {children}
      <g
        fontWeight={800}
        fill="var(--color-route)"
        textAnchor="middle"
        paintOrder="stroke"
        stroke="var(--color-carta-contorno-texto)"
        strokeWidth={2}
        strokeLinejoin="round"
        fontSize={fonte}
      >
        {linhas.map((l, i) => (
          <text
            key={i}
            x={47}
            y={(y0 + i * entrelinha).toFixed(1)}
            {...(l.length * fonte * 0.56 > 80 && {
              textLength: 80,
              lengthAdjust: "spacingAndGlyphs",
            })}
          >
            {l}
          </text>
        ))}
      </g>
    </>
  );
}

function Silhueta({ carta, geografia }: { carta: CartaDeTroca; geografia: Geografia }) {
  const ids = territoriosDaCarta(carta);
  const caixas = ids.map((t) => geografia.territorios[t].caixa);
  const x0 = Math.min(...caixas.map((c) => c[0]));
  const y0 = Math.min(...caixas.map((c) => c[1]));
  const x1 = Math.max(...caixas.map((c) => c[2]));
  const y1 = Math.max(...caixas.map((c) => c[3]));
  const s = Math.min(AREA_L / (x1 - x0), AREA_A / (y1 - y0));
  const tx = (AREA_L - (x1 - x0) * s) / 2 - x0 * s;
  const ty = (AREA_A - (y1 - y0) * s) / 2 - y0 * s;
  const comAlfinete = carta.tipo === "territorio";
  return (
    <svg x={7} y={32} width={AREA_L} height={AREA_A} overflow="hidden">
      <g
        transform={`translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)})`}
        stroke="var(--color-route)"
        strokeWidth={0.7}
        strokeOpacity={0.9}
        strokeLinejoin="round"
        className="carta-silhueta"
      >
        {ids.map((t) => {
          const dados = dadosDoTerritorio(t);
          return (
            <g key={t} fill={corDoTerritorio(dados.continente, geografia.territorios[t].tom)}>
              {geografia.territorios[t].partes.map((parte, i) => (
                <UsoDaParte key={i} territorio={t} indice={i} parte={parte} />
              ))}
            </g>
          );
        })}
      </g>
      {comAlfinete &&
        ids
          .filter((t) => dadosDoTerritorio(t).centroEstrategico)
          .map((t) => {
            const [px, py] = geografia.territorios[t].rotulo;
            return <AlfineteCE key={t} x={px * s + tx} y={py * s + ty} escala={0.62} />;
          })}
    </svg>
  );
}

interface Props {
  carta: CartaDeTroca;
  geografia: Geografia;
  // Largura em px (a altura segue a proporção 94×140).
  largura?: number;
  marcada?: boolean;
  onClick?: () => void;
  desabilitada?: boolean;
}

export function CartaTroca({
  carta,
  geografia,
  largura = 94,
  marcada = false,
  onClick,
  desabilitada = false,
}: Props) {
  const conteudo =
    carta.tipo === "numerica" ? (
      <Moldura linhas={[`+${carta.valor} unidades`]}>
        <rect
          x={22}
          y={38}
          width={50}
          height={58}
          rx={7}
          fill="var(--color-carta-papel)"
          stroke="var(--color-carta-vermelho-fundo)"
          strokeWidth={2}
        />
        <text
          x={47}
          y={80}
          textAnchor="middle"
          fontSize={38}
          fontWeight={900}
          fill="var(--color-dado-ataque)"
        >
          {carta.valor}
        </text>
      </Moldura>
    ) : (
      <Moldura linhas={carta.nome.split(", ")}>
        <Silhueta carta={carta} geografia={geografia} />
      </Moldura>
    );
  const svg = (
    <svg
      viewBox="0 0 94 140"
      width={largura}
      height={(largura * 140) / 94}
      className="carta-troca block"
      role="img"
      aria-label={carta.tipo === "numerica" ? `Carta +${carta.valor}` : `Carta ${carta.nome}`}
    >
      {conteudo}
    </svg>
  );
  if (!onClick) return svg;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitada}
      aria-pressed={marcada}
      className={`carta-botao ${marcada ? "marcada" : ""}`}
    >
      {svg}
    </button>
  );
}
