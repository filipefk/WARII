// Definições SVG compartilhadas pelo tabuleiro e pelas cartas de troca, montadas uma vez por tela
// num <svg> invisível. Os caminhos grandes (países, territórios) existem só aqui; o mapa e as
// silhuetas das cartas os reutilizam com <use>, e os recortes são <clipPath> referenciados por id.
import { IDS_TERRITORIOS, type TerritorioId } from "@warii/engine";
import type { Geografia, ParteTerritorio } from "../../mapa/geografia";

const seguro = (s: string) => s.replace(/\W/g, "");

export const idParte = (t: TerritorioId, i: number) => `geo-${t}-${i}`;
export const idRecorteParte = (t: TerritorioId, i: number) => `geo-recorte-${t}-${i}`;
export const idPais = (pais: string) => `geo-pais-${seguro(pais)}`;
export const idContornoPais = (pais: string) => `geo-contorno-${seguro(pais)}`;
export const idRecorteFronteira = (i: number) => `geo-fronteira-${i}`;

export const ID_CARTA_VERMELHO = "carta-vermelho";
export const ID_CARTA_MIOLO = "carta-miolo";
export const ID_CARTA_AVIAO = "carta-aviao";
export const ID_CARTA_SOLDADO = "carta-soldado";
export const ID_SELO_BRILHO = "selo-brilho";

// Uma parte desenhada: caminho próprio ou país dividido recortado pela região.
export function UsoDaParte({
  territorio,
  indice,
  parte,
}: {
  territorio: TerritorioId;
  indice: number;
  parte: ParteTerritorio;
}) {
  if ("d" in parte) return <use href={`#${idParte(territorio, indice)}`} />;
  return (
    <use href={`#${idPais(parte.pais)}`} clipPath={`url(#${idRecorteParte(territorio, indice)})`} />
  );
}

export function DefsDoJogo({ geografia }: { geografia: Geografia }) {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute h-0 w-0 overflow-hidden">
      <defs>
        {Object.entries(geografia.paisesDivididos).map(([pais, d]) => (
          <g key={pais}>
            <path id={idPais(pais)} d={d} vectorEffect="non-scaling-stroke" />
            <clipPath id={idContornoPais(pais)}>
              <use href={`#${idPais(pais)}`} />
            </clipPath>
          </g>
        ))}
        {IDS_TERRITORIOS.map((t) =>
          geografia.territorios[t].partes.map((parte, i) =>
            "d" in parte ? (
              <path
                key={`${t}-${i}`}
                id={idParte(t, i)}
                d={parte.d}
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <clipPath key={`${t}-${i}`} id={idRecorteParte(t, i)}>
                <path d={parte.recorte} />
              </clipPath>
            ),
          ),
        )}
        {geografia.fronteiras.map((f, i) =>
          f.recorte ? (
            <clipPath key={i} id={idRecorteFronteira(i)}>
              <path d={f.recorte} />
            </clipPath>
          ) : null,
        )}

        {/* Volume do selo de exércitos (componente MarcadorTerritorio): luz no alto à esquerda e
            sombra na borda, sobrepostos à cor do dono. */}
        <radialGradient id={ID_SELO_BRILHO} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.6} />
          <stop offset=".45" stopColor="#ffffff" stopOpacity={0} />
          <stop offset=".7" stopColor="#000000" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.45} />
        </radialGradient>

        {/* Peças da carta de troca (componente CartaTroca). */}
        <radialGradient id={ID_CARTA_VERMELHO} cx="50%" cy="50%" r="65%">
          <stop offset="0" stopColor="var(--color-carta-vermelho)" />
          <stop offset=".7" stopColor="var(--color-carta-vermelho-medio)" />
          <stop offset="1" stopColor="var(--color-carta-vermelho-fundo)" />
        </radialGradient>
        <clipPath id={ID_CARTA_MIOLO}>
          <rect x="4" y="4" width="86" height="132" rx="4" />
        </clipPath>
        <path
          id={ID_CARTA_AVIAO}
          d="M12 1.5l1.6 7.2 8.4 4.3v2.2l-8.4-2.6-.5 5.6 3 2v1.6l-4.1-1-4.1 1v-1.6l3-2-.5-5.6L2 15.2V13l8.4-4.3z"
        />
        <path
          id={ID_CARTA_SOLDADO}
          d="M12 2.2c2.6 0 4.4 1.6 4.6 3.6H7.4C7.6 3.8 9.4 2.2 12 2.2zM9.2 6.6h5.6c-.2 1.8-1.3 3-2.8 3s-2.6-1.2-2.8-3zM7.6 10.6h8.8l1.4 6.2h-2.2l-.4 5.8h-2.4l-.8-4.6-.8 4.6H8.8l-.4-5.8H6.2zM18.6 4l1 .3-2.4 13.2-1-.2z"
        />
      </defs>
    </svg>
  );
}
