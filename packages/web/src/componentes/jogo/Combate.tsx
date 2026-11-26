// Dados do combate em curso (ataque terrestre ou ciclo do ataque aéreo), na janela de combate, vista
// por todos na mesa. Cada jogador rola os seus dados numa ação própria; os que acabaram de ser
// lançados "rolam" uma vez, curto, quando o lote chega; dá para pular, e com
// prefers-reduced-motion o resultado aparece direto. A animação nunca segura a visão nova: o mapa
// já está atualizado.
import { type Evento, territorio, type TerritorioId, type VisaoPartida } from "@warii/engine";
import { useEffect } from "react";
import type { Mesa } from "../../jogo/mesa";
import { useJogo } from "../../stores/jogo";
import type { JogoRecebido } from "../../stores/partidas";
import { Dado } from "../tabuleiro/Dado";

const DURACAO_MS = 900;

const nomeT = (t: Parameters<typeof territorio>[0]) => territorio(t).nome;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function reduzMovimento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type De<K extends Evento["tipo"]> = Extract<Evento, { tipo: K }>;

// Os dados de ataque chegam num lote (dadosDeAtaqueRolados) e os de defesa no seguinte
// (ataqueTerrestre, com o resultado): em cada lote só rolam os dados que acabaram de ser lançados.
function Terrestre({
  declarado,
  ataque,
  conquista,
  rolando,
}: {
  declarado: De<"dadosDeAtaqueRolados"> | undefined;
  ataque: De<"ataqueTerrestre"> | undefined;
  conquista: De<"territorioConquistado"> | undefined;
  rolando: boolean;
}) {
  const base = ataque ?? declarado;
  if (!base) return null;
  const dadosDefesa = ataque?.dadosDefesa ?? [];
  const pares = Math.max(base.dadosAtaque.length, dadosDefesa.length);
  const rolandoAtaque = rolando && !ataque;
  const rolandoDefesa = rolando && !!ataque;
  return (
    <div>
      <ul className="space-y-espaco-2">
        {Array.from({ length: pares }, (_, k) => {
          const a = base.dadosAtaque[k];
          const d = dadosDefesa[k];
          const comparado = a !== undefined && d !== undefined;
          return (
            <li key={k} className="flex items-center gap-espaco-3">
              <span className="inline-block w-[38px]">
                {a !== undefined && (
                  <Dado
                    tipo="ataque"
                    valor={a}
                    rolando={rolandoAtaque}
                    className={comparado || !ataque ? "" : "opacity-[var(--opacidade-esmaecido)]"}
                  />
                )}
              </span>
              <span className="dica">×</span>
              <span className="inline-block w-[38px]">
                {d !== undefined && (
                  <Dado
                    tipo="defesa"
                    valor={d}
                    rolando={rolandoDefesa}
                    className={comparado ? "" : "opacity-[var(--opacidade-esmaecido)]"}
                  />
                )}
              </span>
              {ataque && !rolando && (
                <span className="dica">
                  {comparado ? (a > d ? "defesa perde 1" : "ataque perde 1") : "sem par"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {ataque && !rolando && (
        <p className="mt-espaco-3">
          Ataque perdeu <b>{ataque.perdasAtaque}</b> · defesa perdeu <b>{ataque.perdasDefesa}</b>.
          {conquista && (
            <span className="text-good"> {nomeT(conquista.territorio)} foi conquistado.</span>
          )}
        </p>
      )}
    </div>
  );
}

// Cada ciclo tem dois lotes: a antiaérea do defensor (antiaereoRolado) e o ataque (cicloAereo,
// com o ciclo completo). Se a antiaérea derruba todos, o ciclo vem inteiro no primeiro lote.
function Aereo({
  eventos,
  rolando,
  parametros,
}: {
  eventos: readonly Evento[];
  rolando: boolean;
  parametros: VisaoPartida["parametros"];
}) {
  const ciclo = eventos.find((e): e is De<"cicloAereo"> => e.tipo === "cicloAereo");
  const antiaereo = eventos.find((e): e is De<"antiaereoRolado"> => e.tipo === "antiaereoRolado");
  const base = ciclo ?? antiaereo;
  if (!base) return null;
  const dadoAtaque = ciclo?.dadoAtaque ?? null;
  // A antiaérea rolou neste lote se ainda falta o ataque ou se ela encerrou o ciclo sozinha.
  const rolandoAntiaereo = rolando && dadoAtaque === null;
  return (
    <div>
      <div className="flex items-center gap-espaco-3">
        <Dado
          tipo="antiaereo"
          valor={base.dadoAntiaereo}
          rolando={rolandoAntiaereo}
          faces={parametros.facesAntiaereo}
        />
        <span className="inline-block w-[38px]">
          {dadoAtaque !== null && (
            <Dado
              tipo="aereo"
              valor={dadoAtaque}
              rolando={rolando}
              faces={parametros.facesAtaqueAereo}
            />
          )}
        </span>
        {!rolando && (
          <span className="dica">
            Antiaérea abateu {plural(base.bombardeirosAbatidos, "bombardeiro", "bombardeiros")}
            {!ciclo
              ? "."
              : ciclo.dadoAtaque === null
                ? "; nenhum sobrou para atacar."
                : `; ataque abateu ${plural(ciclo.exercitosAbatidos, "exército", "exércitos")}.`}
          </span>
        )}
      </div>
    </div>
  );
}

// Combate mostrado na janela: o par do ataque terrestre ou o alvo do ataque aéreo.
export type ParDoCombate =
  | { tipo: "terrestre"; origem: TerritorioId; alvo: TerritorioId }
  | { tipo: "aereo"; alvo: TerritorioId };

// Dados do último lote do combate, se o lote é deste combate (o início de um combate novo zera o
// lote). Depois de uma reconexão não há lote: os dados do ataque à espera da defesa vêm da visão.
export function DadosDoCombate({
  jogo,
  visao,
  mesa,
  par,
}: {
  jogo: JogoRecebido;
  visao: VisaoPartida;
  mesa: Mesa;
  par: ParDoCombate;
}) {
  const seqAnimado = useJogo((s) => s.seqAnimado);
  const marcarAnimado = useJogo((s) => s.marcarAnimado);
  const combate = jogo.combate;
  const pendente = combate !== null && combate.seq > seqAnimado;
  const rolando = pendente && !reduzMovimento();

  useEffect(() => {
    if (!combate || combate.seq <= seqAnimado) return () => {};
    if (reduzMovimento()) {
      marcarAnimado(combate.seq);
      return () => {};
    }
    const espera = window.setTimeout(() => marcarAnimado(combate.seq), DURACAO_MS);
    return () => window.clearTimeout(espera);
  }, [combate, seqAnimado, marcarAnimado]);

  const eventos = combate?.eventos ?? [];
  let conteudo = null;
  if (par.tipo === "terrestre") {
    const doPar = (e: { origem: TerritorioId; alvo: TerritorioId }) =>
      e.origem === par.origem && e.alvo === par.alvo;
    const terrestre = eventos.find(
      (e): e is De<"ataqueTerrestre"> => e.tipo === "ataqueTerrestre" && doPar(e),
    );
    const pendenteNaVisao = visao.turno.ataqueTerrestre;
    const declaradoNoLote = eventos.find(
      (e): e is De<"dadosDeAtaqueRolados"> => e.tipo === "dadosDeAtaqueRolados" && doPar(e),
    );
    const declarado =
      declaradoNoLote ??
      (pendenteNaVisao && doPar(pendenteNaVisao) && mesa.jogadorDaVez
        ? {
            tipo: "dadosDeAtaqueRolados" as const,
            jogador: mesa.jogadorDaVez.id,
            ...pendenteNaVisao,
          }
        : undefined);
    const conquista = eventos.find(
      (e): e is De<"territorioConquistado"> =>
        e.tipo === "territorioConquistado" && e.territorio === par.alvo,
    );
    if (terrestre || declarado) {
      conteudo = (
        <Terrestre
          declarado={declarado}
          ataque={terrestre}
          conquista={conquista}
          rolando={rolando && (terrestre !== undefined || declaradoNoLote !== undefined)}
        />
      );
    }
  } else {
    const doAlvo = eventos.filter(
      (e) => (e.tipo === "antiaereoRolado" || e.tipo === "cicloAereo") && e.alvo === par.alvo,
    );
    if (doAlvo.length > 0) {
      conteudo = <Aereo eventos={eventos} rolando={rolando} parametros={visao.parametros} />;
    }
  }
  if (!conteudo) return <p className="dica">Nenhum dado rolado ainda.</p>;
  return (
    <div key={combate?.seq ?? 0} aria-live="polite">
      {conteudo}
      {rolando && combate && (
        <button
          type="button"
          className="link dica mt-espaco-2"
          onClick={() => marcarAnimado(combate.seq)}
        >
          Pular animação
        </button>
      )}
    </div>
  );
}
