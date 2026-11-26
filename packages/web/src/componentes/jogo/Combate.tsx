// Último combate da vez (ataque terrestre ou ciclo do ataque aéreo), visto por todos na mesa. Cada
// jogador rola os seus dados numa ação própria; os que acabaram de ser lançados "rolam" uma vez,
// curto, quando o lote chega; dá para pular, e com prefers-reduced-motion o resultado aparece
// direto. A animação nunca segura a visão nova: o mapa já está atualizado.
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

// Os dados de ataque chegam num lote (dadosDeAtaqueRolados) e os de defesa no seguinte
// (ataqueTerrestre, com o resultado): em cada lote só rolam os dados que acabaram de ser lançados.
function Terrestre({
  declarado,
  ataque,
  conquista,
  rolando,
  mesa,
}: {
  declarado: De<"dadosDeAtaqueRolados"> | undefined;
  ataque: De<"ataqueTerrestre"> | undefined;
  conquista: De<"territorioConquistado"> | undefined;
  rolando: boolean;
  mesa: Mesa;
}) {
  const base = ataque ?? declarado;
  if (!base) return null;
  const dadosDefesa = ataque?.dadosDefesa ?? [];
  const pares = Math.max(base.dadosAtaque.length, dadosDefesa.length);
  const rolandoAtaque = rolando && !ataque;
  const rolandoDefesa = rolando && !!ataque;
  return (
    <div>
      <p>
        <b>{mesa.nome(base.jogador)}</b> atacou {nomeT(base.alvo)} ({mesa.nome(base.defensor)}) a
        partir de {nomeT(base.origem)}.
      </p>
      <ul className="mt-espaco-3 space-y-espaco-2">
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
      {!ataque && (
        <p className="dica mt-espaco-3">Aguardando {mesa.nome(base.defensor)} rolar a defesa.</p>
      )}
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
  mesa,
  parametros,
}: {
  eventos: readonly Evento[];
  rolando: boolean;
  mesa: Mesa;
  parametros: VisaoPartida["parametros"];
}) {
  const ciclo = eventos.find((e): e is De<"cicloAereo"> => e.tipo === "cicloAereo");
  const antiaereo = eventos.find((e): e is De<"antiaereoRolado"> => e.tipo === "antiaereoRolado");
  const fim = eventos.find(
    (e): e is De<"ataqueAereoEncerrado"> => e.tipo === "ataqueAereoEncerrado",
  );
  const base = ciclo ?? antiaereo;
  if (!base) return null;
  const dadoAtaque = ciclo?.dadoAtaque ?? null;
  // A antiaérea rolou neste lote se ainda falta o ataque ou se ela encerrou o ciclo sozinha.
  const rolandoAntiaereo = rolando && dadoAtaque === null;
  return (
    <div>
      <p>
        <b>{mesa.nome(base.jogador)}</b> bombardeia {nomeT(base.alvo)} ({mesa.nome(base.defensor)}
        ).
      </p>
      <div className="mt-espaco-3 flex items-center gap-espaco-3">
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
      {!ciclo && (
        <p className="dica mt-espaco-3">Aguardando {mesa.nome(base.jogador)} rolar o ataque.</p>
      )}
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
    (e) =>
      e.tipo === "dadosDeAtaqueRolados" ||
      e.tipo === "ataqueTerrestre" ||
      e.tipo === "antiaereoRolado" ||
      e.tipo === "cicloAereo",
  );
  if (!atacante || !("jogador" in atacante)) return null;
  if (visao.fase === "FIM" || visao.jogadores[visao.vez]?.id !== atacante.jogador) return null;

  const terrestre = combate.eventos.find(
    (e): e is De<"ataqueTerrestre"> => e.tipo === "ataqueTerrestre",
  );
  const declarado = combate.eventos.find(
    (e): e is De<"dadosDeAtaqueRolados"> => e.tipo === "dadosDeAtaqueRolados",
  );
  const conquista = combate.eventos.find(
    (e): e is De<"territorioConquistado"> => e.tipo === "territorioConquistado",
  );
  return (
    <Bloco titulo="Combate">
      <div key={combate.seq} aria-live="polite">
        {terrestre || declarado ? (
          <Terrestre
            declarado={declarado}
            ataque={terrestre}
            conquista={conquista}
            rolando={rolando}
            mesa={mesa}
          />
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
