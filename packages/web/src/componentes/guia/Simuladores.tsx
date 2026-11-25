// Ferramentas interativas do guia (componente Simulador do sistema): calculadora de reforços e
// simuladores de ataque terrestre e aéreo. O sorteio aqui é local e só ilustra as regras; nas
// partidas os dados são rolados pelo servidor. As faces aéreas e a tabela de bônus são as da partida.
import {
  CONTINENTES,
  type ContinenteId,
  FACES_D6,
  IDS_CONTINENTES,
  type VisaoPartida,
} from "@warii/engine";
import { type ReactNode, useState } from "react";
import { calcularReforcos, type Dominio, type PedidoDeCalculo } from "../../jogo/calculadora";
import { Botao } from "../basicos";
import { Dado } from "../tabuleiro/Dado";
import { Batalha, resolverBatalha } from "./pecasDoGuia";

const sortear = (faces: readonly number[]): number =>
  faces[Math.floor(Math.random() * faces.length)] ?? 0;
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

function Ferramenta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="simulador">
      <b>{titulo}</b>
      {children}
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  min,
  max,
  onMudar,
}: {
  rotulo: string;
  valor: string;
  min: number;
  max: number;
  onMudar: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-espaco-1">
      {rotulo}
      <input
        type="number"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
      />
    </label>
  );
}

const Erro = ({ children }: { children: ReactNode }) => (
  <div role="alert" className="mt-espaco-2 text-tabela text-bad">
    {children}
  </div>
);

// --- Calculadora de reforços -------------------------------------------------------------------

export function CalculadoraDeReforcos({ visao }: { visao: VisaoPartida }) {
  const [territorios, setTerritorios] = useState("19");
  const [centros, setCentros] = useState("3");
  const [continentes, setContinentes] = useState<Partial<Record<ContinenteId, Dominio>>>({});
  const pedido: PedidoDeCalculo = {
    territorios: Number(territorios),
    centros: Number(centros),
    continentes,
  };
  const resultado = calcularReforcos(visao, pedido);
  const minimo = visao.parametros.minimoRecebimento;
  return (
    <Ferramenta titulo="🧮 Calculadora de reforços">
      <div className="mt-espaco-3 flex flex-wrap items-center gap-espaco-2">
        <Numero
          rotulo="Territórios"
          valor={territorios}
          min={1}
          max={43}
          onMudar={setTerritorios}
        />
        <Numero rotulo="CEs" valor={centros} min={0} max={12} onMudar={setCentros} />
      </div>
      <div className="mt-espaco-3 flex flex-wrap items-center gap-espaco-2">
        {IDS_CONTINENTES.map((c) => (
          <label key={c} className="inline-flex items-center gap-espaco-1">
            {CONTINENTES[c].nome}
            <select
              value={continentes[c] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setContinentes((atual) => {
                  const novo = { ...atual };
                  if (v === "maioria" || v === "totalidade") novo[c] = v;
                  else delete novo[c];
                  return novo;
                });
              }}
            >
              <option value="">—</option>
              <option value="maioria">maioria</option>
              <option value="totalidade">totalidade</option>
            </select>
          </label>
        ))}
      </div>
      <div className="mt-espaco-4" aria-live="polite">
        {resultado.ok ? (
          <>
            <div>
              Territórios: {resultado.calculo.territorios} ÷ 2
              {Math.floor(resultado.calculo.territorios / 2) < minimo ? ` (mínimo ${minimo})` : ""}{" "}
              = <b>{resultado.calculo.livres}</b>
            </div>
            {resultado.calculo.centros.length > 0 && (
              <div>
                Centros estratégicos: <b>{resultado.calculo.centros.length}</b> (1 em cada CE)
              </div>
            )}
            {IDS_CONTINENTES.filter((c) => resultado.calculo.porContinente[c]).map((c) => (
              <div key={c}>
                {continentes[c] === "totalidade" ? "Totalidade" : "Maioria"} de{" "}
                {CONTINENTES[c].nome}: <b>{resultado.calculo.porContinente[c]}</b> (no continente)
              </div>
            ))}
            <div className="mt-espaco-2 text-[16px]">
              Total: <b>{plural(resultado.calculo.total, "exército")}</b>
              {resultado.calculo.bombardeiros > 0 && (
                <>
                  {" "}
                  e <b>{plural(resultado.calculo.bombardeiros, "bombardeiro")}</b> na base aérea
                </>
              )}
            </div>
          </>
        ) : (
          <Erro>{resultado.mensagem}</Erro>
        )}
      </div>
    </Ferramenta>
  );
}

// --- Simulador de ataque terrestre --------------------------------------------------------------

interface RodadaTerrestre {
  numero: number;
  ataque: number[];
  defesa: number[];
  origem: number;
  alvo: number;
  dadosAtaque: number;
}

export function SimuladorTerrestre() {
  const [origem, setOrigem] = useState("6");
  const [alvo, setAlvo] = useState("3");
  const [rodada, setRodada] = useState<RodadaTerrestre | null>(null);
  const [aviso, setAviso] = useState("Escolha as forças e role os dados.");
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (definir: (v: string) => void) => (v: string) => {
    definir(v);
    setRodada(null);
    setErro(null);
    setAviso("Forças alteradas. Role os dados.");
  };

  const rolar = () => {
    const a = rodada?.origem ?? Number(origem);
    const d = rodada?.alvo ?? Number(alvo);
    if (!Number.isInteger(a) || !Number.isInteger(d) || a < 2 || d < 1) {
      setErro("A origem precisa de pelo menos 2 exércitos e o alvo de pelo menos 1.");
      return;
    }
    const nA = Math.min(3, a - 1);
    const nD = Math.min(3, d);
    const ataque = Array.from({ length: nA }, () => sortear(FACES_D6));
    const defesa = Array.from({ length: nD }, () => sortear(FACES_D6));
    const r = resolverBatalha(ataque, defesa);
    setErro(null);
    setRodada({
      numero: (rodada?.numero ?? 0) + 1,
      ataque,
      defesa,
      origem: a - r.perdasAtaque,
      alvo: d - r.perdasDefesa,
      dadosAtaque: nA,
    });
  };

  const fim = rodada !== null && (rodada.alvo === 0 || rodada.origem < 2);
  return (
    <Ferramenta titulo="🎲 Simulador de ataque terrestre">
      <div className="mt-espaco-3 flex flex-wrap items-center gap-espaco-2">
        <Numero
          rotulo="Exércitos na origem"
          valor={origem}
          min={2}
          max={60}
          onMudar={mudar(setOrigem)}
        />
        <Numero rotulo="Exércitos no alvo" valor={alvo} min={1} max={60} onMudar={mudar(setAlvo)} />
        <Botao onClick={rolar} disabled={fim}>
          Rolar dados
        </Botao>
        <Botao
          onClick={() => {
            setRodada(null);
            setErro(null);
            setAviso("Escolha as forças e role os dados.");
          }}
        >
          Recomeçar
        </Botao>
      </div>
      {erro && <Erro>{erro}</Erro>}
      <div className="mt-espaco-4" aria-live="polite">
        {rodada === null ? (
          <span className="dica">{aviso}</span>
        ) : (
          <>
            <div className="dica">
              Ataque {rodada.numero}: {plural(rodada.ataque.length, "dado")} ×{" "}
              {plural(rodada.defesa.length, "dado")}
            </div>
            <Batalha ataque={rodada.ataque} defesa={rodada.defesa} />
            <div className="mt-espaco-2">
              Origem: <b>{rodada.origem}</b> · Alvo: <b>{rodada.alvo}</b>
            </div>
            {rodada.alvo === 0 ? (
              <div className="mt-espaco-2 text-good">
                <b>Território conquistado!</b> Mova de 1 a {rodada.dadosAtaque} exércitos para ele.
              </div>
            ) : (
              rodada.origem < 2 && (
                <div className="mt-espaco-2 text-bad">
                  <b>A origem só tem 1 exército</b> e não pode mais atacar.
                </div>
              )
            )}
          </>
        )}
      </div>
    </Ferramenta>
  );
}

// --- Simulador de bombardeio --------------------------------------------------------------------

interface CicloAereo {
  antiaereo: number;
  abatidos: number;
  ataque: number | null;
  destruidos: number;
}

interface Bombardeio {
  bombardeiros: number;
  alvo: number;
  ciclos: CicloAereo[];
}

export function SimuladorAereo({ visao }: { visao: VisaoPartida }) {
  const { facesAntiaereo, facesAtaqueAereo, bombardeirosPorJogador } = visao.parametros;
  const voltam = visao.parametros.sobreviventesAereoVoltamParaBase ? "à base" : "à caixa";
  const [bombardeiros, setBombardeiros] = useState("4");
  const [alvo, setAlvo] = useState("6");
  const [estado, setEstado] = useState<Bombardeio | null>(null);
  const [aviso, setAviso] = useState("Cada clique é um ciclo: antiaérea e depois ataque aéreo.");
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (definir: (v: string) => void) => (v: string) => {
    definir(v);
    setEstado(null);
    setErro(null);
    setAviso("Forças alteradas. Role um ciclo.");
  };

  const fim = estado !== null && (estado.bombardeiros === 0 || estado.alvo === 1);

  const rolar = () => {
    const b = estado?.bombardeiros ?? Number(bombardeiros);
    const d = estado?.alvo ?? Number(alvo);
    if (
      !Number.isInteger(b) ||
      !Number.isInteger(d) ||
      b < 1 ||
      b > bombardeirosPorJogador ||
      d < 2
    ) {
      setErro(
        `Use de 1 a ${bombardeirosPorJogador} bombardeiros contra um alvo com pelo menos 2 exércitos.`,
      );
      return;
    }
    if (fim) return;
    const antiaereo = sortear(facesAntiaereo);
    const abatidos = Math.min(antiaereo, b);
    const restantes = b - abatidos;
    let ataque: number | null = null;
    let destruidos = 0;
    if (restantes > 0) {
      ataque = sortear(facesAtaqueAereo);
      destruidos = Math.min(ataque, d - 1);
    }
    setErro(null);
    setEstado({
      bombardeiros: restantes,
      alvo: d - destruidos,
      ciclos: [...(estado?.ciclos ?? []), { antiaereo, abatidos, ataque, destruidos }],
    });
  };

  return (
    <Ferramenta titulo="✈ Simulador de bombardeio">
      <div className="mt-espaco-3 flex flex-wrap items-center gap-espaco-2">
        <Numero
          rotulo="Bombardeiros"
          valor={bombardeiros}
          min={1}
          max={bombardeirosPorJogador}
          onMudar={mudar(setBombardeiros)}
        />
        <Numero rotulo="Exércitos no alvo" valor={alvo} min={2} max={60} onMudar={mudar(setAlvo)} />
        <Botao onClick={rolar} disabled={fim}>
          Rolar um ciclo
        </Botao>
        <Botao
          onClick={() => {
            setEstado(null);
            setErro(null);
            setAviso("Cada clique é um ciclo: antiaérea e depois ataque aéreo.");
          }}
        >
          Recomeçar
        </Botao>
      </div>
      {erro && <Erro>{erro}</Erro>}
      <div className="mt-espaco-4" aria-live="polite">
        {estado === null ? (
          <span className="dica">{aviso}</span>
        ) : (
          <>
            {estado.ciclos.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-espaco-2">
                Ciclo {i + 1}: <Dado tipo="antiaereo" valor={c.antiaereo} /> antiaérea:{" "}
                {c.antiaereo ? (
                  <span className="text-bad">
                    {plural(c.abatidos, "bombardeiro abatido", "bombardeiros abatidos")}
                  </span>
                ) : (
                  "nada"
                )}
                {c.ataque !== null && (
                  <>
                    <Dado tipo="aereo" valor={c.ataque} /> ataque:{" "}
                    {c.ataque ? (
                      <>
                        <span className="text-good">
                          {plural(c.destruidos, "exército destruído", "exércitos destruídos")}
                        </span>
                        {c.destruidos < c.ataque && " (o alvo não cai abaixo de 1)"}
                      </>
                    ) : (
                      "nada"
                    )}
                  </>
                )}
              </div>
            ))}
            <div className="mt-espaco-2">
              Bombardeiros: <b>{estado.bombardeiros}</b> · Alvo: <b>{estado.alvo}</b>.{" "}
              {estado.bombardeiros === 0 ? (
                <span className="text-bad">Todos os bombardeiros caíram: fim do ataque.</span>
              ) : estado.alvo === 1 ? (
                <span className="text-good">
                  O alvo ficou com 1 exército: fim do ataque.{" "}
                  {plural(estado.bombardeiros, "bombardeiro volta", "bombardeiros voltam")} {voltam}
                  .
                </span>
              ) : visao.parametros.interromperAtaqueAereo ? (
                <span className="dica">
                  Role outro ciclo para continuar, ou pare aqui e os sobreviventes voltam {voltam}.
                </span>
              ) : (
                <span className="dica">
                  Nesta partida o ataque não pode ser interrompido: role o próximo ciclo.
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </Ferramenta>
  );
}
