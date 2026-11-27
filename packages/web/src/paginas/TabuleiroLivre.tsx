// Tabuleiro de ambientação (/tabuleiro), aberto pela tela de partidas: o mesmo mapa e o mesmo
// painel lateral da tela do jogo, sem partida, peças nem jogadores. Serve para conhecer o mapa,
// conferir fronteiras e ler as regras, as cartas e os dados (com os parâmetros padrão).
import { type TerritorioId, vizinhos } from "@warii/engine";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Aviso, BotaoIcone, Carregando } from "../componentes/basicos";
import { Galeria } from "../componentes/guia/Galeria";
import { GuiaDeRegras } from "../componentes/guia/GuiaDeRegras";
import { InfoTerritorio } from "../componentes/jogo/InfoTerritorio";
import { Bloco } from "../componentes/jogo/Paineis";
import { DefsDoJogo } from "../componentes/tabuleiro/DefsDoJogo";
import { Tabuleiro } from "../componentes/tabuleiro/Tabuleiro";
import { visaoDeExemplo } from "../jogo/visaoDeExemplo";
import { useGeografia } from "../mapa/useGeografia";

const SEM_BASES: readonly null[] = [null, null, null, null, null, null];
const VAGO = { dono: null, exercitos: 0 } as const;

export function TabuleiroLivre() {
  const { geografia, erro } = useGeografia();
  const visao = visaoDeExemplo();
  const [selecionado, setSelecionado] = useState<TerritorioId | null>(null);
  const [janela, setJanela] = useState<"galeria" | "guia" | null>(null);
  // As fronteiras do território escolhido ficam realçadas no mapa.
  const marcados = useMemo(
    () => (selecionado ? vizinhos(selecionado) : new Set<TerritorioId>()),
    [selecionado],
  );

  if (erro) return <Aviso>{erro}</Aviso>;
  if (!geografia) return <Carregando texto="Carregando o tabuleiro…" />;

  return (
    // Mesmo arranjo da tela do jogo: no desktop o mapa ocupa a altura da janela e o painel rola.
    <div className="flex flex-col overflow-hidden rounded-raio-tabuleiro border border-border bg-bg min-[861px]:h-[calc(100vh-84px)] min-[861px]:flex-row">
      <DefsDoJogo geografia={geografia} />
      <div className="h-[62vh] min-w-0 flex-1 min-[861px]:h-full">
        <Tabuleiro
          geografia={geografia}
          territorio={() => VAGO}
          bases={SEM_BASES}
          selecionado={selecionado}
          marcados={marcados}
          onClicar={setSelecionado}
        />
      </div>
      <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-panel p-espaco-7 min-[861px]:w-[340px] min-[861px]:border-t-0 min-[861px]:border-l">
        <h1 className="text-titulo">Tabuleiro</h1>
        <p className="dica">
          Use a roda do mouse para dar zoom e arraste para mover. Clique num território para ver as
          fronteiras dele.
        </p>

        <Bloco titulo="Território">
          <InfoTerritorio territorio={selecionado} visao={visao} />
        </Bloco>

        <div className="mt-5 flex flex-wrap gap-espaco-2">
          <BotaoIcone dica="Regras" onClick={() => setJanela("guia")}>
            📖
          </BotaoIcone>
          <BotaoIcone dica="Todas cartas e dados" onClick={() => setJanela("galeria")}>
            🎲
          </BotaoIcone>
        </div>

        <p className="dica mt-5">
          Regras com os valores padrão: cada partida pode mudar alguns deles na sala de espera.
        </p>
        <p className="mt-espaco-5">
          <Link to="/partidas" className="link">
            Voltar às partidas
          </Link>
        </p>
      </aside>
      {janela === "galeria" && (
        <Galeria
          geografia={geografia}
          parametros={visao.parametros}
          onFechar={() => setJanela(null)}
        />
      )}
      {janela === "guia" && (
        <GuiaDeRegras
          visao={visao}
          geografia={geografia}
          onFechar={() => setJanela(null)}
          onVerNoMapa={(t) => {
            setJanela(null);
            setSelecionado(t);
          }}
        />
      )}
    </div>
  );
}
