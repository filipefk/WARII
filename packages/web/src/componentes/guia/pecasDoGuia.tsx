// Peças do guia de regras (componentes Caixa, Fluxo, NavegacaoGuia e Simulador do sistema). Classes
// em index.css (.caixa, .fluxo, .cadeia, .ilustracao, .simulador, .guia-nav).
import type { CorId } from "@warii/engine";
import type { ReactNode } from "react";
import { TONS } from "../../ui/cores";
import { Dado } from "../tabuleiro/Dado";
import { CACA_DELTA, RASTRO_CACA } from "../tabuleiro/pecas";

// Caixa de destaque: exemplo resolvido, dica de uso ou regra que não pode ser esquecida.
export function Caixa({
  tipo,
  titulo,
  children,
}: {
  tipo: "ex" | "note" | "warn";
  titulo: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`caixa ${tipo}`}>
      <b>{titulo}</b>
      {children}
    </div>
  );
}

export interface Passo {
  simbolo: ReactNode;
  titulo: ReactNode;
  dica?: ReactNode;
}

// Passos lado a lado; com `setas`, a ordem importa e vai uma "→" entre eles.
export function Fluxo({ passos, setas = false }: { passos: readonly Passo[]; setas?: boolean }) {
  return (
    <div className="fluxo">
      {passos.map((p, i) => (
        <div key={i} className="contents">
          {setas && i > 0 && <span className="seta">→</span>}
          <div className="passo">
            <b>{p.simbolo}</b>
            {p.titulo}
            {p.dica && (
              <>
                <br />
                <span className="dica">{p.dica}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Cadeia de movimento: elos ligados por "→ ok" (good) ou "→ ✗ motivo" (bad), sempre com o texto.
export function Cadeia({
  elos,
  ligacoes,
}: {
  elos: readonly string[];
  ligacoes: readonly { ok: boolean; texto: string }[];
}) {
  return (
    <div className="cadeia">
      {elos.map((e, i) => (
        <div key={e} className="contents">
          {i > 0 && ligacoes[i - 1] && (
            <span className={ligacoes[i - 1]?.ok ? "text-good" : "text-bad"}>
              → {ligacoes[i - 1]?.ok ? "" : "✗ "}
              {ligacoes[i - 1]?.texto}
            </span>
          )}
          <span className="elo">{e}</span>
        </div>
      ))}
    </div>
  );
}

export interface SecaoDoGuia {
  id: string;
  titulo: string;
}

export function NavegacaoGuia({
  secoes,
  ativa,
  onIr,
}: {
  secoes: readonly SecaoDoGuia[];
  ativa: string | null;
  onIr: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Seções do guia"
      className="guia-nav flex max-h-[110px] shrink-0 flex-wrap overflow-y-auto border-b border-border px-espaco-3 py-espaco-4 min-[761px]:block min-[761px]:max-h-none min-[761px]:w-[220px] min-[761px]:border-r min-[761px]:border-b-0"
    >
      {secoes.map((s) => (
        <a
          key={s.id}
          href={`#guia-${s.id}`}
          className={s.id === ativa ? "ativo" : ""}
          aria-current={s.id === ativa ? "true" : undefined}
          onClick={(e) => {
            e.preventDefault();
            onIr(s.id);
          }}
        >
          {s.titulo}
        </a>
      ))}
    </nav>
  );
}

// Ficha de exército na cor do jogador, com o número opcional.
export function Ficha({ cor, numero }: { cor: CorId; numero?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={34} height={34} role="img" aria-label={`Ficha ${cor}`}>
      <circle
        cx={20}
        cy={20}
        r={16}
        fill={TONS[cor].fundo}
        stroke="var(--color-bg)"
        strokeWidth={2}
      />
      <circle cx={20} cy={20} r={10.5} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={2} />
      {numero !== undefined && (
        <text
          x={20}
          y={21}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={13}
          fontWeight={800}
          fill={TONS[cor].texto}
        >
          {numero}
        </text>
      )}
    </svg>
  );
}

// Peça de bombardeiro (caça delta) na cor do jogador.
export function PecaBombardeiro({ cor }: { cor: CorId }) {
  return (
    <svg
      viewBox="-22 -38 44 86"
      width={28}
      height={54}
      role="img"
      aria-label={`Bombardeiro ${cor}`}
    >
      <path
        d={CACA_DELTA}
        fill={TONS[cor].fundo}
        stroke="var(--color-text)"
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <path d={RASTRO_CACA} stroke="var(--color-text)" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

// "3 faces lisas, 2 faces com 1, 1 face com 2."
export function textoDasFaces(faces: readonly number[]): string {
  const contagem = new Map<number, number>();
  for (const f of faces) contagem.set(f, (contagem.get(f) ?? 0) + 1);
  return [...contagem.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(
      ([v, n]) =>
        `${n} face${n > 1 ? "s" : ""} ${v === 0 ? `lisa${n > 1 ? "s" : ""}` : `com ${v}`}`,
    )
    .join(", ");
}

export interface ResultadoDaBatalha {
  perdasAtaque: number;
  perdasDefesa: number;
}

// Comparação par a par de um ataque terrestre, só para ilustrar o guia (exemplos do manual e
// simulador). Nas partidas quem resolve o combate é o engine, no servidor.
export function resolverBatalha(ataque: readonly number[], defesa: readonly number[]) {
  const a = ataque.toSorted((x, y) => y - x);
  const d = defesa.toSorted((x, y) => y - x);
  const pares = Array.from({ length: Math.max(a.length, d.length) }, (_, i) => ({
    ataque: a[i],
    defesa: d[i],
  }));
  let perdasAtaque = 0;
  let perdasDefesa = 0;
  for (const p of pares) {
    if (p.ataque === undefined || p.defesa === undefined) continue;
    if (p.ataque > p.defesa) perdasDefesa++;
    else perdasAtaque++;
  }
  return { pares, perdasAtaque, perdasDefesa };
}

export function Batalha({
  ataque,
  defesa,
}: {
  ataque: readonly number[];
  defesa: readonly number[];
}) {
  const { pares, perdasAtaque, perdasDefesa } = resolverBatalha(ataque, defesa);
  return (
    <>
      <div className="my-espaco-2 inline-flex flex-col gap-espaco-1">
        {pares.map((p, i) => (
          <div key={i} className="flex items-center gap-espaco-3 text-tabela">
            {p.ataque !== undefined ? (
              <Dado tipo="ataque" valor={p.ataque} />
            ) : (
              <span className="batalha-vazio" />
            )}
            <span>×</span>
            {p.defesa !== undefined ? (
              <Dado tipo="defesa" valor={p.defesa} />
            ) : (
              <span className="batalha-vazio" />
            )}
            {p.ataque === undefined || p.defesa === undefined ? (
              <span className="dica">sem par, ignorado</span>
            ) : p.ataque > p.defesa ? (
              <span className="text-good">ataque vence: defensor perde 1</span>
            ) : (
              <span className="text-bad">
                {p.ataque === p.defesa ? "empate: " : ""}defesa vence: atacante perde 1
              </span>
            )}
          </div>
        ))}
      </div>
      <div>
        Resultado: atacante perde <b>{perdasAtaque}</b>, defensor perde <b>{perdasDefesa}</b>.
      </div>
    </>
  );
}
