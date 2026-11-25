// Galeria das cartas e dos dados do jogo (componentes Modal e Abas do sistema): as 61 cartas de
// troca, as 20 cartas-objetivo e as faces dos dados. Tudo sai do engine; as faces dos dados aéreos
// são as dos parâmetros da partida. Precisa do <DefsDoJogo> montado na tela.
import {
  CARTAS_DE_TROCA,
  type CartaDeTroca,
  FACES_D6,
  OBJETIVOS,
  type Parametros,
  QUANTIDADE_NUMERICAS,
  territorio as dadosDoTerritorio,
  territoriosDaCarta,
} from "@warii/engine";
import { Fragment, useState } from "react";
import type { Geografia } from "../../mapa/geografia";
import { Abas, Modal } from "../Modal";
import { CartaObjetivo } from "../tabuleiro/CartaObjetivo";
import { CartaTroca } from "../tabuleiro/CartaTroca";
import { Dado, rotuloDaFace, type TipoDado } from "../tabuleiro/Dado";

type GrupoDeCartas = "ce" | "territorios" | "continentes" | "numericas";

const GRUPOS: Record<GrupoDeCartas, { titulo: string; dica: string }> = {
  ce: {
    titulo: "Centros estratégicos",
    dica: "Usadas na preparação para distribuir os CEs; depois valem como cartas de território comuns. 📍 marca o CE.",
  },
  territorios: {
    titulo: "Territórios",
    dica: "Carta com mais de um território: ao usar, o jogador escolhe um só.",
  },
  continentes: {
    titulo: "Continentes",
    dica: "Vale um território qualquer do continente (⚠ a confirmar).",
  },
  numericas: {
    titulo: "Numéricas",
    dica: "Somam exércitos ou bombardeiros a uma carta de território; nunca são usadas sozinhas.",
  },
};
const IDS_GRUPOS: readonly GrupoDeCartas[] = ["ce", "territorios", "continentes", "numericas"];

function grupoDa(carta: CartaDeTroca): GrupoDeCartas {
  if (carta.tipo === "numerica") return "numericas";
  if (carta.tipo === "continente") return "continentes";
  return carta.centro ? "ce" : "territorios";
}

const quantidadeDoGrupo = (g: GrupoDeCartas) =>
  CARTAS_DE_TROCA.filter((c) => grupoDa(c) === g).length;

// As numéricas aparecem uma vez por valor, com a quantidade embaixo.
function cartasParaMostrar(g: GrupoDeCartas): CartaDeTroca[] {
  const cartas = CARTAS_DE_TROCA.filter((c) => grupoDa(c) === g);
  if (g !== "numericas") return cartas;
  const vistas = new Set<number>();
  return cartas.filter((c) => {
    if (c.tipo !== "numerica" || vistas.has(c.valor)) return false;
    vistas.add(c.valor);
    return true;
  });
}

function Legenda({ carta }: { carta: CartaDeTroca }) {
  if (carta.tipo === "numerica") {
    return <span className="qty">{QUANTIDADE_NUMERICAS[carta.valor]} cartas</span>;
  }
  const ids = territoriosDaCarta(carta);
  if (carta.tipo === "continente") {
    return (
      <>
        <b>{carta.nome}</b>
        <span className="dica block text-etiqueta">{ids.length} territórios</span>
      </>
    );
  }
  return (
    <>
      <b>{carta.nome}</b>
      <span className="dica block text-etiqueta">
        No mapa:{" "}
        {ids.map((t, i) => {
          const d = dadosDoTerritorio(t);
          return (
            <Fragment key={t}>
              {i > 0 && ", "}
              {d.centroEstrategico && "📍"}
              {d.nome}
              {d.regioes && <span className="opacity-70"> ({d.regioes})</span>}
            </Fragment>
          );
        })}
      </span>
    </>
  );
}

type FiltroDeCartas = GrupoDeCartas | "todas";

const FILTROS = [
  { id: "todas", rotulo: `Todas (${CARTAS_DE_TROCA.length})` },
  ...IDS_GRUPOS.map((g) => ({ id: g, rotulo: `${GRUPOS[g].titulo} (${quantidadeDoGrupo(g)})` })),
] as const satisfies readonly { id: FiltroDeCartas; rotulo: string }[];

function CartasDeTroca({ geografia, filtro }: { geografia: Geografia; filtro: FiltroDeCartas }) {
  const grupos = filtro === "todas" ? IDS_GRUPOS : [filtro];
  return (
    <>
      {grupos.map((g) => (
        <section key={g}>
          <h3 className="secao mt-5 mb-espaco-1">
            {GRUPOS[g].titulo} · {quantidadeDoGrupo(g)} cartas
          </h3>
          <p className="dica mb-espaco-3">{GRUPOS[g].dica}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-x-espaco-6 gap-y-[18px]">
            {cartasParaMostrar(g).map((c) => (
              <div
                key={c.id}
                className="galeria-carta flex flex-col items-center gap-espaco-2 text-center"
              >
                <CartaTroca carta={c} geografia={geografia} largura={118} />
                <div className="text-dica leading-[1.3]">
                  <Legenda carta={c} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Objetivos() {
  return (
    <section>
      <h3 className="secao mt-5 mb-espaco-1">Cartas-objetivo</h3>
      <p className="dica mb-espaco-3">
        Cada jogador recebe uma carta secreta no início. "Maioria" segue a tabela de bônus por
        continente.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-espaco-7">
        {OBJETIVOS.map((o) => (
          <CartaObjetivo key={o.id} id={o.id} />
        ))}
      </div>
    </section>
  );
}

export interface DescricaoDado {
  tipo: TipoDado;
  titulo: string;
  quantidade: number;
  faces: readonly number[];
  dica: string;
}

export function descricaoDosDados(parametros: Parametros): DescricaoDado[] {
  return [
    {
      tipo: "ataque",
      titulo: "Ataque terrestre",
      quantidade: 3,
      faces: FACES_D6,
      dica: "3 dados vermelhos, d6 comum. O atacante rola um por exército participante (máx. 3).",
    },
    {
      tipo: "defesa",
      titulo: "Defesa terrestre",
      quantidade: 3,
      faces: FACES_D6,
      dica: "3 dados amarelos, d6 comum. O defensor rola um por exército no território (máx. 3).",
    },
    {
      tipo: "aereo",
      titulo: "Ataque aéreo",
      quantidade: 1,
      faces: parametros.facesAtaqueAereo,
      dica: "Rolado pelo atacante a cada ciclo, depois da antiaérea. Cada ficha de exército na face é 1 exército do defensor abatido (sempre fica ao menos 1 no território).",
    },
    {
      tipo: "antiaereo",
      titulo: "Defesa antiaérea",
      quantidade: 1,
      faces: parametros.facesAntiaereo,
      dica: "Rolado pelo defensor no início de cada ciclo. Cada peça de avião na face é 1 bombardeiro abatido. As faces são as configuradas nesta partida.",
    },
  ];
}

function Dados({ dados }: { dados: readonly DescricaoDado[] }) {
  return (
    <>
      {dados.map((d) => (
        <section key={d.tipo}>
          <h3 className="secao mt-5 mb-espaco-1">
            {d.titulo} · {d.quantidade} dado{d.quantidade > 1 ? "s" : ""}
          </h3>
          <p className="dica mb-espaco-3">{d.dica}</p>
          <div className="flex flex-wrap gap-espaco-6">
            {d.faces.map((v, i) => (
              <div
                key={i}
                className="galeria-dado flex w-[76px] flex-col items-center gap-espaco-1 text-center text-etiqueta text-muted"
              >
                <Dado tipo={d.tipo} valor={v} tamanho={68} />
                <span>{rotuloDaFace(d.tipo, v)}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

type AbaGaleria = "troca" | "objetivos" | "dados";

interface Props {
  geografia: Geografia;
  parametros: Parametros;
  onFechar: () => void;
}

export function Galeria({ geografia, parametros, onFechar }: Props) {
  const [aba, setAba] = useState<AbaGaleria>("troca");
  const [filtro, setFiltro] = useState<FiltroDeCartas>("todas");
  const dados = descricaoDosDados(parametros);
  return (
    <Modal
      titulo="Cartas e dados do jogo"
      onFechar={onFechar}
      cabecalho={
        <Abas
          abas={[
            { id: "troca", rotulo: `Cartas de troca (${CARTAS_DE_TROCA.length})` },
            { id: "objetivos", rotulo: `Objetivos (${OBJETIVOS.length})` },
            { id: "dados", rotulo: `Dados (${dados.reduce((n, d) => n + d.quantidade, 0)})` },
          ]}
          ativa={aba}
          onEscolher={setAba}
        />
      }
      filtros={
        aba === "troca" ? <Abas abas={FILTROS} ativa={filtro} onEscolher={setFiltro} /> : undefined
      }
    >
      {aba === "troca" && <CartasDeTroca geografia={geografia} filtro={filtro} />}
      {aba === "objetivos" && <Objetivos />}
      {aba === "dados" && <Dados dados={dados} />}
    </Modal>
  );
}
