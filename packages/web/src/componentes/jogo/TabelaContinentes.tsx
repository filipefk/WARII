// Tabela dos continentes (componente TabelaContinentes do sistema): territórios de cada um, o que
// o jogador tem e os bônus em vigor na partida (parâmetros, nunca valores fixos no front).
import {
  CONTINENTES,
  IDS_CONTINENTES,
  type JogadorId,
  territoriosDoContinente,
  type VisaoPartida,
} from "@warii/engine";
import { corDoContinente } from "../../ui/tokens";

export function TabelaContinentes({
  visao,
  jogador,
}: {
  visao: VisaoPartida;
  // De quem contar os territórios (o próprio jogador); null para não mostrar a coluna.
  jogador: JogadorId | null;
}) {
  const bonus = visao.parametros.bonusContinentes;
  return (
    <table className="w-full border-collapse text-tabela">
      <thead>
        <tr className="text-left text-muted">
          <th className="border-b border-border px-1.5 py-1 font-medium">Continente</th>
          <th className="border-b border-border px-1.5 py-1 text-right font-medium">Terr.</th>
          {jogador && (
            <th className="border-b border-border px-1.5 py-1 text-right font-medium">Seus</th>
          )}
          <th className="border-b border-border px-1.5 py-1 text-right font-medium">Maioria</th>
          <th className="border-b border-border px-1.5 py-1 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {IDS_CONTINENTES.map((c) => {
          const territorios = territoriosDoContinente(c);
          const meus = territorios.filter((t) => visao.territorios[t].dono === jogador).length;
          return (
            <tr key={c}>
              <td className="border-b border-border px-1.5 py-1">
                <span
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-raio-circulo align-middle"
                  style={{ background: corDoContinente(c) }}
                />
                {CONTINENTES[c].nome}
              </td>
              <td className="border-b border-border px-1.5 py-1 text-right tabular-nums">
                {territorios.length}
              </td>
              {jogador && (
                <td className="border-b border-border px-1.5 py-1 text-right tabular-nums">
                  {meus}
                </td>
              )}
              <td className="border-b border-border px-1.5 py-1 text-right tabular-nums">
                {CONTINENTES[c].maioriaMinima}+ → {bonus[c].maioria}
              </td>
              <td className="border-b border-border px-1.5 py-1 text-right tabular-nums">
                {bonus[c].totalidade}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
