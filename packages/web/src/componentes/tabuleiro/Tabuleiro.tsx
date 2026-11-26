// Mapa do jogo (componente Tabuleiro do sistema): moldura com radar, territórios, fronteiras, rotas
// marítimas, rótulos e as 6 bases aéreas, com zoom pela roda e arraste. O mundo é uma fita
// contínua no sentido leste–oeste (cópias a cada `geografia.periodo`); moldura e bases ficam
// fixas na tela. Território livre tem a cor
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
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { chaveDaRota, type Geografia } from "../../mapa/geografia";
import { TONS } from "../../ui/cores";
import { corClareadaDoContinente, corDoTerritorio } from "../../ui/tokens";
import { BaseAerea } from "./BaseAerea";
import { idContornoPais, idRecorteFronteira, UsoDaParte } from "./DefsDoJogo";
import { ID_RELEVO_BASE } from "./BaseAerea";
import { MarcadorTerritorio } from "./MarcadorTerritorio";
import { Caca3D, ID_VOLUME_CACA } from "./pecas";

export interface TerritorioNoMapa {
  dono: CorId | null;
  exercitos: number;
}

export interface BaseNoMapa {
  dono: CorId;
  bombardeiros: number;
}

// Ataque aéreo em curso: os bombardeiros em combate saem da base do atacante e ficam sobre o alvo.
export interface VooNoMapa {
  // Assento do atacante (índice em `bases`).
  base: number;
  cor: CorId;
  alvo: TerritorioId;
  bombardeiros: number;
  // Abatidos no primeiro ciclo, quando o ataque começa neste lote: voam junto e caem ao chegar.
  abatidosNaChegada?: number;
}

export interface ExplosoesNoMapa {
  // Identifica o lote (as explosões tocam uma vez por lote).
  seq: number;
  base: number;
  alvo: TerritorioId;
  // Bombardeiros que seguem em combate (ou sobreviventes): os abatidos vêm logo depois deles na
  // formação.
  restantes: number;
  avioes: number;
  exercitos: number;
  // Espera (ms) até a esquadrilha chegar ao alvo, quando ela parte neste mesmo lote.
  atraso: number;
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
  voo?: VooNoMapa | null;
  // Fim do ataque aéreo: os sobreviventes voltam do alvo para a base (`seq` identifica o lote).
  // `saida` = bombardeiros que partiram, quando o ataque começou e acabou no mesmo lote: aí a
  // esquadrilha faz a ida e a volta, e os abatidos somem sobre o alvo.
  volta?: (VooNoMapa & { seq: number; saida: number | null }) | null;
  // Perdas de um ciclo aéreo: explosões nos bombardeiros abatidos e sobre o alvo.
  explosoes?: ExplosoesNoMapa | null;
  onClicar?: (territorio: TerritorioId | null) => void;
  // Painel HTML no canto inferior esquerdo (Pacífico), fora do zoom: some ao aproximar.
  cantoInferiorEsquerdo?: ReactNode;
  // Enquadra só estes territórios (com uma folga em volta), sem zoom nem arraste: o mapa da
  // janela de combate.
  foco?: readonly TerritorioId[] | null;
}

// Proporção (largura / altura) do recorte de `foco`; quem usa dá a mesma proporção à área.
export const PROPORCAO_DO_FOCO = 1.45;

// Recorte do mapa em volta dos territórios: a caixa deles com folga, um tamanho mínimo e na
// proporção do foco. Cada território entra pela cópia do mundo mais perto do primeiro (Alasca e
// Vladivostok ficam lado a lado no estreito); na vertical, sem sair do tabuleiro.
function caixaDoFoco(
  geografia: Geografia,
  ids: readonly TerritorioId[],
): [x: number, y: number, w: number, h: number] {
  const { altura, periodo } = geografia;
  const referencia = ids[0] ? geografia.territorios[ids[0]].rotulo[0] : 0;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const id of ids) {
    const { caixa, rotulo } = geografia.territorios[id];
    const d = Math.round((referencia - rotulo[0]) / periodo) * periodo;
    x0 = Math.min(x0, caixa[0] + d, rotulo[0] + d);
    y0 = Math.min(y0, caixa[1], rotulo[1]);
    x1 = Math.max(x1, caixa[2] + d, rotulo[0] + d);
    y1 = Math.max(y1, caixa[3], rotulo[1]);
  }
  let w = Math.max((x1 - x0) * 1.6, 300);
  let h = Math.max((y1 - y0) * 1.6, 300 / PROPORCAO_DO_FOCO);
  if (w / h < PROPORCAO_DO_FOCO) w = h * PROPORCAO_DO_FOCO;
  else h = w / PROPORCAO_DO_FOCO;
  if (h > altura) {
    h = altura;
    w = h * PROPORCAO_DO_FOCO;
  }
  const x = (x0 + x1) / 2 - w / 2;
  const y = Math.max(0, Math.min(altura - h, (y0 + y1) / 2 - h / 2));
  return [x, y, w, h];
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

// Cópias do mundo lado a lado (em múltiplos do período): com elas o arraste leste–oeste não tem
// fim e o estreito de Bering fica contínuo.
const COPIAS = [-1, 0, 1] as const;

interface Transformacao {
  k: number;
  x: number;
  y: number;
}

const IDENTIDADE: Transformacao = { k: 1, x: 0, y: 0 };

// Leva o deslocamento horizontal para perto de zero, em múltiplos do período na escala atual: as
// três cópias cobrem a tela qualquer que seja o arraste.
function normalizar({ k, x, y }: Transformacao, periodo: number): Transformacao {
  const volta = periodo * k;
  return { k, x: x - volta * Math.round(x / volta), y };
}

const textoDaTransformacao = ({ k, x, y }: Transformacao) => `translate(${x},${y}) scale(${k})`;

// Ponto do mundo na cópia mais próxima de `perto` (só no eixo x).
function copiaMaisProxima(
  ponto: readonly [number, number],
  perto: number,
  periodo: number,
): [number, number] {
  const n = Math.round((perto - ponto[0]) / periodo);
  return [ponto[0] + n * periodo, ponto[1]];
}

// Camada do mundo repetida nas cópias.
function Copias({ periodo, children }: { periodo: number; children: ReactNode }) {
  return (
    <>
      {COPIAS.map((n) => (
        <g key={n} transform={n === 0 ? undefined : `translate(${n * periodo} 0)`}>
          {children}
        </g>
      ))}
    </>
  );
}

export function Tabuleiro({
  geografia,
  territorio,
  bases,
  selecionado = null,
  marcados,
  opcoes = null,
  voo = null,
  volta = null,
  explosoes = null,
  onClicar,
  cantoInferiorEsquerdo,
  foco = null,
}: Props) {
  const { largura, altura, periodo } = geografia;
  const svgRef = useRef<SVGSVGElement>(null);
  // Os grupos do mundo (abaixo e acima do acabamento e das bases) recebem o mesmo transform.
  const raizesRef = useRef<(SVGGElement | null)[]>([]);
  const transformacaoRef = useRef<Transformacao>(IDENTIDADE);
  // O painel do canto só aparece com o mapa inteiro à vista (zoom 1).
  const [semZoom, setSemZoom] = useState(true);
  // Com um ataque aéreo à mostra, a esquadrilha (presa às bases, fixas na tela) acompanha o mapa:
  // só então o arraste redesenha o componente.
  const animando = voo !== null || volta !== null || explosoes !== null;
  const animandoRef = useRef(animando);
  const [transformacao, setTransformacao] = useState(IDENTIDADE);
  useEffect(() => {
    animandoRef.current = animando;
    if (animando) setTransformacao(transformacaoRef.current);
  }, [animando]);

  const comFoco = foco !== null && foco.length > 0;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || comFoco) {
      transformacaoRef.current = IDENTIDADE;
      return () => {};
    }
    const aplicar = (t: Transformacao) => {
      transformacaoRef.current = t;
      const texto = textoDaTransformacao(t);
      for (const raiz of raizesRef.current) raiz?.setAttribute("transform", texto);
    };
    const comportamento = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      // Sem limite no sentido leste–oeste (o mundo se repete); de norte a sul, o tabuleiro.
      .translateExtent([
        [-Infinity, 0],
        [Infinity, altura],
      ])
      .on("zoom", (e: { transform: Transformacao }) => {
        aplicar(normalizar(e.transform, periodo));
        setSemZoom(e.transform.k <= 1);
        if (animandoRef.current) setTransformacao(transformacaoRef.current);
      });
    const selecao = select(svg);
    selecao.call(comportamento);
    return () => {
      selecao.on(".zoom", null);
    };
  }, [altura, periodo, comFoco]);

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
    // O território ou a pilha de fichas dele (que fica por cima e pode cair sobre o mar).
    const alvo =
      e.target instanceof Element ? e.target.closest("[data-territorio], [data-marcador]") : null;
    const id = alvo?.getAttribute("data-territorio") ?? alvo?.getAttribute("data-marcador") ?? "";
    onClicar(ehTerritorioId(id) ? id : null);
  };

  const caixa = comFoco ? caixaDoFoco(geografia, foco) : null;
  const t = comFoco ? IDENTIDADE : transformacao;
  const raiz = (i: number) => (g: SVGGElement | null) => {
    raizesRef.current[i] = g;
  };
  // No foco não há moldura: o recorte pode passar da borda do tabuleiro (Bering).
  const recorte = comFoco ? undefined : "url(#tabuleiro-moldura)";
  const posicoes = POSICOES_BASES(largura, altura);
  // Alvo de uma esquadrilha na tela: a cópia do território mais perto da base de partida.
  const naTela = (base: number, alvo: TerritorioId): [number, number] => {
    const de = posicoes[base] ?? [largura / 2, 40];
    const rotulo = geografia.territorios[alvo].rotulo;
    if (comFoco) return [rotulo[0], rotulo[1]];
    const [x, y] = copiaMaisProxima(rotulo, (de[0] - t.x) / t.k, periodo);
    return [x * t.k + t.x, y * t.k + t.y];
  };

  return (
    <svg
      ref={svgRef}
      viewBox={caixa ? caixa.join(" ") : `0 0 ${largura} ${altura}`}
      preserveAspectRatio="xMidYMid meet"
      className="mapa block h-full w-full select-none"
      onClick={clicar}
      role="img"
      aria-label={comFoco ? "Local do combate" : "Tabuleiro"}
    >
      <defs>
        <radialGradient id="tabuleiro-fundo" cx="50%" cy="48%" r="70%">
          <stop offset="0%" stopColor="var(--color-board-glow)" />
          <stop offset="55%" stopColor="var(--color-board-mid)" />
          <stop offset="100%" stopColor="var(--color-board-edge)" />
        </radialGradient>
        {/* Volume dos caças: luz na asa esquerda, brilho na fuselagem e sombra na direita. */}
        <linearGradient id={ID_VOLUME_CACA} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#fff" stopOpacity={0.5} />
          <stop offset=".42" stopColor="#fff" stopOpacity={0.08} />
          <stop offset=".5" stopColor="#fff" stopOpacity={0.35} />
          <stop offset=".58" stopColor="#000" stopOpacity={0.08} />
          <stop offset="1" stopColor="#000" stopOpacity={0.5} />
        </linearGradient>
        <radialGradient id={ID_FOGO}>
          <stop offset="0" stopColor="#fff" />
          <stop offset=".3" stopColor="var(--color-accent)" />
          <stop offset=".7" stopColor="var(--color-bad)" stopOpacity={0.85} />
          <stop offset="1" stopColor="var(--color-bad)" stopOpacity={0} />
        </radialGradient>
        {/* Grão de papelão impresso: ruído em tons de cinza, aplicado por cima do mapa. */}
        <filter id="tabuleiro-ruido" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".85"
            numOctaves={2}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <pattern id={ID_GRAO} width={240} height={240} patternUnits="userSpaceOnUse">
          <rect width={240} height={240} filter="url(#tabuleiro-ruido)" />
        </pattern>
        {/* Relevo da bandeja da base aérea: luz na borda de cima e sombra embaixo. */}
        <linearGradient id={ID_RELEVO_BASE} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.14} />
          <stop offset=".18" stopColor="#fff" stopOpacity={0} />
          <stop offset=".8" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.4} />
        </linearGradient>
        <clipPath id="tabuleiro-moldura">
          <rect x={10} y={10} width={largura - 20} height={altura - 20} rx={14} />
        </clipPath>
      </defs>
      {caixa ? (
        <rect
          x={caixa[0]}
          y={caixa[1]}
          width={caixa[2]}
          height={caixa[3]}
          fill="url(#tabuleiro-fundo)"
        />
      ) : (
        <>
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
          {/* Chanfro da moldura: filete claro por dentro da borda escura. */}
          <rect
            x={13}
            y={13}
            width={largura - 26}
            height={altura - 26}
            rx={12}
            fill="none"
            stroke="#fff"
            strokeOpacity={0.09}
            strokeWidth={1.2}
            pointerEvents="none"
          />
          <Radar largura={largura} altura={altura} />
        </>
      )}

      <g clipPath={recorte}>
        <g ref={raiz(0)}>
          <Copias periodo={periodo}>
            {/* Terra opaca sob os territórios: o esmaecido (opacidade) clareia sobre ela em vez de
                deixar o tabuleiro aparecer, o que faria o território preto sumir no fundo. */}
            <g className="mapa-terra" aria-hidden="true">
              {TERRITORIOS.map((te) =>
                geografia.territorios[te.id].partes.map((parte, i) => (
                  <UsoDaParte key={`${te.id}-${i}`} territorio={te.id} indice={i} parte={parte} />
                )),
              )}
            </g>

            <g>
              {TERRITORIOS.map((te) => {
                const geo = geografia.territorios[te.id];
                const { dono } = territorio(te.id);
                const esmaecido = opcoes !== null && !opcoes.has(te.id) && !realcados.has(te.id);
                const classes = ["mapa-territorio"];
                if (realcados.has(te.id)) classes.push("realcado");
                if (esmaecido) classes.push("esmaecido");
                if (opcoes?.has(te.id)) classes.push("opcao");
                return (
                  <g
                    key={te.id}
                    data-territorio={te.id}
                    className={classes.join(" ")}
                    fill={dono ? TONS[dono].fundo : cores.get(te.id)}
                  >
                    <title>{te.nome}</title>
                    {geo.partes.map((parte, i) => (
                      <UsoDaParte key={i} territorio={te.id} indice={i} parte={parte} />
                    ))}
                  </g>
                );
              })}
            </g>

            <g className="mapa-fronteiras">
              {geografia.fronteiras.map((f, i) => {
                const caminho = (
                  <path
                    d={f.d}
                    clipPath={f.recorte ? `url(#${idRecorteFronteira(i)})` : undefined}
                  />
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
          </Copias>
        </g>
      </g>

      {/* Acabamento de tabuleiro físico, fixo na tela: grão do papelão e o vinco da dobra. */}
      {!caixa && (
        <g className="mapa-acabamento" aria-hidden="true" clipPath="url(#tabuleiro-moldura)">
          <rect
            className="mapa-grao"
            x={10}
            y={10}
            width={largura - 20}
            height={altura - 20}
            fill={`url(#${ID_GRAO})`}
          />
          <line
            x1={largura / 2}
            y1={10}
            x2={largura / 2}
            y2={altura - 10}
            stroke="#000"
            strokeOpacity={0.35}
            strokeWidth={1.6}
          />
          <line
            x1={largura / 2 + 1.6}
            y1={10}
            x2={largura / 2 + 1.6}
            y2={altura - 10}
            stroke="#fff"
            strokeOpacity={0.1}
            strokeWidth={1.2}
          />
        </g>
      )}

      <g clipPath={recorte}>
        <g ref={raiz(1)}>
          <Copias periodo={periodo}>
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
                  <text
                    key={c}
                    className="mapa-continente"
                    x={x}
                    y={y}
                    fill={coresContinentes.get(c)}
                  >
                    {CONTINENTES[c].nome}
                  </text>
                );
              })}
            </g>
          </Copias>
        </g>
      </g>

      {/* Bases aéreas fixas na tela: são da moldura do tabuleiro, não do mundo. */}
      <g>
        {posicoes.map(([x, y], i) => {
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

      <g clipPath={recorte}>
        <g ref={raiz(2)}>
          <Copias periodo={periodo}>
            {TERRITORIOS.map((te) => {
              const geo = geografia.territorios[te.id];
              const estado = territorio(te.id);
              return (
                <MarcadorTerritorio
                  key={te.id}
                  id={te.id}
                  ponto={geo.rotulo}
                  nome={te.nome}
                  sub={geo.sub}
                  centro={te.centroEstrategico}
                  dono={estado.dono}
                  exercitos={estado.exercitos}
                />
              );
            })}
          </Copias>
        </g>
      </g>

      {voo && voo.bombardeiros > 0 && (
        <Esquadrilha
          key={`${voo.base}:${voo.alvo}`}
          de={posicoes[voo.base] ?? [largura / 2, 40]}
          para={naTela(voo.base, voo.alvo)}
          cor={TONS[voo.cor].fundo}
          bombardeiros={voo.bombardeiros}
          abatidos={voo.abatidosNaChegada ?? 0}
        />
      )}
      {!voo && volta && volta.bombardeiros > 0 && (
        <Esquadrilha
          key={`volta:${volta.seq}`}
          de={posicoes[volta.base] ?? [largura / 2, 40]}
          para={naTela(volta.base, volta.alvo)}
          cor={TONS[volta.cor].fundo}
          bombardeiros={volta.bombardeiros}
          saida={volta.saida}
          volta
        />
      )}
      {explosoes && (
        <Explosoes
          key={`explosoes:${explosoes.seq}`}
          de={posicoes[explosoes.base] ?? [largura / 2, 40]}
          para={naTela(explosoes.base, explosoes.alvo)}
          explosoes={explosoes}
        />
      )}
      {cantoInferiorEsquerdo && semZoom && !comFoco && (
        // Entre a costa do Pacífico e a base aérea de baixo; o conteúdo se apoia no pé da área.
        <foreignObject x={28} y={540} width={390} height={altura - 34 - 22 - 540 - 8}>
          <div className="pointer-events-none flex h-full flex-col justify-end">
            {cantoInferiorEsquerdo}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

// Rumo (graus, 0 = nariz para cima) da base até o alvo e posição do k-ésimo avião na formação:
// em leque atrás do alvo, o primeiro na frente e os demais alternando dos lados.
function rumoDoVoo(de: readonly [number, number], para: readonly [number, number]): number {
  return (Math.atan2(para[1] - de[1], para[0] - de[0]) * 180) / Math.PI + 90;
}

function posicaoNaFormacao(
  para: readonly [number, number],
  rumo: number,
  k: number,
): [number, number] {
  const lado = k === 0 ? 0 : k % 2 ? 1 : -1;
  const fila = Math.ceil(k / 2);
  const angulo = ((rumo - 90) * Math.PI) / 180;
  const tras = 30 + fila * 16;
  return [
    para[0] - Math.cos(angulo) * tras - Math.sin(angulo) * lado * fila * 20,
    para[1] - Math.sin(angulo) * tras + Math.cos(angulo) * lado * fila * 20,
  ];
}

// Intervalo (ms) entre a partida de um avião e a do seguinte: o `--atraso` das animações.
const INTERVALO_DA_FORMACAO = 90;

// Bombardeiros do ataque aéreo: voam juntos da base até o alvo e ficam pairando em volta dele,
// apontados para ele. Os abatidos somem (a quantidade vem da visão a cada ciclo). Com `volta`,
// fazem o caminho inverso: dão meia-volta na formação e somem ao chegar à base.
function Esquadrilha({
  de,
  para,
  cor,
  bombardeiros,
  volta = false,
  saida = null,
  abatidos = 0,
}: {
  de: readonly [number, number];
  para: readonly [number, number];
  cor: string;
  bombardeiros: number;
  volta?: boolean;
  saida?: number | null;
  abatidos?: number;
}) {
  const rumo = rumoDoVoo(de, para);
  const total = volta ? Math.max(bombardeiros, saida ?? 0) : bombardeiros + abatidos;
  return (
    <g className="mapa-esquadrilha" aria-hidden="true">
      {Array.from({ length: total }, (_, k) => {
        const [px, py] = posicaoNaFormacao(para, rumo, k);
        const estilo: CSSProperties & Record<`--${string}`, string> = {
          "--dx": `${de[0] - px}px`,
          "--dy": `${de[1] - py}px`,
          "--atraso": `${k * INTERVALO_DA_FORMACAO}ms`,
        };
        return (
          <g key={k} transform={`translate(${px} ${py})`}>
            {volta && saida !== null ? (
              <g
                className={k < bombardeiros ? "caca-ida-volta" : "caca-ida-abatido"}
                style={estilo}
              >
                <g transform="scale(.55)">
                  <g className="caca-rumo-ida">
                    <Caca3D cor={cor} rotacao={rumo} altura={1.6} />
                  </g>
                  <g className="caca-rumo-volta">
                    <Caca3D cor={cor} rotacao={rumo + 180} altura={1.6} />
                  </g>
                </g>
              </g>
            ) : (
              <g
                className={
                  volta ? "caca-volta" : k < bombardeiros ? "caca-voo" : "caca-voo-abatido"
                }
                style={estilo}
              >
                <g transform="scale(.55)">
                  <Caca3D
                    cor={cor}
                    rotacao={volta ? rumo + 180 : rumo}
                    altura={2.2}
                    classeSombra={volta ? "caca-volta-sombra" : "caca-voo-sombra"}
                  />
                </g>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

const ID_FOGO = "explosao-fogo";
const ID_GRAO = "tabuleiro-grao";

// Uma explosão: clarão, bola de fogo, faíscas e fumaça, que tocam uma vez e somem.
function Explosao({
  x,
  y,
  tamanho,
  atraso,
}: {
  x: number;
  y: number;
  tamanho: number;
  atraso: number;
}) {
  const estilo: CSSProperties & Record<`--${string}`, string> = { "--atraso": `${atraso}ms` };
  return (
    <g transform={`translate(${x} ${y}) scale(${tamanho})`}>
      <g className="explosao" style={estilo}>
        <circle className="explosao-fumaca" r={14} fill="var(--color-muted)" />
        <circle className="explosao-clarao" r={16} fill={`url(#${ID_FOGO})`} />
        <g className="explosao-faiscas" stroke="var(--color-accent)" strokeLinecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4 + 0.3;
            return (
              <line
                key={i}
                x1={Math.cos(a) * 9}
                y1={Math.sin(a) * 9}
                x2={Math.cos(a) * 17}
                y2={Math.sin(a) * 17}
                strokeWidth={1.6}
              />
            );
          })}
        </g>
        <circle className="explosao-fogo" r={10} fill={`url(#${ID_FOGO})`} />
      </g>
    </g>
  );
}

// Perdas de um ciclo aéreo: uma explosão em cada bombardeiro abatido (na posição dele na
// formação) e uma por exército perdido sobre o marcador do alvo, um pouco espalhadas.
function Explosoes({
  de,
  para,
  explosoes,
}: {
  de: readonly [number, number];
  para: readonly [number, number];
  explosoes: ExplosoesNoMapa;
}) {
  const rumo = rumoDoVoo(de, para);
  const { restantes, avioes, exercitos, atraso } = explosoes;
  return (
    <g className="mapa-explosoes" aria-hidden="true">
      {Array.from({ length: avioes }, (_, i) => {
        const k = restantes + i;
        const [x, y] = posicaoNaFormacao(para, rumo, k);
        return (
          <Explosao
            key={`a${i}`}
            x={x}
            y={y}
            tamanho={1.1}
            atraso={atraso ? atraso + k * INTERVALO_DA_FORMACAO : i * 120}
          />
        );
      })}
      {Array.from({ length: Math.min(exercitos, 6) }, (_, i) => {
        const a = i * 2.4;
        const r = i === 0 ? 0 : 9;
        return (
          <Explosao
            key={`e${i}`}
            x={para[0] + Math.cos(a) * r}
            y={para[1] + Math.sin(a) * r}
            tamanho={1.5}
            atraso={atraso + 250 + i * 160}
          />
        );
      })}
    </g>
  );
}
