// Gera src/mapa/geografia.json, a geometria do tabuleiro já projetada (caminhos SVG prontos), para o
// front só desenhar `<path d>`, sem baixar o world-atlas nem usar o topojson em tempo de execução.
// Porta a montagem do mapa de Tabuleiro.html (init() e terrBox()) com a mesma projeção (Miller
// centrada em 11°E, 1640×900). Ids, nomes, continentes, CEs e fronteiras vêm do engine; daqui só
// sai a geografia. Rodar só quando mudar o desenho: `node scripts/gerar-geografia.mjs` em
// packages/web.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { geoContains, geoPath, geoProjection, polygonArea, polygonContains } from "d3";
import { feature, merge, mesh } from "topojson-client";

// O engine é consumido como código-fonte TS com imports "./x.js": o Node remove os tipos sozinho,
// mas não troca a extensão. Este gancho aponta "./x.js" para "./x.ts" quando o .ts existe.
registerHooks({
  resolve(especificador, contexto, proximo) {
    if (
      especificador.startsWith(".") &&
      especificador.endsWith(".js") &&
      contexto.parentURL?.endsWith(".ts")
    ) {
      const ts = new URL(especificador.replace(/\.js$/, ".ts"), contexto.parentURL);
      if (existsSync(fileURLToPath(ts))) return proximo(ts.href, contexto);
    }
    return proximo(especificador, contexto);
  },
});
const { FRONTEIRAS, IDS_CONTINENTES, TERRITORIOS } = await import("@warii/engine");

const URL_DADOS = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
const W = 1640;
const H = 900;
const AREA_DO_MAPA = [
  [40, 72],
  [1600, 838],
];
// Comprimento mínimo (px) de uma rota marítima.
const ROTA_MINIMA = 44;
// Ilhas pequenas (Andaman, Bahamas, Curilas, Creta...) ficam fora das pontas das rotas: só contam
// as massas de terra com pelo menos esta fração da área da maior do território.
const MASSA_MINIMA_ROTAS = 0.12;
// O mesmo para a caixa da silhueta das cartas, mais tolerante.
const MASSA_MINIMA_CAIXA = 0.015;

// ---------------------------------------------------------------------------------------------
// Tabela geográfica de Tabuleiro.html (TERRITORIES), só com o que é geografia.
// countries: países inteiros (nome Natural Earth; "A|B" = nomes alternativos).
// parts: pedaço de um país recortado por um polígono em lon/lat.
// rotulo: ponto (lon, lat) do nome. sub: países incluídos, em letra menor.

// Retângulo em lon/lat: lon de a até c, lat de b até d.
const caixaLonLat = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];

const GEOGRAFIA = [
  // América do Norte
  {
    id: "alasca",
    rotulo: [-152, 64],
    parts: [{ country: "United States of America", poly: caixaLonLat(-168, 50, -128, 72) }],
  },
  {
    id: "mackenzie",
    rotulo: [-118, 66],
    parts: [
      {
        country: "Canada",
        poly: [
          [-142, 60],
          [-95, 60],
          [-95, 63],
          [-50, 63],
          [-50, 85],
          [-142, 85],
        ],
      },
    ],
  },
  { id: "groenlandia", rotulo: [-41, 74], countries: ["Greenland"] },
  {
    id: "vancouver",
    rotulo: [-118, 54],
    parts: [{ country: "Canada", poly: caixaLonLat(-142, 40, -102, 60) }],
  },
  {
    id: "ottawa",
    rotulo: [-89, 51],
    parts: [
      {
        country: "Canada",
        poly: [
          [-102, 40],
          [-79, 40],
          [-79, 63],
          [-95, 63],
          [-95, 60],
          [-102, 60],
        ],
      },
    ],
  },
  {
    id: "labrador",
    rotulo: [-67, 53],
    parts: [{ country: "Canada", poly: caixaLonLat(-79, 40, -50, 63) }],
  },
  {
    id: "california",
    rotulo: [-114, 39],
    parts: [{ country: "United States of America", poly: caixaLonLat(-128, 24, -100, 50) }],
  },
  {
    id: "novayork",
    rotulo: [-86, 38],
    parts: [{ country: "United States of America", poly: caixaLonLat(-100, 24, -60, 50) }],
  },
  {
    id: "mexico",
    rotulo: [-102, 23],
    countries: [
      "Mexico",
      "Guatemala",
      "Belize",
      "Honduras",
      "El Salvador",
      "Nicaragua",
      "Costa Rica",
      "Panama",
    ],
  },
  {
    id: "cuba",
    rotulo: [-78, 20.5],
    countries: [
      "Cuba",
      "Jamaica",
      "Haiti",
      "Dominican Rep.|Dominican Republic",
      "Bahamas|The Bahamas",
      "Puerto Rico",
      "Trinidad and Tobago",
    ],
  },
  // América do Sul
  {
    id: "venezuela",
    sub: "Colômbia",
    rotulo: [-68, 5],
    countries: ["Venezuela", "Colombia", "Guyana", "Suriname"],
  },
  {
    id: "peru",
    sub: "Bolívia · Chile",
    rotulo: [-71, -13],
    countries: ["Peru", "Bolivia", "Chile", "Ecuador"],
  },
  { id: "brasil", rotulo: [-50, -9], countries: ["Brazil"] },
  {
    id: "argentina",
    sub: "Uruguai",
    rotulo: [-64, -35],
    countries: ["Argentina", "Uruguay", "Paraguay", "Falkland Is.|Falkland Islands"],
  },
  // Europa
  { id: "islandia", rotulo: [-19, 65], countries: ["Iceland"] },
  { id: "inglaterra", rotulo: [-3, 53], countries: ["United Kingdom", "Ireland"] },
  { id: "suecia", rotulo: [17, 63], countries: ["Sweden", "Norway", "Finland"] },
  {
    id: "moscou",
    rotulo: [38, 56],
    countries: ["Belarus", "Ukraine", "Estonia", "Latvia", "Lithuania"],
    parts: [{ country: "Russia", poly: caixaLonLat(19, 35, 50, 85) }],
  },
  {
    id: "alemanha",
    rotulo: [10, 51],
    countries: [
      "Germany",
      "Netherlands",
      "Belgium",
      "Luxembourg",
      "Denmark",
      "Switzerland",
      "Austria",
      "Czechia|Czech Rep.|Czech Republic",
      "Liechtenstein",
    ],
  },
  {
    id: "franca",
    sub: "Portugal · Espanha · Itália",
    rotulo: [-1, 43.5],
    countries: [
      "Spain",
      "Portugal",
      "Italy",
      "Andorra",
      "San Marino",
      "Vatican",
      "Monaco",
      "Malta",
    ],
    parts: [{ country: "France", poly: caixaLonLat(-6, 41, 10, 52) }],
  },
  {
    id: "polonia",
    sub: "Iugoslávia",
    rotulo: [21, 47.5],
    countries: [
      "Poland",
      "Slovakia",
      "Hungary",
      "Slovenia",
      "Croatia",
      "Bosnia and Herz.|Bosnia and Herzegovina",
      "Serbia",
      "Montenegro",
      "Kosovo",
      "Macedonia|North Macedonia",
      "Albania",
      "Greece",
      "Bulgaria",
      "Romania",
      "Moldova",
    ],
  },
  // África
  {
    id: "argelia",
    sub: "Nigéria",
    rotulo: [2, 22],
    countries: [
      "Morocco",
      "W. Sahara|Western Sahara",
      "Algeria",
      "Tunisia",
      "Mauritania",
      "Mali",
      "Niger",
      "Senegal",
      "Gambia",
      "Guinea",
      "Guinea-Bissau",
      "Sierra Leone",
      "Liberia",
      "Côte d'Ivoire|Ivory Coast",
      "Burkina Faso",
      "Ghana",
      "Togo",
      "Benin",
      "Nigeria",
    ],
  },
  { id: "egito", rotulo: [25, 26], countries: ["Egypt", "Libya"] },
  {
    id: "sudao",
    rotulo: [32, 11],
    countries: [
      "Sudan",
      "S. Sudan|South Sudan",
      "Chad",
      "Ethiopia",
      "Eritrea",
      "Djibouti",
      "Somalia",
      "Somaliland",
      "Kenya",
      "Uganda",
    ],
  },
  {
    id: "congo",
    rotulo: [21, -4],
    countries: [
      "Cameroon",
      "Central African Rep.|Central African Republic",
      "Congo|Republic of the Congo",
      "Dem. Rep. Congo|Democratic Republic of the Congo",
      "Gabon",
      "Eq. Guinea|Equatorial Guinea",
      "Angola",
      "Zambia",
      "Rwanda",
      "Burundi",
    ],
  },
  // Tanzânia na África do Sul: Congo sem litoral no Índico; África do Sul sobe a nordeste até o Sudão.
  {
    id: "africadosul",
    rotulo: [24, -26],
    countries: [
      "South Africa",
      "Namibia",
      "Botswana",
      "Zimbabwe",
      "Mozambique",
      "Malawi",
      "Lesotho",
      "eSwatini|Swaziland|Eswatini",
      "Tanzania",
    ],
  },
  { id: "madagascar", rotulo: [47, -19], countries: ["Madagascar"] },
  // Ásia
  {
    id: "orientemedio",
    rotulo: [46, 29],
    countries: [
      "Turkey|Türkiye",
      "Syria",
      "Iraq",
      "Iran",
      "Saudi Arabia",
      "Yemen",
      "Oman",
      "United Arab Emirates",
      "Qatar",
      "Kuwait",
      "Bahrain",
      "Jordan",
      "Israel",
      "Palestine",
      "Lebanon",
      "Cyprus",
      "N. Cyprus|Northern Cyprus",
      "Georgia",
      "Armenia",
      "Azerbaijan",
    ],
  },
  {
    id: "aral",
    rotulo: [66, 45],
    countries: [
      "Kazakhstan",
      "Uzbekistan",
      "Turkmenistan",
      "Kyrgyzstan",
      "Tajikistan",
      "Afghanistan",
    ],
  },
  // Rússia asiática: divisões aproximadas pelo tabuleiro. Omsk fica com a península de Yamal;
  // Dudinka vai do Golfo do Ob ao Rio Ienissei; Sibéria fica com a península de Taimir;
  // Vladivostok com todo o extremo leste.
  {
    id: "omsk",
    rotulo: [66, 58],
    parts: [
      {
        country: "Russia",
        poly: [
          [50, 35],
          [90, 35],
          [90, 50],
          [76, 63],
          [73, 66],
          [73, 85],
          [50, 85],
        ],
      },
    ],
  },
  {
    id: "dudinka",
    rotulo: [84, 63],
    parts: [
      {
        country: "Russia",
        poly: [
          [73, 85],
          [73, 66],
          [76, 63],
          [90, 50],
          [90, 35],
          [92, 35],
          [92, 48],
          [96, 56],
          [90, 64],
          [87, 68.5],
          [87, 85],
        ],
      },
    ],
  },
  {
    id: "siberia",
    rotulo: [106, 67],
    parts: [
      {
        country: "Russia",
        poly: [
          [87, 85],
          [87, 68.5],
          [90, 64],
          [105, 61],
          [116, 56],
          [124, 55],
          [131, 61],
          [126, 76],
          [126, 85],
        ],
      },
    ],
  },
  {
    id: "tchita",
    rotulo: [110, 55.5],
    parts: [
      {
        country: "Russia",
        poly: [
          [92, 35],
          [92, 48],
          [96, 56],
          [90, 64],
          [105, 61],
          [116, 56],
          [124, 55],
          [126, 52],
          [126, 35],
        ],
      },
    ],
  },
  {
    id: "vladivostok",
    rotulo: [150, 64],
    parts: [
      {
        country: "Russia",
        poly: [
          [126, 35],
          [126, 52],
          [124, 55],
          [131, 61],
          [126, 76],
          [126, 85],
          [190, 85],
          [190, 35],
        ],
      },
    ],
  },
  { id: "mongolia", rotulo: [103, 46.5], countries: ["Mongolia"] },
  {
    id: "china",
    rotulo: [106, 33],
    countries: ["China", "Taiwan", "North Korea", "South Korea"],
  },
  {
    id: "india",
    rotulo: [78, 22],
    countries: ["India", "Pakistan", "Nepal", "Bhutan", "Bangladesh", "Sri Lanka"],
  },
  {
    id: "vietna",
    rotulo: [101, 16],
    countries: ["Vietnam", "Laos|Lao PDR", "Cambodia", "Thailand", "Myanmar", "Singapore"],
    parts: [{ country: "Malaysia", poly: caixaLonLat(95, -5, 106, 10) }],
  },
  { id: "japao", rotulo: [139, 37], countries: ["Japan"] },
  // Oceania
  {
    id: "sumatra",
    rotulo: [101, -1],
    parts: [
      {
        country: "Indonesia",
        poly: [
          [94, 8],
          [106, 8],
          [106, -5.8],
          [117, -5.8],
          [117, -12],
          [94, -12],
        ],
      },
    ],
  },
  {
    id: "borneu",
    rotulo: [114, 0.5],
    countries: ["Brunei", "Philippines"],
    parts: [
      { country: "Indonesia", poly: caixaLonLat(106, -5.8, 128, 8) },
      { country: "Malaysia", poly: caixaLonLat(106, -5, 125, 10) },
    ],
  },
  {
    id: "novaguine",
    rotulo: [142, -5.5],
    countries: ["Papua New Guinea", "Timor-Leste|East Timor", "Solomon Is.|Solomon Islands"],
    parts: [
      {
        country: "Indonesia",
        poly: [
          [117, -5.8],
          [128, -5.8],
          [128, 8],
          [142, 8],
          [142, -12],
          [117, -12],
        ],
      },
    ],
  },
  { id: "australia", rotulo: [134, -25], countries: ["Australia", "New Zealand"] },
];

// Fronteiras internas de países divididos que não devem aparecer (mesmo território dos dois lados).
const PARES_DO_MESMO_TERRITORIO = [
  ["Russia", "Belarus"],
  ["Russia", "Ukraine"],
  ["Russia", "Estonia"],
  ["Russia", "Latvia"],
  ["Russia", "Lithuania"],
  ["Indonesia", "Papua New Guinea"],
  ["Indonesia", "Timor-Leste"],
  ["Indonesia", "Malaysia"],
  ["Malaysia", "Thailand"],
  ["Malaysia", "Brunei"],
  ["France", "Spain"],
  ["France", "Italy"],
  ["France", "Andorra"],
  ["France", "Monaco"],
];

const chaveDoPar = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Rotas marítimas cujo arco é espelhado (curva para o outro lado).
const CURVA_INVERTIDA = new Set(
  [
    ["islandia", "inglaterra"],
    ["inglaterra", "suecia"],
    ["islandia", "suecia"],
    ["sudao", "madagascar"],
  ].map(([a, b]) => chaveDoPar(a, b)),
);
// Ponta fixa (lon, lat) de uma rota marítima num dos territórios, no lugar do ponto mais próximo.
const PONTA_FIXA = { "madagascar|sudao": { sudao: [40.2, -2] } };

// Variação de luminosidade de cada território dentro do continente (shade() do protótipo):
// o front soma o valor à luminosidade HSL da cor do continente, limitada a [0,2; 0,8].
const TONS = [0, 0.07, -0.06, 0.12, -0.1, 0.04, -0.03, 0.1, -0.08, 0.05, -0.05, 0.09];

const ROTULOS_OCEANOS = [
  ["Oceano Pacífico", [-128, 8]],
  ["Oceano Pacífico", [165, 8]],
  ["Oceano Atlântico", [-30, -8]],
  ["Oceano Índico", [78, -22]],
];
// Ponto (lon, lat) do nome de cada continente.
const ROTULOS_CONTINENTES = {
  AN: [-160, 75],
  AS: [-86, -22],
  EU: [18, 73],
  AF: [-8, 5],
  ASI: [120, 81],
  OC: [108, -24],
};

// ---------------------------------------------------------------------------------------------
// Conferências contra o engine (antes de baixar qualquer coisa).

const falhas = [];
const avisos = [];
const idsEngine = TERRITORIOS.map((t) => t.id);
const idsGeo = GEOGRAFIA.map((t) => t.id);
for (const id of idsEngine) if (!idsGeo.includes(id)) falhas.push(`sem geografia: ${id}`);
for (const id of idsGeo)
  if (!idsEngine.includes(id)) falhas.push(`território fora do engine: ${id}`);
if (new Set(idsGeo).size !== idsGeo.length) falhas.push("território repetido na tabela geográfica");
if (idsEngine.length !== 43) falhas.push(`o engine tem ${idsEngine.length} territórios, e não 43`);
for (const t of TERRITORIOS) {
  const g = GEOGRAFIA.find((x) => x.id === t.id);
  if (g && (g.sub ?? undefined) !== (t.regioes ?? undefined))
    avisos.push(`${t.id}: sub "${g.sub ?? ""}" ≠ regioes do engine "${t.regioes ?? ""}"`);
}
const tipoDoPar = new Map(FRONTEIRAS.map(([a, b, tipo]) => [chaveDoPar(a, b), tipo]));
for (const chave of [...CURVA_INVERTIDA, ...Object.keys(PONTA_FIXA)])
  if (tipoDoPar.get(chave) !== "maritima")
    falhas.push(`${chave} não é fronteira marítima no engine`);
for (const id of IDS_CONTINENTES)
  if (!ROTULOS_CONTINENTES[id]) falhas.push(`sem rótulo para o continente ${id}`);
if (FRONTEIRAS.filter(([, , tipo]) => tipo === "volta").length === 0)
  falhas.push("o engine não tem fronteira de volta do mapa");
if (falhas.length) encerrarComFalhas();

function encerrarComFalhas() {
  console.error(`Conferências falharam:\n  ${falhas.join("\n  ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// Projeção e auxiliares.

const millerRaw = (l, p) => [l, 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * p))];
// Inverso, para o teste de ponto dentro do território (dentro()).
millerRaw.invert = (x, y) => [x, 2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI];
const projecao = geoProjection(millerRaw)
  .rotate([-11, 0])
  .precision(0.2)
  .fitExtent(AREA_DO_MAPA, {
    type: "MultiPoint",
    coordinates: [
      [-168, 83.6],
      [189, -56],
    ],
  });
const caminho = geoPath(projecao);
// Uma casa decimal, como os polyD do protótipo: sobra precisão para 1640×900 e reduz o arquivo.
const arredondar = (texto) => texto.replace(/-?\d+\.\d+/g, (n) => String(Math.round(+n * 10) / 10));
const r1 = (v) => Math.round(v * 10) / 10;
const ponto = (p) => [r1(p[0]), r1(p[1])];
const projetar = (ll) => projecao(ll);

// Reescreve um caminho só de M/L/Z (o que o geoPath gera para polígonos e linhas) em décimos de
// pixel e coordenadas relativas, sem os pontos que o arredondamento repetiu: o arquivo cai a menos
// da metade e o desenho fica o mesmo.
function compactar(texto) {
  let resultado = "";
  // Em décimos de pixel, para as diferenças saírem exatas.
  let atual = [0, 0];
  let inicio = [0, 0];
  const numero = (v) => {
    const s = String(v / 10);
    // Sinal de menos já separa; senão, um espaço (exceto logo depois de uma letra).
    return s.startsWith("-") || /[a-z]$/.test(resultado) ? s : " " + s;
  };
  for (const [, comando, args] of texto.matchAll(/([MLZ])([^MLZ]*)/g)) {
    if (comando === "Z") {
      resultado += "z";
      // Depois do z, o ponto atual volta ao início do subcaminho.
      atual = inicio;
      continue;
    }
    const [x, y] = args.split(",").map(Number);
    const alvo = [Math.round(x * 10), Math.round(y * 10)];
    const dx = alvo[0] - atual[0];
    const dy = alvo[1] - atual[1];
    if (comando === "L" && dx === 0 && dy === 0) continue;
    // Depois de um "m" relativo, os pares seguintes já são "l" relativos implícitos.
    if (comando === "M") {
      resultado += "m";
      inicio = alvo;
    }
    resultado += numero(dx);
    resultado += numero(dy);
    atual = alvo;
  }
  return resultado;
}
const d = (geo) => compactar(caminho(geo) ?? "");
const dPoligono = (poli) =>
  compactar("M" + poli.map((ll) => projetar(ll).join(",")).join("L") + "Z");

const resposta = await fetch(URL_DADOS);
if (!resposta.ok) throw new Error(`falha ao baixar o mapa: ${resposta.status}`);
const topo = await resposta.json();
const paises = topo.objects.countries;

const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const geometriaPorNome = new Map(paises.geometries.map((g) => [normalizar(g.properties.name), g]));
const acharGeometria = (spec) => {
  for (const n of spec.split("|")) {
    const g = geometriaPorNome.get(normalizar(n));
    if (g) return g;
  }
  return null;
};

// Índices: país inteiro → território; países divididos → regiões.
const territorioDaGeometria = new Map();
const paisesDivididos = new Map(); // geometria → [{ id, poly }]
const geo = new Map(); // id → dados de trabalho
for (const t of GEOGRAFIA) {
  const geoms = [];
  for (const nome of t.countries ?? []) {
    const g = acharGeometria(nome);
    if (!g) falhas.push(`${t.id}: país não encontrado no world-atlas: ${nome}`);
    else {
      geoms.push(g);
      territorioDaGeometria.set(g, t.id);
    }
  }
  const partes = [];
  for (const p of t.parts ?? []) {
    const g = acharGeometria(p.country);
    if (!g) {
      falhas.push(`${t.id}: país não encontrado no world-atlas: ${p.country}`);
      continue;
    }
    if (!paisesDivididos.has(g)) paisesDivididos.set(g, []);
    paisesDivididos.get(g).push({ id: t.id, poly: p.poly });
    partes.push({
      geom: g,
      poly: p.poly,
      poligonoTela: p.poly.map(projetar),
      feicao: feature(topo, g),
    });
  }
  geo.set(t.id, { ...t, geoms, partes, unidos: geoms.length ? merge(topo, geoms) : null });
}
// Nomes das exceções não precisam existir todos.
const paresIguais = new Set(
  PARES_DO_MESMO_TERRITORIO.map(([a, b]) => {
    const ga = acharGeometria(a);
    const gb = acharGeometria(b);
    return ga && gb ? chaveDoPar(ga.properties.name, gb.properties.name) : "";
  }),
);
if (falhas.length) encerrarComFalhas();

// ---------------------------------------------------------------------------------------------
// Territórios: partes, rótulo, caixa e tom.

const contornosExternos = (gm) =>
  gm.type === "Polygon"
    ? [gm.coordinates[0]]
    : gm.type === "MultiPolygon"
      ? gm.coordinates.map((p) => p[0])
      : [];

// Contornos externos (em tela) das massas de terra do território, com os pedaços dos países
// divididos limitados ao polígono da região.
function poligonosDeTela(t) {
  const polis = [];
  if (t.unidos) for (const anel of contornosExternos(t.unidos)) polis.push(anel.map(projetar));
  for (const p of t.partes)
    for (const anel of contornosExternos(p.feicao.geometry)) {
      const pts = anel.map(projetar).filter((q) => polygonContains(p.poligonoTela, q));
      if (pts.length > 2) polis.push(pts);
    }
  return polis;
}

function principais(t, fracao) {
  const polis = poligonosDeTela(t);
  const areas = polis.map((pts) => Math.abs(polygonArea(pts)));
  const maior = Math.max(...areas);
  return polis.filter((_, i) => areas[i] >= maior * fracao).flat();
}

// Ponto de tela dentro do território (substitui o isPointInFill do protótipo).
function dentro(t, x, y) {
  const ll = projecao.invert([x, y]);
  if (!ll) return false;
  if (t.unidos && geoContains(t.unidos, ll)) return true;
  return t.partes.some((p) => polygonContains(p.poligonoTela, [x, y]) && geoContains(p.feicao, ll));
}

const saida = {
  largura: W,
  altura: H,
  territorios: {},
  paisesDivididos: {},
  fronteiras: [],
  rotas: {},
  oceanos: ROTULOS_OCEANOS.map(([texto, ll]) => ({ texto, ponto: ponto(projetar(ll)) })),
  continentes: Object.fromEntries(
    IDS_CONTINENTES.map((c) => [c, ponto(projetar(ROTULOS_CONTINENTES[c]))]),
  ),
};

for (const g of paisesDivididos.keys())
  saida.paisesDivididos[g.properties.name] = d(feature(topo, g));

const ordemNoContinente = {};
for (const t of TERRITORIOS) {
  const g = geo.get(t.id);
  const indice = (ordemNoContinente[t.continente] = (ordemNoContinente[t.continente] ?? -1) + 1);
  const partes = [];
  if (g.unidos) partes.push({ d: d(g.unidos) });
  for (const p of g.partes)
    partes.push({ pais: p.geom.properties.name, recorte: dPoligono(p.poly) });
  const pts = principais(g, MASSA_MINIMA_CAIXA);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  saida.territorios[t.id] = {
    partes,
    rotulo: ponto(projetar(g.rotulo)),
    caixa: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r1),
    ...(g.sub ? { sub: g.sub } : {}),
    tom: TONS[indice % TONS.length],
  };
}

// ---------------------------------------------------------------------------------------------
// Fronteiras.

const ehDividido = (g) => paisesDivididos.has(g);
saida.fronteiras.push({
  d: d(
    mesh(topo, paises, (a, b) => {
      if (ehDividido(a) || ehDividido(b)) return false;
      if (a === b) return territorioDaGeometria.has(a);
      const ta = territorioDaGeometria.get(a);
      const tb = territorioDaGeometria.get(b);
      if (!ta && !tb) return false;
      return ta !== tb;
    }),
  ),
});
for (const [pg, regioes] of paisesDivididos) {
  const nome = pg.properties.name;
  // Contorno e fronteiras externas do país dividido, só dentro das regiões usadas.
  saida.fronteiras.push({
    d: d(
      mesh(topo, paises, (a, b) => {
        if (a === b) return a === pg;
        if (a !== pg && b !== pg) return false;
        const outro = a === pg ? b : a;
        if (paresIguais.has(chaveDoPar(nome, outro.properties.name))) return false;
        if (ehDividido(outro) && outro.properties.name < nome) return false;
        return true;
      }),
    ),
    recorte: regioes.map((r) => dPoligono(r.poly)).join(""),
  });
  // Linhas de corte entre os pedaços, só dentro do país.
  saida.fronteiras.push({
    d: regioes.map((r) => dPoligono(r.poly)).join(""),
    recortePais: nome,
  });
}

// ---------------------------------------------------------------------------------------------
// Rotas marítimas e de volta do mapa: cada ponta sai de um ponto dentro do território, no trecho
// mais próximo do outro.

const cachePontos = new Map();
const pontosDasMassas = (t) => {
  if (!cachePontos.has(t.id)) cachePontos.set(t.id, principais(t, MASSA_MINIMA_ROTAS));
  return cachePontos.get(t.id);
};

function paraDentro(t, p, longeDe, profundidade = 8) {
  const dx = p[0] - longeDe[0];
  const dy = p[1] - longeDe[1];
  const len = Math.hypot(dx, dy) || 1;
  for (const s of [profundidade, profundidade * 0.75, profundidade * 0.5, 8, 6, 4, 2]) {
    const q = [p[0] + (dx / len) * s, p[1] + (dy / len) * s];
    if (dentro(t, q[0], q[1])) return q;
  }
  return p;
}

function maisProximos(ta, tb) {
  let melhor = Infinity;
  let A;
  let B;
  for (const p of pontosDasMassas(ta))
    for (const q of pontosDasMassas(tb)) {
      const dist = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      if (dist < melhor) {
        melhor = dist;
        A = p;
        B = q;
      }
    }
  return { A, B, distancia: Math.sqrt(melhor) };
}

function pontasMaritimas(a, b) {
  const ta = geo.get(a);
  const tb = geo.get(b);
  const { A, B, distancia } = maisProximos(ta, tb);
  // Rotas muito curtas (ex.: Coreia–Japão) entram mais no território para a linha ficar visível.
  const profundidade = Math.max(8, (ROTA_MINIMA - distancia) / 2);
  const fixa = PONTA_FIXA[chaveDoPar(a, b)] ?? {};
  return [
    fixa[a] ? projetar(fixa[a]) : paraDentro(ta, A, B, profundidade),
    fixa[b] ? projetar(fixa[b]) : paraDentro(tb, B, A, profundidade),
  ];
}

// Ponto mais à esquerda (sinal -1) ou à direita (+1) das massas de terra do território.
const extremo = (t, sinal) =>
  pontosDasMassas(t).reduce((m, p) => (sinal * p[0] > sinal * m[0] ? p : m));

function pontasDeVolta(a, b) {
  const ta = geo.get(a);
  const tb = geo.get(b);
  const aEsquerda = projetar(ta.rotulo)[0] < projetar(tb.rotulo)[0];
  const A = extremo(ta, aEsquerda ? -1 : 1);
  const B = extremo(tb, aEsquerda ? 1 : -1);
  return [
    paraDentro(ta, A, [A[0] + (aEsquerda ? -10 : 10), A[1]]),
    paraDentro(tb, B, [B[0] + (aEsquerda ? 10 : -10), B[1]]),
  ];
}

for (const [a, b, tipo] of FRONTEIRAS) {
  if (tipo === "terrestre") continue;
  const [A, B] = (tipo === "volta" ? pontasDeVolta(a, b) : pontasMaritimas(a, b)).map(ponto);
  let caminhoRota;
  if (tipo === "volta") {
    // Dois arcos, cada um saindo de uma ponta até a borda do tabuleiro.
    const [E, D] = A[0] < B[0] ? [A, B] : [B, A];
    caminhoRota =
      `M${E[0]},${E[1]} Q${(E[0] + 14) / 2},${E[1] - 40} 14,${E[1] - 30} ` +
      `M${D[0]},${D[1]} Q${(D[0] + W - 14) / 2},${D[1] - 40} ${W - 14},${D[1] - 30}`;
  } else {
    const mx = (A[0] + B[0]) / 2;
    const my = (A[1] + B[1]) / 2;
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const k = CURVA_INVERTIDA.has(chaveDoPar(a, b)) ? -0.18 : 0.18;
    caminhoRota = `M${A[0]},${A[1]} Q${mx - dy * k},${my + dx * k} ${B[0]},${B[1]}`;
  }
  saida.rotas[chaveDoPar(a, b)] = { tipo, d: arredondar(caminhoRota), pontas: [A, B] };
}

// ---------------------------------------------------------------------------------------------
// Conferência geométrica das fronteiras do engine: os pares terrestres precisam se tocar no mapa;
// os marítimos, não.

const DISTANCIA_TOQUE = 1; // px
const poligonosVizinhos = (pa, pb) =>
  pa.some((p) => pb.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < DISTANCIA_TOQUE));
function encostam(a, b, cortesContam) {
  const ta = geo.get(a);
  const tb = geo.get(b);
  // Pedaços do mesmo país dividido: encostam se os polígonos de corte têm um vértice em comum.
  // Só vale para confirmar ligação terrestre: o corte pode passar pelo mar (Malásia, Indonésia).
  if (cortesContam)
    for (const pa of ta.partes)
      for (const pb of tb.partes)
        if (pa.geom === pb.geom && poligonosVizinhos(pa.poligonoTela, pb.poligonoTela)) return true;
  return maisProximosEmTodos(todosOsPontos(ta), todosOsPontos(tb)) < DISTANCIA_TOQUE;
}
const todosOsPontos = (t) => poligonosDeTela(t).flat();
// Só os vértices perto da caixa do outro território interessam.
function perto(pts, outros) {
  const xs = outros.map((p) => p[0]);
  const ys = outros.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return pts.filter((p) => p[0] > x0 - 2 && p[0] < x1 + 2 && p[1] > y0 - 2 && p[1] < y1 + 2);
}
function maisProximosEmTodos(todosA, todosB) {
  const pa = perto(todosA, todosB);
  const pb = perto(todosB, todosA);
  let melhor = Infinity;
  for (const p of pa)
    for (const q of pb) melhor = Math.min(melhor, Math.hypot(p[0] - q[0], p[1] - q[1]));
  return melhor;
}
for (const [a, b, tipo] of FRONTEIRAS) {
  const tocam = encostam(a, b, tipo === "terrestre");
  if (tipo === "terrestre" && !tocam)
    falhas.push(`${a}–${b} é terrestre no engine, mas não se tocam no mapa`);
  if (tipo !== "terrestre" && tocam)
    avisos.push(`${a}–${b} é ${tipo} no engine, mas se tocam no mapa`);
}
if (falhas.length) encerrarComFalhas();

// ---------------------------------------------------------------------------------------------

const json = JSON.stringify(saida);
const destino = fileURLToPath(new URL("../src/mapa/geografia.json", import.meta.url));
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, json + "\n");
for (const aviso of avisos) console.warn(`aviso: ${aviso}`);
console.log(`gravado ${destino} (${Math.round(json.length / 1024)} KB)`);
