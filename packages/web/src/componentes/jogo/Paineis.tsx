// Blocos do painel lateral da partida (vez, recebimento, cartas, objetivo e log) e a mesa, que
// fica sobre o tabuleiro. Tudo sai
// da visão do jogador: o que é oculto (cartas e objetivo alheios) nem chega ao cliente.
import {
  cartaDeTroca,
  CONTINENTES,
  type Evento,
  IDS_CONTINENTES,
  pendenteDeRecebimento,
  type VisaoPartida,
} from "@warii/engine";
import { type ReactNode, useState } from "react";
import { eu } from "../../jogo/previa";
import { type Mesa, totaisPorJogador } from "../../jogo/mesa";
import type { Geografia } from "../../mapa/geografia";
import { NOMES_FASES, textoDoEvento } from "../../ui/textosEventos";
import { Avatar } from "../Avatar";
import { CorJogador, Presenca } from "../basicos";
import { CartaAmpliavel } from "../tabuleiro/CartaAmpliavel";
import { CartaObjetivo } from "../tabuleiro/CartaObjetivo";
import { CartaTroca } from "../tabuleiro/CartaTroca";
import { LogDetalhado } from "./LogDetalhado";

// Bloco do painel: título `secao` com 20px acima e 8px abaixo.
export function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="secao mt-5 mb-espaco-3">{titulo}</h2>
      {children}
    </section>
  );
}

// Humano fora da sala da partida: porta com a seta saindo, do tamanho do círculo da cor (12px).
function IconeForaDaSala() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3 shrink-0 text-bad"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Saiu da sala"
    >
      <title>Saiu da sala</title>
      <path d="M5 1.5H2.2a.7.7 0 0 0-.7.7v7.6a.7.7 0 0 0 .7.7H5" />
      <path d="M8 3.5 10.5 6 8 8.5M10.5 6H4.5" />
    </svg>
  );
}

// Jogador robô na tabela Mesa: cabeça de robô com antena, no lugar da etiqueta "robô".
function IconeRobo() {
  return (
    <svg
      viewBox="0 0 14 14"
      className="h-3.5 w-3.5 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Robô"
    >
      <title>Robô</title>
      <path d="M7 1.6v2" />
      <circle cx="7" cy="1.4" r="0.6" fill="currentColor" stroke="none" />
      <rect x="2.5" y="3.6" width="9" height="7.4" rx="1.6" />
      <path d="M1.2 6.4v2.4M12.8 6.4v2.4" />
      <circle cx="5.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8.8" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M5.3 9.2h3.4" />
    </svg>
  );
}

export function PainelVez({
  visao,
  mesa,
  presenca,
}: {
  visao: VisaoPartida;
  mesa: Mesa;
  presenca: string[];
}) {
  if (visao.fase === "FIM") {
    return (
      <Bloco titulo="Fim de jogo">
        <p className="flex items-center gap-espaco-2">
          <CorJogador cor={mesa.cor(visao.vencedor)} />
          {visao.vencedor !== null && (
            <Avatar usuarioId={visao.vencedor} avatar={mesa.avatar(visao.vencedor)} />
          )}
          <b>{mesa.nome(visao.vencedor)}</b> venceu.
        </p>
      </Bloco>
    );
  }
  const daVez = mesa.jogadorDaVez;
  const preparacao = visao.fase === "PREP_OCUPACAO";
  return (
    <Bloco titulo="Vez">
      <p className="flex flex-wrap items-center gap-espaco-2">
        <CorJogador cor={daVez?.cor ?? null} />
        {daVez && <Avatar usuarioId={daVez.id} avatar={mesa.avatar(daVez.id)} />}
        <b>{daVez ? mesa.nome(daVez.id) : "—"}</b>
        {daVez?.id === visao.voce && <span className="tag">você</span>}
        {daVez && mesa.robo(daVez.id) && (
          <>
            <span className="tag">robô</span>
            <span className="dica ml-auto">jogando…</span>
          </>
        )}
        {daVez && !mesa.robo(daVez.id) && (
          <span className="ml-auto">
            <Presenca online={presenca.includes(daVez.id)} textos={["acompanhando", "fora"]} />
          </span>
        )}
      </p>
      <p className="dica mt-espaco-1">
        {preparacao
          ? NOMES_FASES[visao.fase]
          : `Rodada ${visao.rodada} · ${NOMES_FASES[visao.fase]}`}
        {visao.etapaPrimeiraRodada === 1 && " · primeira rodada: só recebimento"}
      </p>
    </Bloco>
  );
}

export function PainelRecebimento({ visao }: { visao: VisaoPartida }) {
  const r = visao.turno.recebimento;
  if (visao.fase !== "RECEBER" || !r) return null;
  const pendente = pendenteDeRecebimento(r);
  return (
    <Bloco titulo="Recebimento">
      <p>
        {pendente === 1 ? "Falta" : "Faltam"} <b>{pendente}</b>{" "}
        {pendente === 1 ? "exército" : "exércitos"} para colocar.
      </p>
      <ul className="dica mt-espaco-1 space-y-px">
        <li>{r.livres} em qualquer território seu</li>
        {IDS_CONTINENTES.flatMap((c) => {
          const n = r.porContinente[c];
          return n ? [<li key={c}>{`${n} só em ${CONTINENTES[c].nome}`}</li>] : [];
        })}
      </ul>
    </Bloco>
  );
}

export function PainelMesa({
  visao,
  mesa,
  presenca,
}: {
  visao: VisaoPartida;
  mesa: Mesa;
  presenca: string[];
}) {
  const totais = totaisPorJogador(visao);
  const daVez = mesa.jogadorDaVez?.id;
  // Sobreposta ao canto inferior esquerdo do tabuleiro (área vazia do Pacífico); os cliques nela
  // não chegam ao mapa.
  return (
    <section
      className="pointer-events-auto rounded-raio-lg border border-border bg-panel/90 p-espaco-4"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="secao mb-espaco-2">Mesa</h2>
      <table className="w-full border-collapse text-tabela">
        <thead>
          <tr className="text-left text-muted">
            <th className="border-b border-border px-1.5 py-1 font-medium">Jogador</th>
            <th
              className="border-b border-border px-1.5 py-1 text-right font-medium"
              title="Territórios"
            >
              Terr.
            </th>
            <th
              className="border-b border-border px-1.5 py-1 text-right font-medium"
              title="Exércitos"
            >
              Exérc.
            </th>
            <th
              className="border-b border-border px-1.5 py-1 text-right font-medium"
              title="Cartas na mão"
            >
              Cartas
            </th>
            <th
              className="border-b border-border px-1.5 py-1 text-right font-medium"
              title="Bombardeiros: na base · na caixa"
            >
              Bomb.
            </th>
          </tr>
        </thead>
        <tbody>
          {visao.jogadores.map((j) => {
            const t = totais.get(j.id);
            // Humano sem nenhuma conexão acompanhando a partida (fechou a tela ou caiu).
            const desconectado =
              !mesa.robo(j.id) && !j.eliminado && visao.fase !== "FIM" && !presenca.includes(j.id);
            return (
              <tr key={j.id} className={j.eliminado ? "opacity-[var(--opacidade-esmaecido)]" : ""}>
                <td className="border-b border-border px-1.5 py-1">
                  <span className="flex flex-wrap items-center gap-espaco-2">
                    <span className="flex items-center gap-espaco-1">
                      {desconectado && <IconeForaDaSala />}
                      <CorJogador cor={j.cor} tamanho="w-3 h-3" />
                    </span>
                    <span
                      title={
                        mesa.robo(j.id) ? "robô" : desconectado ? "Saiu da sala" : "acompanhando"
                      }
                      className={desconectado ? "text-muted" : ""}
                    >
                      {mesa.nome(j.id)}
                    </span>
                    {mesa.robo(j.id) && <IconeRobo />}
                    {j.id === daVez && visao.fase !== "FIM" && <span className="tag">na vez</span>}
                    {j.id === visao.vencedor && <span className="tag">vencedor</span>}
                    {j.eliminado && <span className="dica">eliminado</span>}
                  </span>
                </td>
                <td className="border-b border-border px-1.5 py-1 text-right tabular-nums">
                  {t?.territorios ?? 0}
                </td>
                <td className="border-b border-border px-1.5 py-1 text-right tabular-nums">
                  {t?.exercitos ?? 0}
                </td>
                <td className="border-b border-border px-1.5 py-1 text-right tabular-nums">
                  {j.quantidadeCartas}
                </td>
                <td className="border-b border-border px-1.5 py-1 text-right tabular-nums">
                  {j.bombardeirosBase} · {j.bombardeirosCaixa}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="dica mt-espaco-1">
        Monte: {visao.quantidadeMonte} · descarte: {visao.descarte.length}
      </p>
    </section>
  );
}

export function MinhasCartas({
  visao,
  geografia,
  marcadas,
  onAlternar,
}: {
  visao: VisaoPartida;
  geografia: Geografia;
  marcadas: readonly string[];
  // Sem função, as cartas só são mostradas.
  onAlternar?: (carta: string) => void;
}) {
  const cartas = eu(visao)?.cartas;
  if (!cartas) return null;
  return (
    <Bloco titulo={`Minhas cartas (${cartas.length}/${visao.parametros.limiteMao})`}>
      {cartas.length === 0 ? (
        <p className="dica">Nenhuma carta. Conquiste um território na vez para comprar.</p>
      ) : (
        <div className="flex flex-wrap gap-espaco-2">
          {cartas.map((id) => {
            const carta = cartaDeTroca(id);
            if (!carta) return null;
            const peca = (
              <CartaTroca
                key={id}
                carta={carta}
                geografia={geografia}
                largura={70}
                marcada={marcadas.includes(id)}
                {...(onAlternar && { onClick: () => onAlternar(id) })}
              />
            );
            // Só para ver (sem marcar): aproxima no hover e amplia no clique.
            if (onAlternar) return peca;
            const rotulo =
              carta.tipo === "numerica" ? `carta +${carta.valor}` : `carta ${carta.nome}`;
            return (
              <CartaAmpliavel key={id} rotulo={rotulo}>
                {peca}
              </CartaAmpliavel>
            );
          })}
        </div>
      )}
    </Bloco>
  );
}

export function MeuObjetivo({ visao }: { visao: VisaoPartida }) {
  const meu = eu(visao);
  if (!meu?.objetivoId) return null;
  const trocado = meu.objetivoOriginalId !== null && meu.objetivoOriginalId !== meu.objetivoId;
  return (
    <Bloco titulo="Meu objetivo">
      <div className="w-fit">
        <CartaAmpliavel rotulo="meu objetivo">
          <CartaObjetivo id={meu.objetivoId} largura={170} />
        </CartaAmpliavel>
      </div>
      {trocado && (
        <p className="dica mt-espaco-2">
          O objetivo sorteado foi trocado automaticamente por este (regra §10.2).
        </p>
      )}
    </Bloco>
  );
}

export function LogDaPartida({
  eventos,
  mesa,
  partidaId,
}: {
  eventos: readonly Evento[];
  mesa: Mesa;
  partidaId: string;
}) {
  const [detalhado, setDetalhado] = useState(false);
  return (
    <Bloco titulo="Log da partida">
      {eventos.length === 0 ? (
        <p className="dica">Os lances aparecem aqui conforme a partida anda.</p>
      ) : (
        <ol className="max-h-64 space-y-espaco-1 overflow-y-auto text-dica">
          {eventos
            .map((e, i) => ({ e, i }))
            .toReversed()
            .map(({ e, i }) => (
              <li key={i} className="border-b border-border pb-espaco-1">
                {textoDoEvento(e, mesa.nome)}
              </li>
            ))}
        </ol>
      )}
      <p className="mt-espaco-3">
        <button type="button" className="link" onClick={() => setDetalhado(true)}>
          Log detalhado
        </button>
      </p>
      {detalhado && <LogDetalhado partidaId={partidaId} onFechar={() => setDetalhado(false)} />}
    </Bloco>
  );
}
