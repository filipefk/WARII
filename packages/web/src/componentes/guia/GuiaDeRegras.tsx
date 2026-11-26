// Guia de regras do jogo (versão didática de WARII.md, a mesma do guia do Tabuleiro.html): 12
// seções com índice lateral (NavegacaoGuia), exemplos do manual, calculadora e simuladores. Os
// números que são parâmetros da partida (mínimo de recebimento, bônus, faces aéreas, cartas por
// conquista…) vêm de `visao.parametros`. Precisa do <DefsDoJogo> montado na tela.
import {
  CENTROS_ESTRATEGICOS,
  cartaDeTroca,
  type CartaDeTroca,
  CONTINENTES,
  IDS_CONTINENTES,
  OBJETIVOS,
  type TerritorioId,
  territorio as dadosDoTerritorio,
  territoriosDoContinente,
  type VisaoPartida,
} from "@warii/engine";
import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { calcularReforcos } from "../../jogo/calculadora";
import type { Geografia } from "../../mapa/geografia";
import { corDoContinente } from "../../ui/tokens";
import { Modal } from "../Modal";
import { CartaObjetivo } from "../tabuleiro/CartaObjetivo";
import { CartaTroca } from "../tabuleiro/CartaTroca";
import { Dado } from "../tabuleiro/Dado";
import {
  Batalha,
  Cadeia,
  Caixa,
  Ficha,
  Fluxo,
  NavegacaoGuia,
  PecaBombardeiro,
  type SecaoDoGuia,
  textoDasFaces,
} from "./pecasDoGuia";
import { CalculadoraDeReforcos, SimuladorAereo, SimuladorTerrestre } from "./Simuladores";

interface Contexto {
  visao: VisaoPartida;
  geografia: Geografia;
  verNoMapa: (t: TerritorioId) => void;
}

function carta(id: string): CartaDeTroca {
  const c = cartaDeTroca(id);
  if (!c) throw new Error(`Carta ${id} inexistente`);
  return c;
}

const idDoObjetivo = (numero: number): string => OBJETIVOS[numero - 1]?.id ?? "";

function Carta({ id, ctx }: { id: string; ctx: Contexto }) {
  return <CartaTroca carta={carta(id)} geografia={ctx.geografia} largura={92} />;
}

function VerNoMapa({ t, ctx }: { t: TerritorioId; ctx: Contexto }) {
  return (
    <button type="button" className="link" onClick={() => ctx.verNoMapa(t)}>
      {dadosDoTerritorio(t).nome}
    </button>
  );
}

const Mais = () => <span className="operador">+</span>;
const Igual = () => <span className="operador">=</span>;

// --- Seções --------------------------------------------------------------------------------------

function Visao() {
  return (
    <>
      <p>
        War II é um jogo de estratégia para <b>3 a 6 jogadores</b>. Cada um comanda um exército de
        uma cor e recebe um <b>objetivo secreto</b>.{" "}
        <b>Vence quem cumprir o seu objetivo primeiro.</b>
      </p>
      <p>Em relação ao War clássico, o War II traz quatro novidades:</p>
      <Fluxo
        passos={[
          {
            simbolo: "📍",
            titulo: "Centros estratégicos",
            dica: "dão exércitos e aviões extras",
          },
          { simbolo: "✈", titulo: "Bombardeiros", dica: "atacam qualquer ponto do mapa" },
          { simbolo: "🛫", titulo: "Aerotransporte", dica: "tropas voam entre seus CEs" },
          {
            simbolo: "🃏",
            titulo: "Cartas de uso direto",
            dica: "reforço, bombardeio ou transporte",
          },
        ]}
      />
    </>
  );
}

function Pecas({ ctx }: { ctx: Contexto }) {
  return (
    <>
      <div className="ilustracao">
        {(["azul", "amarelo", "vermelho", "branco", "preto", "verde"] as const).map((c) => (
          <Ficha key={c} cor={c} />
        ))}
        <span>
          <b>Exércitos</b> em 6 cores. Ficha pequena = 1, grande = 10.
        </span>
      </div>
      <div className="ilustracao">
        <PecaBombardeiro cor="azul" />
        <PecaBombardeiro cor="vermelho" />
        <span>
          <b>Bombardeiros</b>: {ctx.visao.parametros.bombardeirosPorJogador} por jogador, ficam na{" "}
          <b>base aérea</b> da cor ou na caixa.
        </span>
      </div>
      <div className="ilustracao">
        <Dado tipo="ataque" valor={6} tamanho={40} />
        <Dado tipo="ataque" valor={4} tamanho={40} />
        <Dado tipo="ataque" valor={1} tamanho={40} />
        <span>
          3 dados <b>vermelhos</b> (ataque)
        </span>
        <Dado tipo="defesa" valor={5} tamanho={40} />
        <Dado tipo="defesa" valor={3} tamanho={40} />
        <Dado tipo="defesa" valor={2} tamanho={40} />
        <span>
          3 dados <b>amarelos</b> (defesa)
        </span>
      </div>
      <div className="ilustracao">
        <Dado tipo="aereo" valor={3} tamanho={40} />
        <span>
          Dado de <b>ataque aéreo</b>
        </span>
        <Dado tipo="antiaereo" valor={2} tamanho={40} />
        <span>
          Dado de <b>defesa antiaérea</b>
        </span>
      </div>
      <div className="ilustracao">
        <Carta id="brasil" ctx={ctx} />
        <Carta id="num3-01" ctx={ctx} />
        <CartaObjetivo id={idDoObjetivo(14)} />
        <span>
          <b>61 cartas de troca</b> e <b>20 cartas-objetivo</b>.
          <br />
          Veja todas no botão "Ver cartas e dados".
        </span>
      </div>
    </>
  );
}

function Mapa({ ctx }: { ctx: Contexto }) {
  const bonus = ctx.visao.parametros.bonusContinentes;
  // Quantos territórios de cada continente são do jogador (espectador não tem a coluna).
  const voce = ctx.visao.voce;
  return (
    <>
      <p>
        São <b>43 territórios</b> em <b>6 continentes</b>. Dois territórios são <b>vizinhos</b>{" "}
        quando se tocam ou quando uma <b>linha marítima</b> (as curvas brancas do mapa) os liga. O
        mapa dá a volta: <VerNoMapa t="alasca" ctx={ctx} /> e{" "}
        <VerNoMapa t="vladivostok" ctx={ctx} /> são vizinhos pela borda.
      </p>
      <p>
        <b>{CENTROS_ESTRATEGICOS.length} territórios são centros estratégicos (CE)</b>, marcados com
        📍:{" "}
        {CENTROS_ESTRATEGICOS.map((t, i) => (
          <Fragment key={t}>
            {i > 0 && ", "}
            <VerNoMapa t={t} ctx={ctx} />
          </Fragment>
        ))}
        .
      </p>
      <table>
        <thead>
          <tr>
            <th>Continente</th>
            <th className="n">Terr.</th>
            <th className="n">CE</th>
            {voce && <th className="n">Seus</th>}
            <th className="n">Maioria</th>
            <th className="n">Totalidade</th>
          </tr>
        </thead>
        <tbody>
          {IDS_CONTINENTES.map((c) => {
            const ts = territoriosDoContinente(c);
            return (
              <tr key={c}>
                <td>
                  <span
                    className="mr-1.5 inline-block h-2.5 w-2.5 rounded-raio-circulo align-middle"
                    style={{ background: corDoContinente(c) }}
                  />
                  {CONTINENTES[c].nome}
                </td>
                <td className="n">{ts.length}</td>
                <td className="n">
                  {ts.filter((t) => dadosDoTerritorio(t).centroEstrategico).length}
                </td>
                {voce && (
                  <td className="n">
                    {ts.filter((t) => ctx.visao.territorios[t].dono === voce).length}
                  </td>
                )}
                <td className="n">
                  {CONTINENTES[c].maioriaMinima} ou + → <b>{bonus[c].maioria}</b>
                </td>
                <td className="n">
                  todos → <b>{bonus[c].totalidade}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Caixa tipo="note" titulo="Dica">
        Clique em qualquer território do mapa para ver os vizinhos dele no painel.
      </Caixa>
    </>
  );
}

function Preparo({ ctx }: { ctx: Contexto }) {
  return (
    <>
      <ol>
        <li>
          <b>Cores:</b> cada jogador escolhe uma cor. Todos rolam um dado; o maior vira o{" "}
          <b>distribuidor</b>.
        </li>
        <li>
          <b>Centros estratégicos:</b> o distribuidor embaralha as <b>12 cartas de CE</b> e
          distribui uma a uma, começando por ele. Cada jogador põe <b>2 exércitos em cada CE</b>{" "}
          recebido.
          <div className="ilustracao">
            <Carta id="australia-novaguine" ctx={ctx} />
            <span>
              Carta com mais de um território: os 2 exércitos vão <b>só no CE</b> (📍 Austrália).
            </span>
          </div>
        </li>
        <li>
          <b>Demais territórios:</b> as cartas de CE voltam ao monte com as outras 49. Em seguida,
          na ordem, cada um põe <b>1 exército</b> num território vago, até não sobrar nenhum.
        </li>
        <li>
          <b>Objetivos:</b> tire as cartas de destruir cores que não estão em jogo e dê 1 objetivo
          secreto a cada jogador.
        </li>
        <li>
          <b>Quem começa:</b> o jogador à esquerda de quem ocupou o último território.
        </li>
      </ol>
      <Caixa tipo="ex" titulo="Com 5 jogadores">
        Distribuem-se só 10 cartas de CE (2 para cada). Depois, na ordem, cada um escolhe:{" "}
        <b>(a)</b> pegar uma das 2 cartas de CE restantes e pôr 2 exércitos nele; ou <b>(b)</b>{" "}
        ocupar 2 territórios vagos comuns, de continentes diferentes, com 1 exército cada. CEs que
        sobrarem são ocupados depois, como territórios comuns.
      </Caixa>
      <Caixa tipo="warn" titulo="Regra de ouro">
        Nenhum território pode ficar vazio, nunca. Todo território tem sempre pelo menos 1 exército.
      </Caixa>
    </>
  );
}

function Turno() {
  return (
    <>
      <p>Na sua vez, siga esta ordem:</p>
      <Fluxo
        setas
        passos={[
          { simbolo: "1", titulo: "Receber exércitos" },
          { simbolo: "2", titulo: "Receber bombardeiros" },
          { simbolo: "3", titulo: "Atacar", dica: "opcional" },
          { simbolo: "4", titulo: "Deslocar", dica: "opcional" },
          { simbolo: "5", titulo: "Comprar cartas", dica: "se conquistou" },
        ]}
      />
      <p>
        As cartas de troca podem ser usadas a <b>qualquer momento da sua jogada</b>.
      </p>
      <Caixa tipo="ex" titulo="Primeira rodada">
        Ela é dividida em duas voltas na mesa: primeiro <b>todos</b> recebem e colocam exércitos e
        bombardeiros; só depois, na segunda volta, cada um ataca, desloca e compra cartas. Assim
        ninguém ataca antes de os outros se reforçarem.
      </Caixa>
    </>
  );
}

function Receber({ ctx }: { ctx: Contexto }) {
  const p = ctx.visao.parametros;
  // Exemplo do manual, calculado pelo engine com os parâmetros da partida.
  const exemplo = calcularReforcos(ctx.visao, {
    territorios: 19,
    centros: 3,
    continentes: { AS: "totalidade", OC: "maioria" },
  });
  return (
    <>
      <p>No início da vez, some quatro parcelas:</p>
      <table>
        <thead>
          <tr>
            <th>Parcela</th>
            <th>Quanto</th>
            <th>Onde colocar</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Territórios</td>
            <td>
              metade dos seus territórios (arredondando para baixo),{" "}
              <b>mínimo {p.minimoRecebimento}</b>
            </td>
            <td>em qualquer território seu</td>
          </tr>
          <tr>
            <td>Centros estratégicos</td>
            <td>+1 por CE</td>
            <td>no próprio CE</td>
          </tr>
          <tr>
            <td>Continentes</td>
            <td>
              bônus de <b>maioria</b> ou de <b>totalidade</b> (vale só o maior)
            </td>
            <td>dentro daquele continente</td>
          </tr>
          <tr>
            <td>Bombardeiros</td>
            <td>+1 ✈ por CE (enquanto houver na caixa)</td>
            <td>na base aérea</td>
          </tr>
        </tbody>
      </table>
      {exemplo.ok && (
        <Caixa tipo="ex" titulo="Exemplo do manual">
          19 territórios, 3 deles CE, com a América do Sul inteira e 3 territórios da Oceania:
          <br />
          19 ÷ 2 = <b>{exemplo.calculo.livres}</b> + {exemplo.calculo.centros.length} (CE) +{" "}
          <b>{exemplo.calculo.porContinente.AS ?? 0}</b> (totalidade da América do Sul) +{" "}
          <b>{exemplo.calculo.porContinente.OC ?? 0}</b> (maioria da Oceania) ={" "}
          <b>{exemplo.calculo.total} exércitos</b> e mais{" "}
          <b>{exemplo.calculo.bombardeiros} bombardeiros</b>.
        </Caixa>
      )}
      <CalculadoraDeReforcos visao={ctx.visao} />
    </>
  );
}

function Terrestre() {
  return (
    <>
      <p>
        Ataque um território <b>vizinho</b> de outro jogador a partir de um território seu com{" "}
        <b>pelo menos 2 exércitos</b>. Um exército sempre fica para trás, como <b>ocupação</b>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Quem</th>
            <th>Dados</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Atacante (vermelhos)</td>
            <td>
              1 por exército que ataca, até 3, ou seja, <b>exércitos na origem − 1</b>, no máximo 3
            </td>
          </tr>
          <tr>
            <td>Defensor (amarelos)</td>
            <td>1 por exército no território, até 3. A ocupação também defende</td>
          </tr>
        </tbody>
      </table>
      <p>
        <b>Como resolver:</b> cada lado ordena os dados do maior para o menor e compara par a par.
        Quem tirar menos perde 1 exército. <b>Empate: vence a defesa.</b> Dados sem par não contam.
      </p>
      <Caixa tipo="ex" titulo="Exemplo 1: 4 exércitos atacam 3 (3 dados × 3 dados)">
        <Batalha ataque={[5, 4, 1]} defesa={[6, 3, 1]} />
        Ficam 2 × 2.
      </Caixa>
      <Caixa tipo="ex" titulo="Exemplo 2: 3 exércitos atacam 1 (2 dados × 1 dado)">
        <Batalha ataque={[3, 2]} defesa={[6]} />
      </Caixa>
      <h4>Conquista</h4>
      <p>
        Se o alvo fica sem exércitos, ele é seu. Mova para lá de <b>1 até o número de dados</b> do
        último ataque. Do território recém-conquistado você pode continuar atacando no mesmo turno.
      </p>
      <Caixa tipo="ex" titulo="Exemplo 3: 8 exércitos atacam 3 e conquistam">
        <Batalha ataque={[5, 3, 2]} defesa={[4, 2, 1]} />O alvo fica vazio: o atacante move de 1 a 3
        exércitos para ele.
      </Caixa>
      <SimuladorTerrestre />
    </>
  );
}

const DadoMini = ({ tipo, valor }: { tipo: "aereo" | "antiaereo"; valor: number }) => (
  <Dado tipo={tipo} valor={valor} tamanho={40} className="inline-block align-middle" />
);

function Aereo({ ctx }: { ctx: Contexto }) {
  const p = ctx.visao.parametros;
  const destino = p.sobreviventesAereoVoltamParaBase ? "base aérea" : "caixa";
  return (
    <>
      <p>
        Os bombardeiros atacam <b>qualquer território inimigo do mapa</b>, vizinho ou não, que tenha{" "}
        <b>pelo menos 2 exércitos</b>. O ataque aéreo <b>enfraquece, mas nunca conquista</b>: o alvo
        sempre fica com pelo menos 1 exército.
      </p>
      <p>
        Os bombardeiros podem vir da sua <b>base aérea</b> e também da <b>caixa</b>, usando cartas
        (veja a seção de cartas).{" "}
        {p.somarBaseECaixa ? (
          <>
            As duas origens podem ser somadas no mesmo ataque, até o limite de{" "}
            {p.bombardeirosPorJogador}.
          </>
        ) : (
          <>Nesta partida as duas origens não podem ser somadas no mesmo ataque.</>
        )}
      </p>
      <h4>Cada ciclo do bombardeio</h4>
      <Fluxo
        setas
        passos={[
          {
            simbolo: <DadoMini tipo="antiaereo" valor={1} />,
            titulo: (
              <>
                1. O defensor rola a <b>antiaérea</b>: cada avião na face derruba 1 bombardeiro
              </>
            ),
          },
          {
            simbolo: <DadoMini tipo="aereo" valor={2} />,
            titulo: (
              <>
                2. Se sobrou bombardeiro, o atacante rola o <b>ataque aéreo</b>: cada ficha destrói
                1 exército
              </>
            ),
          },
          p.interromperAtaqueAereo
            ? { simbolo: "↻", titulo: "3. Continuar ou parar?", dica: "o atacante decide" }
            : {
                simbolo: "↻",
                titulo: "3. Próximo ciclo",
                dica: "o ataque não pode ser interrompido",
              },
        ]}
      />
      <p className="dica">
        Antiaérea nesta partida: {textoDasFaces(p.facesAntiaereo)}. Ataque aéreo:{" "}
        {textoDasFaces(p.facesAtaqueAereo)}.
      </p>
      <p>
        O ataque <b>acaba obrigatoriamente</b> quando todos os bombardeiros caem ou quando o alvo
        fica com 1 exército. Bombardeiros abatidos e exércitos destruídos voltam para a caixa do
        dono. <b>Os sobreviventes voltam para a {destino}</b>
        {p.sobreviventesAereoVoltamParaBase && " e podem atacar de novo no mesmo turno"}.
      </p>
      <Caixa tipo="ex" titulo="Exemplo">
        O azul ataca a China (6 exércitos) com 4 bombardeiros.
        <br />
        <DadoMini tipo="antiaereo" valor={1} /> antiaérea com 1 avião: sobram 3 bombardeiros.{" "}
        <DadoMini tipo="aereo" valor={3} /> ataque com 3 fichas: a China cai para 3.
        <br />
        Ele decide continuar. <DadoMini tipo="antiaereo" valor={0} /> antiaérea lisa.{" "}
        <DadoMini tipo="aereo" valor={2} /> 2 fichas: a China cai para 1 e o ataque termina, porque
        um alvo com 1 exército não pode mais ser bombardeado. Os 3 bombardeiros voltam à {destino}.
        <br />
        Agora um ataque terrestre contra a China fica muito mais fácil.
      </Caixa>
      <SimuladorAereo visao={ctx.visao} />
    </>
  );
}

function Deslocar() {
  return (
    <>
      <p>
        Depois dos ataques, você pode reorganizar suas tropas, sempre deixando 1 exército em cada
        território:
      </p>
      <ul>
        <li>
          <b>Por terra:</b> entre territórios seus que sejam vizinhos.
        </li>
        <li>
          <b>Aerotransporte:</b> de um CE seu para <b>outro CE seu</b>, a qualquer distância.
        </li>
      </ul>
      <Caixa tipo="warn" titulo="Cada exército se move uma vez só por turno">
        <Cadeia
          elos={["Brasil", "Venezuela", "México"]}
          ligacoes={[
            { ok: true, texto: "ok" },
            { ok: false, texto: "os mesmos exércitos não seguem" },
          ]}
        />
        Também não vale combinar: voar de um CE para outro e depois andar por terra, ou o contrário.
      </Caixa>
    </>
  );
}

function Cartas({ ctx }: { ctx: Contexto }) {
  const p = ctx.visao.parametros;
  return (
    <>
      <h4>Comprando</h4>
      <p>
        No <b>fim do turno</b>, se você <b>conquistou pelo menos 1 território</b>, compre{" "}
        <b>{p.cartasPorConquista} cartas</b>, sem passar de <b>{p.limiteMao} na mão</b>. Sem
        conquista, não compra. As cartas são secretas até serem usadas.
      </p>
      <h4>Usando, a qualquer momento da sua jogada</h4>
      <p>
        Cada carta serve para uma coisa só. Uma carta numérica nunca é usada sozinha: ela sempre
        acompanha uma carta de território. Em carta com vários territórios, você escolhe um.
      </p>
      <Caixa tipo="ex" titulo="A) Reforço: o território é seu">
        <div className="ilustracao">
          <Carta id="california-vancouver" ctx={ctx} />
          <Mais />
          <Carta id="num3-01" ctx={ctx} />
          <Igual />
          <span className="resultado">
            1 + 3 = 4 exércitos
            <br />
            na Califórnia
          </span>
        </div>
      </Caixa>
      <Caixa tipo="ex" titulo="B) Bombardeio: o território é de um adversário">
        <div className="ilustracao">
          <Carta id="china" ctx={ctx} />
          <Mais />
          <Carta id="num2-01" ctx={ctx} />
          <Mais />
          <Carta id="num3-01" ctx={ctx} />
          <Igual />
          <span className="resultado">
            1 + 2 + 3 = 6 bombardeiros
            <br />
            da caixa contra a China
          </span>
        </div>
        Os sobreviventes vão para a sua{" "}
        {p.sobreviventesAereoVoltamParaBase ? "base aérea" : "caixa"}.
      </Caixa>
      <Caixa tipo="ex" titulo="C) Transporte: dois territórios seus">
        <div className="ilustracao">
          <Carta id="brasil" ctx={ctx} />
          <Mais />
          <Carta id="japao" ctx={ctx} />
          <Igual />
          <span className="resultado">
            leve quantos exércitos quiser
            <br />
            do Brasil para o Japão (ou o contrário)
          </span>
        </div>
      </Caixa>
      <p>
        As cartas usadas vão para o descarte. Quando ele chega a {p.tamanhoDescarteReembaralhar}{" "}
        cartas, é embaralhado de volta no monte.
      </p>
    </>
  );
}

function Objetivos({ ctx }: { ctx: Contexto }) {
  const p = ctx.visao.parametros;
  return (
    <>
      <p>
        Cada jogador tem um objetivo secreto. Quem cumprir o seu mostra a carta e{" "}
        <b>vence na hora</b>.
      </p>
      <div className="ilustracao">
        <CartaObjetivo id={idDoObjetivo(1)} />
        <CartaObjetivo id={idDoObjetivo(12)} />
        <CartaObjetivo id={idDoObjetivo(19)} />
      </div>
      {p.objetivoSubstitutoDestruir && (
        <Caixa tipo="note" titulo="Quando o objetivo muda sozinho">
          Se o seu objetivo é destruir uma cor e ela é <b>a sua</b>, ou se <b>outro jogador</b>{" "}
          eliminar essa cor antes de você, o seu objetivo passa a ser{" "}
          <b>conquistar 24 territórios</b>.
        </Caixa>
      )}
      <h4>Eliminação</h4>
      <p>
        Quem fica sem territórios sai do jogo. Quem o eliminou <b>herda as cartas de troca</b> dele
        (descartando o que passar de {p.limiteMao}).
      </p>
    </>
  );
}

function CentroDeInformacoes({ ctx }: { ctx: Contexto }) {
  return (
    <>
      <p>
        Regra opcional, para um jogo mais ágil
        {ctx.visao.parametros.centroInformacoes ? "" : " (desligada nesta partida)"}. Cada jogador
        põe seu <b>CI</b> num território seu na 1ª ou 2ª rodada. O CI não luta e não pode ser
        destruído.
      </p>
      <ul>
        <li>
          <b>Espionar:</b> com o seu CI no tabuleiro, na sua vez, olhe em segredo as cartas de troca
          de <b>um</b> adversário.
        </li>
        <li>
          <b>Capturar:</b> conquiste o território onde está o CI de outro jogador e veja as cartas e
          o <b>objetivo</b> dele.
        </li>
        <li>
          <b>Mover:</b> 1 território vizinho por turno, de CE para CE pelo ar, ou com 2 cartas de
          território para qualquer lugar.
        </li>
      </ul>
    </>
  );
}

const SECOES: readonly (SecaoDoGuia & { conteudo: (ctx: Contexto) => ReactNode })[] = [
  { id: "visao", titulo: "1. O jogo em resumo", conteudo: () => <Visao /> },
  { id: "pecas", titulo: "2. Componentes", conteudo: (ctx) => <Pecas ctx={ctx} /> },
  { id: "mapa", titulo: "3. O mapa", conteudo: (ctx) => <Mapa ctx={ctx} /> },
  { id: "preparo", titulo: "4. Preparação", conteudo: (ctx) => <Preparo ctx={ctx} /> },
  { id: "turno", titulo: "5. O turno", conteudo: () => <Turno /> },
  { id: "receber", titulo: "6. Recebendo reforços", conteudo: (ctx) => <Receber ctx={ctx} /> },
  { id: "terrestre", titulo: "7. Ataque terrestre", conteudo: () => <Terrestre /> },
  { id: "aereo", titulo: "8. Ataque aéreo", conteudo: (ctx) => <Aereo ctx={ctx} /> },
  { id: "deslocar", titulo: "9. Deslocamento", conteudo: () => <Deslocar /> },
  { id: "cartas", titulo: "10. Cartas de troca", conteudo: (ctx) => <Cartas ctx={ctx} /> },
  {
    id: "objetivos",
    titulo: "11. Objetivos e vitória",
    conteudo: (ctx) => <Objetivos ctx={ctx} />,
  },
  {
    id: "ci",
    titulo: "12. Variante: Centro de Informações",
    conteudo: (ctx) => <CentroDeInformacoes ctx={ctx} />,
  },
];

interface Props {
  visao: VisaoPartida;
  geografia: Geografia;
  onFechar: () => void;
  // Fecha o guia e seleciona o território no mapa.
  onVerNoMapa: (t: TerritorioId) => void;
}

export function GuiaDeRegras({ visao, geografia, onFechar, onVerNoMapa }: Props) {
  const corpo = useRef<HTMLDivElement>(null);
  const [ativa, setAtiva] = useState<string | null>(SECOES[0]?.id ?? null);

  // A seção ativa é a última cujo topo já passou do alto do corpo (com 40px de folga).
  const atualizarAtiva = useCallback(() => {
    const el = corpo.current;
    if (!el) return;
    let atual: string | null = null;
    for (const s of el.querySelectorAll<HTMLElement>("section[data-secao]")) {
      if (s.offsetTop <= el.scrollTop + 40) atual = s.dataset.secao ?? null;
    }
    setAtiva(atual);
  }, []);
  useEffect(atualizarAtiva, [atualizarAtiva]);

  const ir = (id: string) => {
    corpo.current?.querySelector(`[data-secao="${id}"]`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };
  const ctx: Contexto = { visao, geografia, verNoMapa: onVerNoMapa };

  return (
    <Modal titulo="📖 Como jogar War II" onFechar={onFechar} corpoLivre>
      <div className="flex min-h-0 flex-1 flex-col min-[761px]:flex-row">
        <NavegacaoGuia secoes={SECOES} ativa={ativa} onIr={ir} />
        <div
          ref={corpo}
          onScroll={atualizarAtiva}
          className="guia relative min-h-0 flex-1 overflow-y-auto px-espaco-6 pt-espaco-1 pb-10 min-[761px]:px-espaco-8"
        >
          {SECOES.map((s) => (
            <section key={s.id} id={`guia-${s.id}`} data-secao={s.id}>
              <h3>{s.titulo}</h3>
              {s.conteudo(ctx)}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
