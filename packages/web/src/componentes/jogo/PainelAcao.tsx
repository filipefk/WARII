// Bloco "Ação" do painel da partida: os controles da etapa atual (ver jogo/interacao.ts). Só o
// jogador da vez vê controles; os demais veem quem está jogando. Os cliques no mapa são tratados
// pela tela (TelaDoJogo); aqui ficam quantidades, cartas e os botões de envio. Os controles do
// combate (rolar ataque, defesa e antiaérea, mover após a conquista) ficam na janela de combate,
// que os importa daqui.
import {
  type Acao,
  cartaDeTroca,
  CONTINENTES,
  jogadorQueAge,
  type CartaId,
  territorio,
  type TerritorioId,
  type VisaoPartida,
} from "@warii/engine";
import { type ReactNode, useState } from "react";
import { type Etapa, temAvioes } from "../../jogo/interacao";
import type { Mesa } from "../../jogo/mesa";
import { eu } from "../../jogo/previa";
import type { Geografia } from "../../mapa/geografia";
import { useJogo } from "../../stores/jogo";
import { NOMES_FASES } from "../../ui/textosEventos";
import { Aviso, Botao } from "../basicos";
import { CartaTroca } from "../tabuleiro/CartaTroca";
import { Bloco } from "./Paineis";

const nomeT = (t: TerritorioId) => territorio(t).nome;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export interface Envio {
  ocupado: boolean;
  erro: string | null;
  enviar: (acao: Acao) => Promise<boolean>;
}

export interface Contexto {
  visao: VisaoPartida;
  mesa: Mesa;
  geografia: Geografia;
  ocupado: boolean;
  // Envia e, se aceita, chama `depois`.
  mandar: (acao: Acao, depois?: () => void) => void;
}

// ---- Peças ----

export function Linha({ children }: { children: ReactNode }) {
  return <div className="mt-espaco-3 flex flex-wrap items-center gap-espaco-2">{children}</div>;
}

export function Dica({ children }: { children: ReactNode }) {
  return <p className="dica mt-espaco-2">{children}</p>;
}

export function Quantidade({
  rotulo,
  valor,
  minimo = 1,
  maximo,
  onMudar,
}: {
  rotulo: string;
  valor: number;
  minimo?: number;
  maximo: number;
  onMudar: (n: number) => void;
}) {
  const fixar = (n: number) =>
    onMudar(Math.max(minimo, Math.min(maximo, Number.isFinite(n) ? Math.trunc(n) : minimo)));
  return (
    <div className="mt-espaco-3 flex flex-wrap items-center gap-espaco-2">
      <span>{rotulo}</span>
      <Botao aria-label="Menos" disabled={valor <= minimo} onClick={() => fixar(valor - 1)}>
        −
      </Botao>
      <input
        type="number"
        aria-label={rotulo}
        className="campo w-16 text-center tabular-nums"
        min={minimo}
        max={maximo}
        value={valor}
        onChange={(e) => fixar(Number(e.target.value))}
      />
      <Botao aria-label="Mais" disabled={valor >= maximo} onClick={() => fixar(valor + 1)}>
        +
      </Botao>
      <span className="dica">
        de {minimo} a {maximo}
      </span>
    </div>
  );
}

// Quantidade com estado local que começa no máximo (a chave de quem usa a reinicia).
export function useQuantidade(maximo: number): [number, (n: number) => void] {
  const [valor, setValor] = useState(maximo);
  return [Math.min(valor, maximo), setValor];
}

// Mão do jogador com as cartas marcáveis, para as etapas que usam cartas.
function SeletorDeCartas({ ctx }: { ctx: Contexto }) {
  const marcadas = useJogo((s) => s.cartas);
  const alternarCarta = useJogo((s) => s.alternarCarta);
  const cartas = eu(ctx.visao)?.cartas ?? [];
  if (cartas.length === 0) return <Dica>Você não tem cartas.</Dica>;
  return (
    <div className="mt-espaco-3 flex flex-wrap gap-espaco-2">
      {cartas.map((id) => {
        const carta = cartaDeTroca(id);
        if (!carta) return null;
        return (
          <CartaTroca
            key={id}
            carta={carta}
            geografia={ctx.geografia}
            largura={56}
            marcada={marcadas.includes(id)}
            onClick={() => alternarCarta(id)}
          />
        );
      })}
    </div>
  );
}

function BotoesDeCartas({ ctx }: { ctx: Contexto }) {
  const iniciar = useJogo((s) => s.iniciar);
  if ((eu(ctx.visao)?.cartas?.length ?? 0) === 0) return null;
  return (
    <div className="mt-espaco-5 border-t border-border pt-espaco-3">
      <p className="dica">Cartas</p>
      <Linha>
        <Botao onClick={() => iniciar("reforco")}>Reforçar com cartas</Botao>
        <Botao onClick={() => iniciar("transporte")}>Transportar com cartas</Botao>
        <Botao onClick={() => iniciar("descarte")}>Descartar cartas</Botao>
      </Linha>
    </div>
  );
}

function EncerrarAtaques({ ctx }: { ctx: Contexto }) {
  return (
    <Linha>
      <Botao disabled={ctx.ocupado} onClick={() => ctx.mandar({ tipo: "encerrarAtaques" })}>
        Encerrar ataques
      </Botao>
      <Botao disabled={ctx.ocupado} onClick={() => ctx.mandar({ tipo: "encerrarJogada" })}>
        Encerrar jogada
      </Botao>
    </Linha>
  );
}

function AbasDeAtaque({ ctx, aereo }: { ctx: Contexto; aereo: boolean }) {
  const iniciar = useJogo((s) => s.iniciar);
  const avioes = temAvioes(ctx.visao);
  return (
    <>
      <Linha>
        <Botao ativo={!aereo} onClick={() => iniciar("ataqueTerrestre")}>
          Ataque terrestre
        </Botao>
        <Botao ativo={aereo} disabled={!avioes} onClick={() => iniciar("ataqueAereo")}>
          Ataque aéreo
        </Botao>
      </Linha>
      {!avioes && <Dica>Sem bombardeiros disponíveis para um ataque aéreo.</Dica>}
    </>
  );
}

// ---- Etapas ----

function EscolhaCincoJogadores({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "escolha5j" }>;
}) {
  const iniciar = useJogo((s) => s.iniciar);
  return (
    <>
      <p>Escolha uma opção:</p>
      <p className="mt-espaco-2">
        <b>(a)</b> Pegue uma das cartas de CE que sobraram e ponha 2 exércitos no CE:
      </p>
      <div className="mt-espaco-2 flex flex-wrap gap-espaco-3">
        {etapa.centros.map((id) => {
          const carta = cartaDeTroca(id);
          if (carta?.tipo !== "territorio" || !carta.centro) return null;
          const ce = carta.centro;
          return (
            <div key={id} className="flex flex-col items-center gap-espaco-1">
              <CartaTroca
                carta={carta}
                geografia={ctx.geografia}
                largura={70}
                onClick={() => ctx.mandar({ tipo: "pegarCentroExtra", carta: id })}
              />
              <Botao
                disabled={ctx.ocupado}
                onClick={() => ctx.mandar({ tipo: "pegarCentroExtra", carta: id })}
              >
                Pegar {nomeT(ce)}
              </Botao>
            </div>
          );
        })}
      </div>
      <p className="mt-espaco-5">
        <b>(b)</b> Ocupe 2 territórios vagos, sem CE e de continentes diferentes, com 1 exército em
        cada.
      </p>
      <Linha>
        <Botao disabled={!etapa.doisVagosPossivel} onClick={() => iniciar("doisVagos")}>
          Ocupar dois vagos
        </Botao>
      </Linha>
      {!etapa.doisVagosPossivel && <Dica>A opção (b) não está disponível agora.</Dica>}
    </>
  );
}

function DoisVagos({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "doisVagos" }>;
}) {
  const cancelar = useJogo((s) => s.cancelar);
  const { primeiro, segundo } = etapa;
  return (
    <>
      {primeiro === null ? (
        <Dica>Clique no primeiro território vago (sem CE).</Dica>
      ) : segundo === null ? (
        <Dica>{nomeT(primeiro)} escolhido. Agora clique no segundo, de outro continente.</Dica>
      ) : (
        <p className="mt-espaco-2">
          {nomeT(primeiro)} e {nomeT(segundo)}.
        </p>
      )}
      <Linha>
        {primeiro !== null && segundo !== null && (
          <Botao
            disabled={ctx.ocupado}
            onClick={() =>
              ctx.mandar({ tipo: "ocuparDoisVagos", territorios: [primeiro, segundo] })
            }
          >
            Ocupar os dois
          </Botao>
        )}
        <Botao onClick={cancelar}>Voltar</Botao>
      </Linha>
    </>
  );
}

function Posicionar({
  ctx,
  territorio: t,
  maximo,
  pendente,
  encerrarAoTerminar,
}: {
  ctx: Contexto;
  territorio: TerritorioId;
  maximo: number;
  pendente: number;
  // Sem cartas para oferecer, colocar o último exército já encerra o recebimento.
  encerrarAoTerminar: boolean;
}) {
  const [quantidade, setQuantidade] = useQuantidade(maximo);
  const encerrar =
    encerrarAoTerminar && quantidade === pendente
      ? () => ctx.mandar({ tipo: "encerrarRecebimento" })
      : undefined;
  return (
    <>
      <p className="mt-espaco-3">
        Em <b>{nomeT(t)}</b>:
      </p>
      <Quantidade rotulo="Exércitos" valor={quantidade} maximo={maximo} onMudar={setQuantidade} />
      <Linha>
        <Botao
          disabled={ctx.ocupado}
          onClick={() => ctx.mandar({ tipo: "posicionar", territorio: t, quantidade }, encerrar)}
        >
          Colocar {quantidade} em {nomeT(t)}
          {encerrar &&
            (ctx.visao.etapaPrimeiraRodada === 1 ? " e passar a vez" : " e ir ao ataque")}
        </Botao>
      </Linha>
    </>
  );
}

function Receber({ ctx, etapa }: { ctx: Contexto; etapa: Extract<Etapa, { tipo: "receber" }> }) {
  const iniciar = useJogo((s) => s.iniciar);
  const primeiraEtapa = ctx.visao.rodada === 1 && ctx.visao.etapaPrimeiraRodada === 1;
  const encerrar = primeiraEtapa ? "Encerrar recebimento e passar a vez" : "Encerrar recebimento";
  const quantos = plural(etapa.doPasso, "exército", "exércitos");
  const posicionar =
    etapa.territorio && etapa.maximo > 0 ? (
      <Posicionar
        key={`${etapa.passo}:${etapa.territorio}:${etapa.maximo}`}
        ctx={ctx}
        territorio={etapa.territorio}
        maximo={etapa.maximo}
        pendente={etapa.pendente}
        encerrarAoTerminar={!etapa.temCartas}
      />
    ) : null;
  const cartas = eu(ctx.visao)?.cartas?.length ?? 0;
  return (
    <>
      {etapa.passo === "continente" && etapa.continente !== null && (
        <>
          <p>
            Coloque <b>{quantos}</b> na <b>{CONTINENTES[etapa.continente].nome}</b>, o bônus do
            continente.
          </p>
          {posicionar ?? (
            <Dica>
              Clique num território seu da {CONTINENTES[etapa.continente].nome} (os destacados).
            </Dica>
          )}
        </>
      )}
      {etapa.passo === "livres" && (
        <>
          <p>
            Coloque <b>{quantos}</b> em qualquer território seu.
          </p>
          {posicionar ?? <Dica>Clique num território seu (os destacados).</Dica>}
        </>
      )}
      {etapa.passo === "cartas" && (
        <>
          <p>Todos os exércitos foram colocados.</p>
          {etapa.temCartas ? (
            <>
              <p className="mt-espaco-3">
                Você tem {plural(cartas, "carta", "cartas")}. Quer usá-las agora?
              </p>
              <Linha>
                <Botao onClick={() => iniciar("reforco")}>Reforçar com cartas</Botao>
                <Botao onClick={() => iniciar("transporte")}>Transportar com cartas</Botao>
                <Botao onClick={() => iniciar("descarte")}>Descartar cartas</Botao>
              </Linha>
              <Linha>
                <Botao
                  disabled={ctx.ocupado}
                  onClick={() => ctx.mandar({ tipo: "encerrarRecebimento" })}
                >
                  {primeiraEtapa ? "Não usar e passar a vez" : "Não usar e encerrar recebimento"}
                </Botao>
              </Linha>
            </>
          ) : (
            <Linha>
              <Botao
                disabled={ctx.ocupado}
                onClick={() => ctx.mandar({ tipo: "encerrarRecebimento" })}
              >
                {encerrar}
              </Botao>
            </Linha>
          )}
        </>
      )}
      {etapa.passo !== "cartas" && etapa.pendente > etapa.doPasso && (
        <Dica>
          Ao todo {etapa.pendente === 1 ? "falta" : "faltam"}{" "}
          {plural(etapa.pendente, "exército", "exércitos")}.
        </Dica>
      )}
      {primeiraEtapa && <Dica>Na primeira volta da rodada 1 só se recebe exércitos.</Dica>}
    </>
  );
}

export function Conquista({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "conquista" }>;
}) {
  const { origem, alvo, maximo } = etapa.conquista;
  const [quantidade, setQuantidade] = useQuantidade(maximo);
  return (
    <div>
      <p>
        Você conquistou <b>{nomeT(alvo)}</b>. Quantos exércitos entram, vindos de {nomeT(origem)}?
      </p>
      <Dica>O primeiro já entrou; o total vai de 1 até os dados do último ataque.</Dica>
      <Quantidade rotulo="Total" valor={quantidade} maximo={maximo} onMudar={setQuantidade} />
      <Linha>
        <Botao
          disabled={ctx.ocupado}
          onClick={() => ctx.mandar({ tipo: "moverAposConquista", quantidade })}
        >
          Mover {plural(quantidade, "exército", "exércitos")}
        </Botao>
      </Linha>
    </div>
  );
}

export function AereoEmCurso({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "aereoEmCurso" }>;
}) {
  const { alvo, emCombate, ciclos, etapa: momento } = etapa.ataque;
  return (
    <div>
      <p>
        {plural(emCombate, "bombardeiro", "bombardeiros")} sobre <b>{nomeT(alvo)}</b>,{" "}
        {plural(ciclos, "ciclo concluído", "ciclos concluídos")}.
      </p>
      <Dica>O ataque aéreo nunca conquista: o alvo fica com pelo menos 1 exército.</Dica>
      {momento === "ataque" ? (
        <>
          <Dica>A antiaérea já foi rolada. Agora é a sua vez de rolar o dado de ataque.</Dica>
          <Linha>
            <Botao disabled={ctx.ocupado} onClick={() => ctx.mandar({ tipo: "rolarAtaqueAereo" })}>
              🎲 Rolar ataque aéreo
            </Botao>
          </Linha>
        </>
      ) : (
        <Linha>
          <Botao
            disabled={ctx.ocupado}
            onClick={() => ctx.mandar({ tipo: "continuarAtaqueAereo" })}
          >
            Continuar
          </Botao>
          <Botao disabled={ctx.ocupado} onClick={() => ctx.mandar({ tipo: "encerrarAtaqueAereo" })}>
            Encerrar
          </Botao>
        </Linha>
      )}
    </div>
  );
}

export function Defesa({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "defesa" }>;
}) {
  return (
    <div>
      <p>
        Defenda <b>{nomeT(etapa.ataque.alvo)}</b>: o ataque já rolou.
      </p>
      <Dica>Empate favorece a defesa.</Dica>
      <Linha>
        <Botao disabled={ctx.ocupado} onClick={() => ctx.mandar({ tipo: "rolarDefesa" })}>
          🎲 Rolar defesa ({plural(etapa.dados, "dado", "dados")})
        </Botao>
      </Linha>
    </div>
  );
}

export function Antiaereo({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "antiaereo" }>;
}) {
  const { alvo, emCombate } = etapa.ataque;
  return (
    <div>
      <p>
        Defenda <b>{nomeT(alvo)}</b> de {plural(emCombate, "bombardeiro", "bombardeiros")}.
      </p>
      <Dica>A antiaérea rola primeiro; o atacante só rola com os bombardeiros que sobrarem.</Dica>
      <Linha>
        <Botao disabled={ctx.ocupado} onClick={() => ctx.mandar({ tipo: "rolarAntiaereo" })}>
          🎲 Rolar antiaérea
        </Botao>
      </Linha>
    </div>
  );
}

// Orientação das etapas de origem e destino: o que já foi escolhido, o que falta e o último clique
// recusado. "Limpar seleção" desfaz a origem e o destino.
function OrigemEDestino({
  origem,
  destino,
}: {
  origem: TerritorioId | null;
  destino: TerritorioId | null;
}) {
  const invalido = useJogo((s) => s.invalido);
  const limparEscolha = useJogo((s) => s.limparEscolha);
  const linha = (papel: "origem" | "destino", escolhido: TerritorioId | null) => {
    const rotulo = papel === "origem" ? "Origem" : "Destino";
    if (escolhido !== null) return <b>{nomeT(escolhido)}</b>;
    if (invalido?.papel === papel) {
      return (
        <span className="text-bad">
          {rotulo} {nomeT(invalido.territorio)} {papel === "origem" ? "inválida" : "inválido"}
        </span>
      );
    }
    return <span className="text-muted">Aguardando seleção</span>;
  };
  return (
    <div className="secao mt-espaco-3">
      <p>Origem: {linha("origem", origem)}</p>
      {origem !== null && <p>Destino: {linha("destino", destino)}</p>}
      {(origem !== null || invalido !== null) && (
        <Linha>
          <Botao onClick={limparEscolha}>Limpar seleção</Botao>
        </Linha>
      )}
    </div>
  );
}

function MaoCheia({ ctx, etapa }: { ctx: Contexto; etapa: Extract<Etapa, { tipo: "maoCheia" }> }) {
  return (
    <>
      <Aviso tipo="info">
        Você está com {etapa.quantidade} cartas e o limite é {etapa.limite}. Use ou descarte cartas
        até ficar com no máximo {etapa.limite} para continuar a vez.
      </Aviso>
      <BotoesDeCartas ctx={ctx} />
    </>
  );
}

function Terrestre({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "terrestre" }>;
}) {
  const { origem, alvo, maximoDados } = etapa;
  return (
    <>
      <AbasDeAtaque ctx={ctx} aereo={false} />
      {etapa.origens.size > 0 && <OrigemEDestino origem={origem} destino={alvo} />}
      {origem === null ? (
        <Dica>
          {etapa.origens.size > 0
            ? "Clique no território de onde parte o ataque (precisa de 2 ou mais exércitos)."
            : "Nenhum território seu pode atacar por terra agora."}
        </Dica>
      ) : alvo === null ? (
        <Dica>
          De <b>{nomeT(origem)}</b>: clique no alvo vizinho. Clique de novo na origem para trocá-la.
        </Dica>
      ) : (
        <>
          <Linha>
            <Botao
              disabled={ctx.ocupado || maximoDados === 0}
              onClick={() => ctx.mandar({ tipo: "iniciarAtaqueTerrestre", origem, alvo })}
            >
              Iniciar ataque
            </Botao>
          </Linha>
          <Dica>O combate abre numa janela para toda a mesa; lá você escolhe os dados e rola.</Dica>
        </>
      )}
      <EncerrarAtaques ctx={ctx} />
      <BotoesDeCartas ctx={ctx} />
    </>
  );
}

function Aereo({ ctx, etapa }: { ctx: Contexto; etapa: Extract<Etapa, { tipo: "aereo" }> }) {
  const definirDaBase = useJogo((s) => s.definirDaBase);
  const meu = eu(ctx.visao);
  const total = etapa.daBase + etapa.daCaixa;
  const { alvo, cartas } = etapa;
  return (
    <>
      <AbasDeAtaque ctx={ctx} aereo />
      <p className="mt-espaco-3">
        Bombardeiros: {meu?.bombardeirosBase ?? 0} na base · {meu?.bombardeirosCaixa ?? 0} na caixa.
      </p>
      <Quantidade
        rotulo="Da base"
        valor={etapa.daBase}
        minimo={0}
        maximo={etapa.maximoBase}
        onMudar={definirDaBase}
      />
      <p className="dica mt-espaco-3">
        Opcional: marque a carta do alvo (e numéricas) para usar bombardeiros da caixa — vale 1 + as
        numéricas.
        {!ctx.visao.parametros.somarBaseECaixa &&
          " Nesta partida o ataque usa a base ou as cartas, não as duas."}
      </p>
      <SeletorDeCartas ctx={ctx} />
      {etapa.problemaCartas && <Dica>{etapa.problemaCartas}</Dica>}
      {cartas && (
        <Dica>Das cartas: {plural(etapa.daCaixa, "bombardeiro", "bombardeiros")} da caixa.</Dica>
      )}
      {total === 0 ? (
        <Dica>Escolha ao menos 1 bombardeiro.</Dica>
      ) : etapa.opcoes.size === 0 ? (
        <Dica>Nenhum alvo possível com essa combinação.</Dica>
      ) : alvo === null ? (
        <Dica>Clique no alvo: território de um adversário com 2 ou mais exércitos.</Dica>
      ) : (
        <>
          <p className="mt-espaco-3">
            Alvo: <b>{nomeT(alvo)}</b>, com {plural(total, "bombardeiro", "bombardeiros")}.
          </p>
          <Linha>
            <Botao
              disabled={ctx.ocupado}
              onClick={() =>
                ctx.mandar({
                  tipo: "iniciarAtaqueAereo",
                  alvo,
                  daBase: etapa.daBase,
                  ...(cartas && { cartas }),
                })
              }
            >
              Iniciar ataque
            </Botao>
          </Linha>
        </>
      )}
      <EncerrarAtaques ctx={ctx} />
      <BotoesDeCartas ctx={ctx} />
    </>
  );
}

function QuantoDeslocar({
  ctx,
  origem,
  destino,
  maximo,
  aereo,
}: {
  ctx: Contexto;
  origem: TerritorioId;
  destino: TerritorioId;
  maximo: number;
  aereo: boolean;
}) {
  const definirDestino = useJogo((s) => s.definirDestino);
  const [quantidade, setQuantidade] = useQuantidade(maximo);
  return (
    <>
      {aereo && (
        <p className="mt-espaco-3">
          <span className="tag">aerotransporte</span>
        </p>
      )}
      <Quantidade rotulo="Exércitos" valor={quantidade} maximo={maximo} onMudar={setQuantidade} />
      <Linha>
        <Botao
          disabled={ctx.ocupado}
          onClick={() =>
            ctx.mandar({ tipo: "deslocar", origem, destino, quantidade }, () =>
              definirDestino(null),
            )
          }
        >
          Deslocar {quantidade} para {nomeT(destino)}
        </Botao>
      </Linha>
    </>
  );
}

function Deslocar({ ctx, etapa }: { ctx: Contexto; etapa: Extract<Etapa, { tipo: "deslocar" }> }) {
  const { origem, destino } = etapa;
  return (
    <>
      {etapa.origens.size > 0 && <OrigemEDestino origem={origem} destino={destino} />}
      {origem === null ? (
        <Dica>
          {etapa.origens.size > 0
            ? "Clique no território de onde saem os exércitos."
            : "Nenhum exército pode ser deslocado agora."}
        </Dica>
      ) : destino === null ? (
        <Dica>
          De <b>{nomeT(origem)}</b>: clique no destino (vizinho seu ou, entre CEs, aerotransporte).
        </Dica>
      ) : (
        <QuantoDeslocar
          key={`${origem}:${destino}:${etapa.maximo}`}
          ctx={ctx}
          origem={origem}
          destino={destino}
          maximo={etapa.maximo}
          aereo={etapa.aereo}
        />
      )}
      <Dica>Cada exército só se move uma vez por vez; quem chegou nesta vez fica.</Dica>
      <Linha>
        <Botao disabled={ctx.ocupado} onClick={() => ctx.mandar({ tipo: "encerrarJogada" })}>
          Encerrar jogada
        </Botao>
      </Linha>
      <BotoesDeCartas ctx={ctx} />
    </>
  );
}

function Cancelar() {
  const cancelar = useJogo((s) => s.cancelar);
  return <Botao onClick={cancelar}>Cancelar</Botao>;
}

function Reforco({ ctx, etapa }: { ctx: Contexto; etapa: Extract<Etapa, { tipo: "reforco" }> }) {
  const cancelar = useJogo((s) => s.cancelar);
  const { carta, territorio: t } = etapa;
  return (
    <>
      <p>
        <b>Reforço com cartas:</b> +1 exército (mais as numéricas) num território seu da carta.
      </p>
      <SeletorDeCartas ctx={ctx} />
      {etapa.problema ? (
        <Dica>{etapa.problema}</Dica>
      ) : etapa.opcoes.size === 0 ? (
        <Dica>Nenhum território seu está nessa carta.</Dica>
      ) : t === null ? (
        <Dica>Clique no território que recebe +{etapa.valor}.</Dica>
      ) : null}
      <Linha>
        {carta && t && (
          <Botao
            disabled={ctx.ocupado}
            onClick={() =>
              ctx.mandar(
                { tipo: "reforcarComCartas", carta, territorio: t, numericas: etapa.numericas },
                cancelar,
              )
            }
          >
            Reforçar {nomeT(t)} com +{etapa.valor}
          </Botao>
        )}
        <Cancelar />
      </Linha>
    </>
  );
}

function QuantoTransportar({
  ctx,
  cartas,
  origem,
  destino,
  maximo,
}: {
  ctx: Contexto;
  cartas: [CartaId, CartaId];
  origem: TerritorioId;
  destino: TerritorioId;
  maximo: number;
}) {
  const cancelar = useJogo((s) => s.cancelar);
  const [quantidade, setQuantidade] = useQuantidade(maximo);
  return (
    <>
      <Quantidade rotulo="Exércitos" valor={quantidade} maximo={maximo} onMudar={setQuantidade} />
      <Linha>
        <Botao
          disabled={ctx.ocupado}
          onClick={() =>
            ctx.mandar(
              { tipo: "transportarComCartas", cartas, origem, destino, quantidade },
              cancelar,
            )
          }
        >
          Transportar {quantidade} para {nomeT(destino)}
        </Botao>
        <Cancelar />
      </Linha>
    </>
  );
}

function Transporte({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "transporte" }>;
}) {
  const { cartas, origem, destino } = etapa;
  const escolhido = cartas && origem && destino && etapa.maximo > 0;
  return (
    <>
      <p>
        <b>Transporte com cartas:</b> 2 cartas de territórios seus levam exércitos de um para o
        outro.
      </p>
      <SeletorDeCartas ctx={ctx} />
      {!etapa.problema && etapa.origens.size > 0 && (
        <OrigemEDestino origem={origem} destino={destino} />
      )}
      {etapa.problema ? (
        <Dica>{etapa.problema}</Dica>
      ) : etapa.origens.size === 0 ? (
        <Dica>Essas cartas não permitem transporte agora.</Dica>
      ) : origem === null ? (
        <Dica>Clique no território de onde saem os exércitos.</Dica>
      ) : destino === null ? (
        <Dica>De {nomeT(origem)}: clique no destino.</Dica>
      ) : null}
      {escolhido ? (
        <QuantoTransportar
          key={`${origem}:${destino}:${etapa.maximo}`}
          ctx={ctx}
          cartas={cartas}
          origem={origem}
          destino={destino}
          maximo={etapa.maximo}
        />
      ) : (
        <Linha>
          <Cancelar />
        </Linha>
      )}
    </>
  );
}

function Descarte({ ctx, etapa }: { ctx: Contexto; etapa: Extract<Etapa, { tipo: "descarte" }> }) {
  const cancelar = useJogo((s) => s.cancelar);
  const n = etapa.cartas.length;
  return (
    <>
      <p>
        <b>Descarte:</b> marque as cartas que vão para o descarte.
      </p>
      <SeletorDeCartas ctx={ctx} />
      <Linha>
        <Botao
          disabled={ctx.ocupado || n === 0}
          onClick={() => ctx.mandar({ tipo: "descartar", cartas: etapa.cartas }, cancelar)}
        >
          {n === 0 ? "Descartar" : `Descartar ${plural(n, "carta", "cartas")}`}
        </Botao>
        <Cancelar />
      </Linha>
    </>
  );
}

// Ataque terrestre aberto, na janela de combate: o atacante escolhe quantos dados rola, rola de
// novo ou encerra o ataque.
export function ConflitoTerrestre({
  ctx,
  etapa,
}: {
  ctx: Contexto;
  etapa: Extract<Etapa, { tipo: "conflito" }>;
}) {
  const { origem, alvo } = etapa.conflito;
  const maximo = etapa.maximoDados;
  const [escolha, setEscolha] = useState(3);
  const dados = Math.max(1, Math.min(escolha, maximo));
  const conquistado = ctx.visao.territorios[alvo].dono === ctx.visao.voce;
  const encerrar = () => ctx.mandar({ tipo: "encerrarAtaqueTerrestre" });
  if (maximo === 0) {
    return (
      <div>
        <p>
          {conquistado
            ? `${nomeT(alvo)} agora é seu.`
            : `${nomeT(origem)} não tem exércitos para atacar de novo.`}
        </p>
        <Linha>
          <Botao disabled={ctx.ocupado} onClick={encerrar}>
            Fechar o combate
          </Botao>
        </Linha>
      </div>
    );
  }
  return (
    <div>
      <p>Quantos dados de ataque?</p>
      <Linha>
        {[1, 2, 3].map((n) => (
          <Botao key={n} ativo={n === dados} disabled={n > maximo} onClick={() => setEscolha(n)}>
            {n}
          </Botao>
        ))}
      </Linha>
      <Dica>Cada dado é um exército que ataca; a origem fica sempre com pelo menos 1.</Dica>
      <Linha>
        <Botao
          disabled={ctx.ocupado}
          onClick={() => ctx.mandar({ tipo: "atacar", origem, alvo, dados })}
        >
          🎲 Rolar ataque ({plural(dados, "dado", "dados")})
        </Botao>
        <Botao disabled={ctx.ocupado} onClick={encerrar}>
          Encerrar ataque
        </Botao>
      </Linha>
    </div>
  );
}

function Corpo({ ctx, etapa }: { ctx: Contexto; etapa: Etapa }) {
  switch (etapa.tipo) {
    case "espera":
      return null;
    case "escolha5j":
      return <EscolhaCincoJogadores ctx={ctx} etapa={etapa} />;
    case "doisVagos":
      return <DoisVagos ctx={ctx} etapa={etapa} />;
    case "ocupar":
      return (
        <Dica>
          Clique num território vago (os destacados) para ocupá-lo com 1 exército. Restam{" "}
          {etapa.opcoes.size}.
        </Dica>
      );
    case "receber":
      return <Receber ctx={ctx} etapa={etapa} />;
    // Os controles do combate ficam na janela de combate.
    case "conquista":
    case "conflito":
    case "aereoEmCurso":
    case "defesa":
    case "antiaereo":
      return <Dica>O combate está na janela de combate, no meio da tela.</Dica>;
    case "maoCheia":
      return <MaoCheia ctx={ctx} etapa={etapa} />;
    case "terrestre":
      return <Terrestre ctx={ctx} etapa={etapa} />;
    case "aereo":
      return <Aereo ctx={ctx} etapa={etapa} />;
    case "deslocar":
      return <Deslocar ctx={ctx} etapa={etapa} />;
    case "reforco":
      return <Reforco ctx={ctx} etapa={etapa} />;
    case "transporte":
      return <Transporte ctx={ctx} etapa={etapa} />;
    case "descarte":
      return <Descarte ctx={ctx} etapa={etapa} />;
    default: {
      // Toda etapa tem controles: uma etapa nova quebra a compilação aqui.
      const nova: never = etapa;
      return nova;
    }
  }
}

interface Props {
  visao: VisaoPartida;
  mesa: Mesa;
  geografia: Geografia;
  etapa: Etapa;
  envio: Envio;
}

// Dados que alguém precisa rolar para o combate seguir, para o texto de espera.
function rolagemEsperada(visao: VisaoPartida): string | null {
  const { ataqueTerrestre, ataqueAereo } = visao.turno;
  if (ataqueTerrestre) return "a defesa";
  if (ataqueAereo?.etapa === "antiaereo") return "a antiaérea";
  if (ataqueAereo?.etapa === "ataque") return "o ataque aéreo";
  return null;
}

export function criarContexto(
  visao: VisaoPartida,
  mesa: Mesa,
  geografia: Geografia,
  { ocupado, enviar }: Envio,
): Contexto {
  return {
    visao,
    mesa,
    geografia,
    ocupado,
    mandar: (acao, depois) => {
      if (ocupado) return;
      void enviar(acao).then((ok) => {
        if (ok) depois?.();
      });
    },
  };
}

export function PainelAcao({ visao, mesa, geografia, etapa, envio }: Props) {
  const { erro } = envio;
  const ctx = criarContexto(visao, mesa, geografia, envio);
  const daVez = mesa.jogadorDaVez;
  const rolagem = rolagemEsperada(visao);
  return (
    <Bloco titulo="Ação">
      {etapa.tipo === "espera" ? (
        <p className="dica">
          {rolagem && visao.fase !== "FIM"
            ? `Aguardando ${mesa.nome(jogadorQueAge(visao))} rolar ${rolagem}.`
            : `Aguardando ${mesa.nome(daVez?.id ?? null)} (${NOMES_FASES[visao.fase].toLowerCase()}).`}
        </p>
      ) : etapa.tipo === "defesa" || etapa.tipo === "antiaereo" ? (
        <p className="mb-espaco-2">
          Sua vez de rolar <b>{rolagem}</b>.
        </p>
      ) : (
        <p className="mb-espaco-2">
          Sua vez: <b>{NOMES_FASES[visao.fase]}</b>.
        </p>
      )}
      <Corpo ctx={ctx} etapa={etapa} />
      {erro && (
        <div className="mt-espaco-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
    </Bloco>
  );
}
