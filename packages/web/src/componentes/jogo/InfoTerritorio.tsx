// Caixa do território selecionado (componente InfoTerritorio do sistema): nome, CE, países
// incluídos, continente, dono e vizinhos. Só informação pública da visão. Sem `mesa` (o tabuleiro
// de ambientação, sem partida), a linha do dono não aparece.
import {
  CONTINENTES,
  FRONTEIRAS,
  territorio as dadosDoTerritorio,
  type TerritorioId,
  type TipoFronteira,
  type VisaoPartida,
} from "@warii/engine";
import type { Mesa } from "../../jogo/mesa";
import { corDoContinente } from "../../ui/tokens";
import { CorJogador } from "../basicos";

const SUFIXO: Readonly<Record<TipoFronteira, string>> = {
  terrestre: "",
  maritima: " (marítima)",
  volta: " (volta do mapa)",
};

function vizinhosComTipo(t: TerritorioId): { id: TerritorioId; tipo: TipoFronteira }[] {
  return FRONTEIRAS.flatMap(([a, b, tipo]) => {
    if (a === t) return [{ id: b, tipo }];
    if (b === t) return [{ id: a, tipo }];
    return [];
  });
}

export function InfoTerritorio({
  territorio,
  visao,
  mesa,
}: {
  territorio: TerritorioId | null;
  visao: VisaoPartida;
  mesa?: Mesa;
}) {
  if (!territorio) {
    return (
      <div className="min-h-[60px] rounded-raio-md bg-panel-2 px-espaco-5 py-espaco-4">
        <p className="dica">Clique em um território.</p>
      </div>
    );
  }
  const dados = dadosDoTerritorio(territorio);
  const estado = visao.territorios[territorio];
  const continente = CONTINENTES[dados.continente];
  const vizinhos = vizinhosComTipo(territorio)
    .map((v) => ({ ...v, nome: dadosDoTerritorio(v.id).nome }))
    .toSorted((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return (
    <div className="min-h-[60px] space-y-espaco-1 rounded-raio-md bg-panel-2 px-espaco-5 py-espaco-4">
      <p>
        <b className="text-destaque">{dados.nome}</b>
        {dados.centroEstrategico && <span className="tag ml-espaco-2">Centro estratégico</span>}
      </p>
      {dados.regioes && <p className="dica">Inclui: {dados.regioes}</p>}
      <p className="flex items-center gap-espaco-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-raio-circulo"
          style={{ background: corDoContinente(dados.continente) }}
        />
        {continente.nome}
      </p>
      {mesa && (
        <p className="flex items-center gap-espaco-2">
          {estado.dono ? (
            <>
              <CorJogador cor={mesa.cor(estado.dono)} />
              {mesa.nome(estado.dono)} · {estado.exercitos}{" "}
              {estado.exercitos === 1 ? "exército" : "exércitos"}
            </>
          ) : (
            <span className="dica">Sem dono</span>
          )}
        </p>
      )}
      <p className="dica">Vizinhos: {vizinhos.map((v) => v.nome + SUFIXO[v.tipo]).join(", ")}</p>
    </div>
  );
}
