// Mapa do jogo (componente Tabuleiro do sistema): moldura com radar, territórios, fronteiras, rotas
// marítimas, rótulos e as 6 bases aéreas, com zoom pela roda e arraste. Território livre tem a cor
// do continente; ocupado, a do dono. Só desenha: o estado vem
// da visão da partida e os cliques são repassados a quem usa.
import {
  CONTINENTES,
  ehTerritorioId,
  FRONTEIRAS,
  type CorId,
  IDS_CONTINENTES,
  TERRITORIOS,
  type TerritorioId,
} from "@warii/engine";
import { select, zoom } from "d3";
import { type MouseEvent, useEffect, useMemo, useRef } from "react";
import { chaveDaRota, type Geografia } from "../../mapa/geografia";
import { TONS } from "../../ui/cores";
import { corClareadaDoContinente, corDoTerritorio } from "../../ui/tokens";
import { BaseAerea } from "./BaseAerea";
import { idContornoPais, idRecorteFronteira, UsoDaParte } from "./DefsDoJogo";
import { MarcadorTerritorio } from "./MarcadorTerritorio";

export interface TerritorioNoMapa {
  dono: CorId | null;
  exercitos: number;
}

export interface BaseNoMapa {
  dono: CorId;
  bombardeiros: number;
}

interface Props {
  geografia: Geografia;
  // Dono (cor) e exércitos de cada território.
  territorio: (id: TerritorioId) => TerritorioNoMapa;
  // Uma por assento, na ordem da mesa (até 6).
  bases: readonly (BaseNoMapa | null)[];
  // Território mostrado no painel.
  selecionado?: TerritorioId | null;
  // Escolhidos na interação em andamento (ex.: origem do ataque); ficam realçados.
  marcados?: ReadonlySet<TerritorioId>;
  // Quando definido, só estes respondem ao clique como opção; os demais ficam esmaecidos.
  opcoes?: ReadonlySet<TerritorioId> | null;
  onClicar?: (territorio: TerritorioId | null) => void;
}

const POSICOES_BASES = (largura: number, altura: number): [number, number][] => [
  [230, 40],
  [largura / 2, 40],
  [largura - 230, 40],
  [230, altura - 34],
  [largura / 2, altura - 34],
  [largura - 230, altura - 34],
];

const ANEIS = [120, 230, 340, 450, 560];

function Radar({ largura, altura }: { largura: number; altura: number }) {
  const cx = largura / 2;
  const cy = altura / 2 + 10;
  const raios = Array.from({ length: 24 }, (_, i) => (i * 15 * Math.PI) / 180);
  return (
    <g
      clipPath="url(#tabuleiro-moldura)"
      fill="none"
      stroke="var(--color-board-rings)"
      style={{ opacity: "var(--opacidade-radar)" }}
    >
      {ANEIS.map((r) => (
        <circle key={r} cx={cx} cy={cy} r={r} strokeWidth={r % 220 ? 2 : 6} />
      ))}
      {raios.map((a) => (
        <line
          key={a}
          x1={cx + 120 * Math.cos(a)}
          y1={cy + 120 * Math.sin(a)}
          x2={cx + 600 * Math.cos(a)}
          y2={cy + 600 * Math.sin(a)}
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

export function Tabuleiro({
  geografia,
  territorio,
  bases,
  selecionado = null,
  marcados,
  opcoes = null,
  onClicar,
}: Props) {
  const { largura, altura } = geografia;
  const svgRef = useRef<SVGSVGElement>(null);
  const raizRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const raiz = raizRef.current;
    if (!svg || !raiz) return () => {};
    const comportamento = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([
        [0, 0],
        [largura, altura],
      ])
      .on("zoom", (e: { transform: { toString(): string } }) => {
        raiz.setAttribute("transform", e.transform.toString());
      });
    const selecao = select(svg);
    selecao.call(comportamento);
    return () => {
      selecao.on(".zoom", null);
    };
  }, [largura, altura]);

  const cores = useMemo(
    () =>
      new Map(
        TERRITORIOS.map((t) => [
          t.id,
          corDoTerritorio(t.continente, geografia.territorios[t.id].tom),
        ]),
      ),
    [geografia],
  );
  const coresContinentes = useMemo(
    () => new Map(IDS_CONTINENTES.map((c) => [c, corClareadaDoContinente(c, 0.4)])),
    [],
  );
  const rotas = useMemo(
    () =>
      FRONTEIRAS.flatMap(([a, b, tipo]) => {
        const rota = tipo === "terrestre" ? undefined : geografia.rotas[chaveDaRota(a, b)];
        return rota ? [{ a, b, rota }] : [];
      }),
    [geografia],
  );

  const realcados = new Set<TerritorioId>(marcados);
  if (selecionado) realcados.add(selecionado);

  const clicar = (e: MouseEvent<SVGSVGElement>) => {
    if (!onClicar) return;
    const alvo = e.target instanceof Element ? e.target.closest("[data-territorio]") : null;
    const id = alvo?.getAttribute("data-territorio") ?? "";
    onClicar(ehTerritorioId(id) ? id : null);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="xMidYMid meet"
      className="mapa block h-full w-full select-none"
      onClick={clicar}
      role="img"
      aria-label="Tabuleiro"
    >
      <defs>
        <radialGradient id="tabuleiro-fundo" cx="50%" cy="48%" r="70%">
          <stop offset="0%" stopColor="var(--color-board-glow)" />
          <stop offset="55%" stopColor="var(--color-board-mid)" />
          <stop offset="100%" stopColor="var(--color-board-edge)" />
        </radialGradient>
        <clipPath id="tabuleiro-moldura">
          <rect x={10} y={10} width={largura - 20} height={altura - 20} rx={14} />
        </clipPath>
      </defs>
      <g ref={raizRef}>
        <rect
          x={10}
          y={10}
          width={largura - 20}
          height={altura - 20}
          rx={14}
          fill="url(#tabuleiro-fundo)"
          stroke="var(--color-board-frame)"
          strokeWidth={4}
        />
        <Radar largura={largura} altura={altura} />

        {/* Terra opaca sob os territórios: o esmaecido (opacidade) clareia sobre ela em vez de
            deixar o tabuleiro aparecer, o que faria o território preto sumir no fundo. */}
        <g className="mapa-terra" aria-hidden="true">
          {TERRITORIOS.map((t) =>
            geografia.territorios[t.id].partes.map((parte, i) => (
              <UsoDaParte key={`${t.id}-${i}`} territorio={t.id} indice={i} parte={parte} />
            )),
          )}
        </g>

        <g>
          {TERRITORIOS.map((t) => {
            const geo = geografia.territorios[t.id];
            const { dono } = territorio(t.id);
            const esmaecido = opcoes !== null && !opcoes.has(t.id) && !realcados.has(t.id);
            const classes = ["mapa-territorio"];
            if (realcados.has(t.id)) classes.push("realcado");
            if (esmaecido) classes.push("esmaecido");
            if (opcoes?.has(t.id)) classes.push("opcao");
            return (
              <g
                key={t.id}
                data-territorio={t.id}
                className={classes.join(" ")}
                fill={dono ? TONS[dono].fundo : cores.get(t.id)}
              >
                <title>{t.nome}</title>
                {geo.partes.map((parte, i) => (
                  <UsoDaParte key={i} territorio={t.id} indice={i} parte={parte} />
                ))}
              </g>
            );
          })}
        </g>

        <g className="mapa-fronteiras">
          {geografia.fronteiras.map((f, i) => {
            const caminho = (
              <path d={f.d} clipPath={f.recorte ? `url(#${idRecorteFronteira(i)})` : undefined} />
            );
            return f.recortePais ? (
              <g key={i} clipPath={`url(#${idContornoPais(f.recortePais)})`}>
                {caminho}
              </g>
            ) : (
              <g key={i}>{caminho}</g>
            );
          })}
        </g>

        <g className="mapa-rotas">
          {rotas.map(({ a, b, rota }) => {
            const destacada = realcados.has(a) || realcados.has(b);
            return (
              <g key={`${a}|${b}`} className={destacada ? "destacada" : undefined}>
                <path d={rota.d} />
                {rota.pontas.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={2.6} />
                ))}
              </g>
            );
          })}
        </g>

        <g>
          {geografia.oceanos.map((o, i) => (
            <text key={i} className="mapa-oceano" x={o.ponto[0]} y={o.ponto[1]}>
              {o.texto}
            </text>
          ))}
          {IDS_CONTINENTES.map((c) => {
            const [x, y] = geografia.continentes[c];
            return (
              <text key={c} className="mapa-continente" x={x} y={y} fill={coresContinentes.get(c)}>
                {CONTINENTES[c].nome}
              </text>
            );
          })}
        </g>

        <g>
          {POSICOES_BASES(largura, altura).map(([x, y], i) => {
            const base = bases[i] ?? null;
            return (
              <BaseAerea
                key={i}
                x={x}
                y={y}
                dono={base?.dono ?? null}
                bombardeiros={base?.bombardeiros ?? 0}
              />
            );
          })}
        </g>

        <g>
          {TERRITORIOS.map((t) => {
            const geo = geografia.territorios[t.id];
            const estado = territorio(t.id);
            return (
              <MarcadorTerritorio
                key={t.id}
                ponto={geo.rotulo}
                nome={t.nome}
                sub={geo.sub}
                centro={t.centroEstrategico}
                dono={estado.dono}
                exercitos={estado.exercitos}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
