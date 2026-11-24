// TEMPORÁRIO (etapa 9.3): vitrine dos componentes do tabuleiro com uma partida local do engine,
// só em desenvolvimento. Remover quando a tela do jogo (9.5) existir.
import {
  CARTAS_DE_TROCA,
  criarPartida,
  IDS_TERRITORIOS,
  OBJETIVOS,
  PARAMETROS_PADRAO,
  rngComSemente,
  type TerritorioId,
} from "@warii/engine";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "../componentes/Modal";
import { CartaObjetivo } from "../componentes/tabuleiro/CartaObjetivo";
import { CartaTroca } from "../componentes/tabuleiro/CartaTroca";
import { Dado } from "../componentes/tabuleiro/Dado";
import { DefsDoJogo } from "../componentes/tabuleiro/DefsDoJogo";
import { Tabuleiro } from "../componentes/tabuleiro/Tabuleiro";
import { carregarGeografia, type Geografia } from "../mapa/geografia";

export function VitrineDev() {
  const [geo, setGeo] = useState<Geografia | null>(null);
  const [sel, setSel] = useState<TerritorioId | null>(null);
  const [modal, setModal] = useState(false);
  useEffect(() => {
    void carregarGeografia().then(setGeo);
  }, []);
  const estado = useMemo(() => {
    const r = criarPartida(
      [
        { id: "a", cor: "amarelo" },
        { id: "b", cor: "vermelho" },
        { id: "c", cor: "azul" },
      ],
      PARAMETROS_PADRAO,
      rngComSemente(3),
    );
    if (!r.ok) throw new Error(r.erro.mensagem);
    return r.estado;
  }, []);
  if (!geo) return <p>Carregando geografia…</p>;
  const cor = (id: string | null) => estado.jogadores.find((j) => j.id === id)?.cor ?? null;
  return (
    <div className="space-y-espaco-7">
      <DefsDoJogo geografia={geo} />
      <div className="aspect-[1640/900] w-full">
        <Tabuleiro
          geografia={geo}
          territorio={(t) => ({
            dono: cor(estado.territorios[t].dono),
            exercitos: estado.territorios[t].exercitos,
          })}
          bases={[
            { dono: "amarelo", bombardeiros: 4 },
            { dono: "vermelho", bombardeiros: 10 },
            { dono: "azul", bombardeiros: 0 },
          ]}
          selecionado={sel}
          opcoes={sel ? new Set(IDS_TERRITORIOS.filter((t) => t.startsWith("a"))) : null}
          onClicar={setSel}
        />
      </div>
      <p>Selecionado: {sel ?? "—"}</p>
      <div className="flex flex-wrap gap-espaco-3">
        {(["ataque", "defesa", "aereo", "antiaereo"] as const).map((t) =>
          [0, 1, 2, 3, 6].map((v) => <Dado key={`${t}${v}`} tipo={t} valor={v} rolando />),
        )}
      </div>
      <button type="button" className="botao" onClick={() => setModal(true)}>
        Abrir modal
      </button>
      {modal && (
        <Modal titulo="Cartas" onFechar={() => setModal(false)}>
          <div className="flex flex-wrap gap-espaco-5">
            {CARTAS_DE_TROCA.filter((c, i, a) => a.findIndex((x) => x.nome === c.nome) === i).map(
              (c) => (
                <CartaTroca key={c.id} carta={c} geografia={geo} largura={110} onClick={() => {}} />
              ),
            )}
          </div>
          <div className="mt-espaco-7 grid grid-cols-[repeat(auto-fill,170px)] gap-espaco-7">
            {OBJETIVOS.map((o) => (
              <CartaObjetivo key={o.id} id={o.id} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
