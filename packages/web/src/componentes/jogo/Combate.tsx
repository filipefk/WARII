// Último combate da vez (ataque terrestre ou ciclos do ataque aéreo), visto por todos na mesa. Os
// dados "rolam" uma vez, curto, quando o lote chega; dá para pular, e com prefers-reduced-motion
// o resultado aparece direto. A animação nunca segura a visão nova: o mapa já está atualizado.
import { type Evento, territorio, type VisaoPartida } from "@warii/engine";
import { useEffect } from "react";
import type { Mesa } from "../../jogo/mesa";
import { useJogo } from "../../stores/jogo";
import type { JogoRecebido } from "../../stores/partidas";
import { Dado } from "../tabuleiro/Dado";
import { Bloco } from "./Paineis";

const DURACAO_MS = 900;

const nomeT = (t: Parameters<typeof territorio>[0]) => territorio(t).nome;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function reduzMovimento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type De<K extends Evento["tipo"]> = Extract<Evento, { tipo: K }>;

function Terrestre({
  ataque,
  conquista,
  rolando,
  mesa,
}: {
  ataque: De<"ataqueTerrestre">;
  conquista: De<"territorioConquistado"> | undefined;
  rolando: boolean;
  mesa: Mesa;
}) {
  const pares = Math.max(ataque.dadosAtaque.length, ataque.dadosDefesa.length);
  return (
    <div>
      <p>
        <b>{mesa.nome(ataque.jogador)}</b> atacou {nomeT(ataque.alvo)} ({mesa.nome(ataque.defensor)}
        ) a partir de {nomeT(ataque.origem)}.
      </p>
      <ul className="mt-espaco-3 space-y-espaco-2">
        {Array.from({ length: pares }, (_, k) => {
          const a = ataque.dadosAtaque[k];
          const d = ataque.dadosDefesa[k];
          const comparado = a !== undefined && d !== undefined;
          return (
            <li key={k} className="flex items-center gap-espaco-3">
              <span className="inline-block w-[38px]">
                {a !== undefined && (
                  <Dado
                    tipo="ataque"
                    valor={a}
                    rolando={rolando}
                    className={comparado ? "" : "opacity-[var(--opacidade-esmaecido)]"}
                  />
                )}
              </span>
              <span className="dica">×</span>
              <span className="inline-block w-[38px]">
                {d !== undefined && (
                  <Dado
                    tipo="defesa"
                    valor={d}
                    rolando={rolando}
                    className={comparado ? "" : "opacity-[var(--opacidade-esmaecido)]"}
                  />
                )}
              </span>
              {!rolando && (
                <span className="dica">
                  {comparado ? (a > d ? "defesa perde 1" : "ataque perde 1") : "sem par"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!rolando && (
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

function Aereo({
  eventos,
  rolando,
  mesa,
  parametros,
}: {
  eventos: readonly Evento[];
  rolando: boolean;
  mesa: Mesa;
  parametros: VisaoPartida["parametros"];
}) {
  const inicio = eventos.find(
    (e): e is De<"ataqueAereoIniciado"> => e.tipo === "ataqueAereoIniciado",
  );
  const ciclos = eventos.filter((e): e is De<"cicloAereo"> => e.tipo === "cicloAereo");
  const fim = eventos.find(
    (e): e is De<"ataqueAereoEncerrado"> => e.tipo === "ataqueAereoEncerrado",
  );
  const primeiro = ciclos[0];
  if (!primeiro) return null;
  return (
    <div>
      <p>
        <b>{mesa.nome(primeiro.jogador)}</b> bombardeia {nomeT(primeiro.alvo)} (
        {mesa.nome(primeiro.defensor)}).
        {inicio &&
          ` ${plural(inicio.daBase + inicio.daCaixa, "bombardeiro", "bombardeiros")}: ${inicio.daBase} da base, ${inicio.daCaixa} da caixa.`}
      </p>
      <ul className="mt-espaco-3 space-y-espaco-2">
        {ciclos.map((c, k) => (
          <li key={k} className="flex items-center gap-espaco-3">
            <Dado
              tipo="antiaereo"
              valor={c.dadoAntiaereo}
              rolando={rolando}
              faces={parametros.facesAntiaereo}
            />
            <span className="inline-block w-[38px]">
              {c.dadoAtaque !== null && (
                <Dado
                  tipo="aereo"
                  valor={c.dadoAtaque}
                  rolando={rolando}
                  faces={parametros.facesAtaqueAereo}
                />
              )}
            </span>
            {!rolando && (
              <span className="dica">
                Antiaérea abateu {plural(c.bombardeirosAbatidos, "bombardeiro", "bombardeiros")}
                {c.dadoAtaque === null
                  ? "; nenhum sobrou para atacar."
                  : `; ataque abateu ${plural(c.exercitosAbatidos, "exército", "exércitos")}.`}
              </span>
            )}
          </li>
        ))}
      </ul>
      {!rolando && fim && (
        <p className="mt-espaco-3">
          Ataque aéreo encerrado:{" "}
          {plural(fim.sobreviventes, "sobrevivente volta", "sobreviventes voltam")} para a{" "}
          {fim.destino === "base" ? "base aérea" : "caixa"}.
        </p>
      )}
    </div>
  );
}

export function PainelCombate({
  jogo,
  visao,
  mesa,
}: {
  jogo: JogoRecebido;
  visao: VisaoPartida;
  mesa: Mesa;
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

  if (!combate) return null;
  // Só o combate da vez em curso: o da vez anterior sai do painel (fica no log).
  const atacante = combate.eventos.find(
    (e) => e.tipo === "ataqueTerrestre" || e.tipo === "cicloAereo",
  );
  if (!atacante || !("jogador" in atacante)) return null;
  if (visao.fase === "FIM" || visao.jogadores[visao.vez]?.id !== atacante.jogador) return null;

  const terrestre = combate.eventos.find(
    (e): e is De<"ataqueTerrestre"> => e.tipo === "ataqueTerrestre",
  );
  const conquista = combate.eventos.find(
    (e): e is De<"territorioConquistado"> => e.tipo === "territorioConquistado",
  );
  return (
    <Bloco titulo="Combate">
      <div key={combate.seq} aria-live="polite">
        {terrestre ? (
          <Terrestre ataque={terrestre} conquista={conquista} rolando={rolando} mesa={mesa} />
        ) : (
          <Aereo
            eventos={combate.eventos}
            rolando={rolando}
            mesa={mesa}
            parametros={visao.parametros}
          />
        )}
        {rolando && (
          <button
            type="button"
            className="link dica mt-espaco-2"
            onClick={() => marcarAnimado(combate.seq)}
          >
            Pular animação
          </button>
        )}
      </div>
    </Bloco>
  );
}
