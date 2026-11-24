// Gera public/fundos/mapa-mundi.svg, o mapa-múndi decorativo do fundo das telas, com a mesma
// projeção do tabuleiro (Miller centrada em 11°E, corte no Estreito de Bering, 1640×900).
// Rodar só quando mudar o desenho: `node scripts/gerar-mapa-fundo.mjs` dentro de packages/web.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { geoGraticule, geoPath, geoProjection } from "d3";
import { feature, mesh } from "topojson-client";

const URL_DADOS = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
const W = 1640;
const H = 900;

// Tokens do sistema de design (board-mid e board-rings).
const TERRA = "#4a1f10";
const TRACO = "#ffb38a";

const millerRaw = (l, p) => [l, 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * p))];
const projecao = geoProjection(millerRaw)
  .rotate([-11, 0])
  .precision(0.2)
  .fitExtent(
    [
      [40, 72],
      [1600, 838],
    ],
    {
      type: "MultiPoint",
      coordinates: [
        [-168, 83.6],
        [189, -56],
      ],
    },
  );
const caminho = geoPath(projecao);
const d = (geo) => {
  const texto = caminho(geo) ?? "";
  // Uma casa decimal basta para um fundo e reduz o arquivo.
  return texto.replace(/(\d+\.\d)\d+/g, "$1");
};

const resposta = await fetch(URL_DADOS);
if (!resposta.ok) throw new Error(`falha ao baixar o mapa: ${resposta.status}`);
const topo = await resposta.json();
const paises = topo.objects.countries;
const terra = feature(topo, topo.objects.land);
const fronteiras = mesh(topo, paises, (a, b) => a !== b);
const grade = geoGraticule().step([15, 15])();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<path d="${d(grade)}" fill="none" stroke="${TRACO}" stroke-opacity="0.1" stroke-width="0.8"/>
<path d="${d(terra)}" fill="${TERRA}" stroke="${TRACO}" stroke-opacity="0.5" stroke-width="1.2"/>
<path d="${d(fronteiras)}" fill="none" stroke="${TRACO}" stroke-opacity="0.25" stroke-width="0.7"/>
</svg>
`;

const destino = fileURLToPath(new URL("../public/fundos/mapa-mundi.svg", import.meta.url));
writeFileSync(destino, svg);
console.log(`gravado ${destino} (${Math.round(svg.length / 1024)} KB)`);
