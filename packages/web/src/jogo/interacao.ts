// Etapa da interação na tela do jogo: junta a fase da visão com o que o jogador já escolheu
// (`useJogo`) e diz o que o mapa destaca e o que o painel de ação mostra. Tudo o que é possível
// sai das consultas de `previa.ts` (o engine decide); aqui só se organiza a sequência de cliques.
//
// As escolhas guardadas na store são conferidas de novo a cada visão: o que deixou de valer (um
// alvo conquistado, uma carta usada) simplesmente some.
import {
  type Acao,
  type AtaqueAereoEmCurso,
  type AtaqueTerrestreEmCurso,
  cartaDeTroca,
  type CartaId,
  type ConflitoTerrestre,
  type ConquistaPendente,
  type ContinenteId,
  IDS_CONTINENTES,
  jogadorQueAge,
  pendenteDeRecebimento,
  territorio as dadosDoTerritorio,
  type TerritorioId,
  type VisaoPartida,
} from "@warii/engine";
import type { Interacao } from "../stores/jogo";
import {
  alvosAereos,
  alvosTerrestres,
  type CartasDoAtaqueAereo,
  destinosDeDeslocamento,
  ehAerotransporte,
  eu,
  euSouDaVez,
  inicioDoisVagos,
  maoAcimaDoLimite,
  maximoDados,
  maximoDeslocar,
  maximoPosicionar,
  maximoTransportar,
  origensDeAtaque,
  origensDeDeslocamento,
  paresDeTransporte,
  parceirosDoisVagos,
  territoriosOcupaveis,
  territoriosParaReforco,
  territoriosPosicionaveis,
} from "./previa";

type T = TerritorioId;
type Conjunto = ReadonlySet<T>;

export type Etapa =
  // Não é a vez do jogador (ou a partida acabou).
  | { tipo: "espera" }
  | { tipo: "escolha5j"; centros: readonly CartaId[]; doisVagosPossivel: boolean }
  | { tipo: "doisVagos"; primeiro: T | null; segundo: T | null; opcoes: Conjunto }
  | { tipo: "ocupar"; opcoes: Conjunto }
  // Recebimento guiado: primeiro o bônus de cada continente (um continente por vez, só nos seus
  // territórios), depois os livres em qualquer lugar e, no fim, a oferta de usar cartas.
  | {
      tipo: "receber";
      passo: "continente" | "livres" | "cartas";
      // Continente do passo atual (só no passo "continente").
      continente: ContinenteId | null;
      // Exércitos do passo atual (os do continente ou os livres).
      doPasso: number;
      territorio: T | null;
      maximo: number;
      pendente: number;
      temCartas: boolean;
      opcoes: Conjunto;
    }
  | { tipo: "conquista"; conquista: ConquistaPendente }
  // Ataque terrestre declarado, à espera do atacante: rolar mais um ataque ou encerrar.
  // `maximoDados` 0 = o par não pode mais atacar (alvo conquistado ou origem com 1 exército).
  | { tipo: "conflito"; conflito: ConflitoTerrestre; maximoDados: number }
  | { tipo: "aereoEmCurso"; ataque: AtaqueAereoEmCurso }
  // Vez de outro, mas o jogador é o defensor e tem dados a rolar.
  | { tipo: "defesa"; ataque: AtaqueTerrestreEmCurso; dados: number }
  | { tipo: "antiaereo"; ataque: AtaqueAereoEmCurso }
  | { tipo: "maoCheia"; quantidade: number; limite: number }
  | {
      tipo: "terrestre";
      origem: T | null;
      alvo: T | null;
      maximoDados: number;
      origens: Conjunto;
      opcoes: Conjunto;
    }
  | {
      tipo: "aereo";
      daBase: number;
      maximoBase: number;
      cartas: CartasDoAtaqueAereo | null;
      daCaixa: number;
      problemaCartas: string | null;
      alvo: T | null;
      opcoes: Conjunto;
    }
  | {
      tipo: "deslocar";
      origem: T | null;
      destino: T | null;
      maximo: number;
      aereo: boolean;
      origens: Conjunto;
      opcoes: Conjunto;
    }
  | {
      tipo: "reforco";
      carta: CartaId | null;
      numericas: CartaId[];
      valor: number;
      problema: string | null;
      territorio: T | null;
      opcoes: Conjunto;
    }
  | {
      tipo: "transporte";
      cartas: [CartaId, CartaId] | null;
      problema: string | null;
      origem: T | null;
      destino: T | null;
      maximo: number;
      origens: Conjunto;
      opcoes: Conjunto;
    }
  | { tipo: "descarte"; cartas: CartaId[] };

export type TipoEtapa = Etapa["tipo"];

// ---- Cache por visão (a visão é trocada inteira a cada lote, nunca alterada) ----

// Um cache por tipo de resultado, para não precisar de conversão de tipo na leitura.
function cachePorVisao<R>() {
  const caches = new WeakMap<VisaoPartida, Map<string, R>>();
  return (visao: VisaoPartida, chave: string, calcular: () => R): R => {
    let cache = caches.get(visao);
    if (!cache) {
      cache = new Map();
      caches.set(visao, cache);
    }
    const guardado = cache.get(chave);
    if (guardado !== undefined) return guardado;
    const valor = calcular();
    cache.set(chave, valor);
    return valor;
  };
}

const lembrar = cachePorVisao<Conjunto>();
const lembrarPares = cachePorVisao<[TerritorioId, TerritorioId][]>();

const conjunto = (ts: Iterable<T>): Conjunto => new Set(ts);
const VAZIO: Conjunto = new Set();
const valendo = (t: T | null, opcoes: Conjunto): T | null =>
  t !== null && opcoes.has(t) ? t : null;

// Cartas marcadas que ainda estão na mão, separadas em de território (ou continente) e numéricas.
function cartasMarcadas(visao: VisaoPartida, marcadas: readonly CartaId[]) {
  const mao = new Set(eu(visao)?.cartas ?? []);
  const validas = marcadas.filter((c) => mao.has(c));
  const territorio: CartaId[] = [];
  const numericas: CartaId[] = [];
  let soma = 0;
  for (const id of validas) {
    const carta = cartaDeTroca(id);
    if (carta?.tipo === "numerica") {
      numericas.push(id);
      soma += carta.valor;
    } else if (carta) territorio.push(id);
  }
  return { todas: validas, territorio, numericas, soma };
}

// ---- Etapas ----

function doisVagos(visao: VisaoPartida, i: Interacao): Etapa {
  const inicio = lembrar(visao, "doisVagos", () => conjunto(inicioDoisVagos(visao)));
  const primeiro = valendo(i.origem, inicio);
  if (primeiro === null) return { tipo: "doisVagos", primeiro, segundo: null, opcoes: inicio };
  const parceiros = lembrar(visao, `parceiros:${primeiro}`, () =>
    conjunto(parceirosDoisVagos(visao, primeiro)),
  );
  return { tipo: "doisVagos", primeiro, segundo: valendo(i.destino, parceiros), opcoes: parceiros };
}

function receber(visao: VisaoPartida, i: Interacao): Etapa {
  const posicionaveis = lembrar(visao, "posicionaveis", () =>
    conjunto(territoriosPosicionaveis(visao)),
  );
  const r = visao.turno.recebimento;
  const pendente = r ? pendenteDeRecebimento(r) : 0;
  const temCartas = (eu(visao)?.cartas?.length ?? 0) > 0;
  const continente = r
    ? (IDS_CONTINENTES.find((c) => (r.porContinente[c] ?? 0) > 0) ?? null)
    : null;
  let passo: "continente" | "livres" | "cartas" = "cartas";
  let doPasso = 0;
  let opcoes: Conjunto = VAZIO;
  if (r && continente !== null) {
    passo = "continente";
    doPasso = r.porContinente[continente] ?? 0;
    opcoes = lembrar(visao, `posicionaveis:${continente}`, () =>
      conjunto([...posicionaveis].filter((t) => dadosDoTerritorio(t).continente === continente)),
    );
  } else if (r && r.livres > 0) {
    passo = "livres";
    doPasso = r.livres;
    opcoes = posicionaveis;
  }
  // Com um território só no passo, ele já vem escolhido.
  const [unico] = opcoes.size === 1 ? [...opcoes] : [];
  const territorio = valendo(i.destino, opcoes) ?? unico ?? null;
  return {
    tipo: "receber",
    passo,
    continente,
    doPasso,
    territorio,
    // No passo do continente, o máximo fica no bônus dele (o engine gastaria os livres em seguida).
    maximo: territorio ? Math.min(maximoPosicionar(visao, territorio), doPasso) : 0,
    pendente,
    temCartas,
    opcoes,
  };
}

// Há bombardeiros para um ataque aéreo: na base ou, com uma carta de território para chamá-los,
// na caixa (§9.3 B).
export function temAvioes(visao: VisaoPartida): boolean {
  const meu = eu(visao);
  if (!meu) return false;
  if (meu.bombardeirosBase > 0) return true;
  return (
    meu.bombardeirosCaixa > 0 &&
    (meu.cartas ?? []).some((c) => cartaDeTroca(c)?.tipo !== "numerica")
  );
}

function terrestre(visao: VisaoPartida, i: Interacao): Etapa {
  const origens = lembrar(visao, "origensAtaque", () => conjunto(origensDeAtaque(visao)));
  const origem = valendo(i.origem, origens);
  const alvos = origem
    ? lembrar(visao, `alvos:${origem}`, () => conjunto(alvosTerrestres(visao, origem)))
    : VAZIO;
  const alvo = valendo(i.destino, alvos);
  return {
    tipo: "terrestre",
    origem,
    alvo,
    maximoDados: origem && alvo ? maximoDados(visao, origem, alvo) : 0,
    origens,
    opcoes: origem ? alvos : origens,
  };
}

function aereo(visao: VisaoPartida, i: Interacao): Etapa {
  const marcadas = cartasMarcadas(visao, i.cartas);
  let cartas: CartasDoAtaqueAereo | null = null;
  let problemaCartas: string | null = null;
  const [carta] = marcadas.territorio;
  if (marcadas.todas.length > 0) {
    if (marcadas.territorio.length === 1 && carta !== undefined) {
      cartas = { carta, numericas: marcadas.numericas };
    } else {
      problemaCartas =
        "Marque uma só carta de território (a do alvo), com as numéricas que quiser.";
    }
  }
  const maximoBase = eu(visao)?.bombardeirosBase ?? 0;
  const padrao = cartas && !visao.parametros.somarBaseECaixa ? 0 : maximoBase;
  const daBase = Math.max(0, Math.min(i.daBase ?? padrao, maximoBase));
  const chave = `aereo:${daBase}:${cartas ? [cartas.carta, ...cartas.numericas].join(",") : "-"}`;
  const opcoes = problemaCartas
    ? VAZIO
    : lembrar(visao, chave, () => conjunto(alvosAereos(visao, daBase, cartas ?? undefined)));
  return {
    tipo: "aereo",
    daBase,
    maximoBase,
    cartas,
    daCaixa: cartas ? 1 + marcadas.soma : 0,
    problemaCartas,
    alvo: valendo(i.destino, opcoes),
    opcoes,
  };
}

function deslocar(visao: VisaoPartida, i: Interacao): Etapa {
  const origens = lembrar(visao, "origensDeslocar", () => conjunto(origensDeDeslocamento(visao)));
  const origem = valendo(i.origem, origens);
  const destinos = origem
    ? lembrar(visao, `destinos:${origem}`, () => conjunto(destinosDeDeslocamento(visao, origem)))
    : VAZIO;
  const destino = valendo(i.destino, destinos);
  return {
    tipo: "deslocar",
    origem,
    destino,
    maximo: origem && destino ? maximoDeslocar(visao, origem, destino) : 0,
    aereo: origem !== null && destino !== null && ehAerotransporte(origem, destino),
    origens,
    opcoes: origem ? destinos : origens,
  };
}

function reforco(visao: VisaoPartida, i: Interacao): Etapa {
  const marcadas = cartasMarcadas(visao, i.cartas);
  const [carta] = marcadas.territorio;
  const ok = marcadas.territorio.length === 1 && carta !== undefined;
  const opcoes = ok
    ? lembrar(visao, `reforco:${[carta, ...marcadas.numericas].join(",")}`, () =>
        conjunto(territoriosParaReforco(visao, carta, marcadas.numericas)),
      )
    : VAZIO;
  return {
    tipo: "reforco",
    carta: ok ? carta : null,
    numericas: marcadas.numericas,
    valor: 1 + marcadas.soma,
    problema: ok
      ? null
      : marcadas.territorio.length === 0
        ? "Marque uma carta de território e, se quiser, numéricas para somar."
        : "Marque uma só carta de território.",
    territorio: valendo(i.destino, opcoes),
    opcoes,
  };
}

function transporte(visao: VisaoPartida, i: Interacao): Etapa {
  const marcadas = cartasMarcadas(visao, i.cartas);
  const [a, b] = marcadas.territorio;
  const ok =
    marcadas.territorio.length === 2 &&
    marcadas.numericas.length === 0 &&
    a !== undefined &&
    b !== undefined;
  const cartas: [CartaId, CartaId] | null = ok ? [a, b] : null;
  const pares = cartas
    ? lembrarPares(visao, `transporte:${cartas.join(",")}`, () => paresDeTransporte(visao, cartas))
    : [];
  const origens = conjunto(pares.map(([o]) => o));
  const origem = valendo(i.origem, origens);
  const destinos = origem ? conjunto(pares.filter(([o]) => o === origem).map(([, d]) => d)) : VAZIO;
  const destino = valendo(i.destino, destinos);
  return {
    tipo: "transporte",
    cartas,
    problema: ok
      ? null
      : marcadas.numericas.length > 0
        ? "O transporte não usa cartas numéricas."
        : "Marque 2 cartas de territórios seus.",
    origem,
    destino,
    maximo: cartas && origem && destino ? maximoTransportar(visao, cartas, origem, destino) : 0,
    origens,
    opcoes: origem ? destinos : origens,
  };
}

export function derivarEtapa(visao: VisaoPartida, i: Interacao): Etapa {
  if (visao.fase === "FIM" || visao.voce === null) return { tipo: "espera" };
  // Rolagem do defensor: só ele age até rolar.
  const { ataqueTerrestre, ataqueAereo } = visao.turno;
  if (jogadorQueAge(visao) !== visao.voce) return { tipo: "espera" };
  if (ataqueTerrestre) {
    const dados = Math.min(3, visao.territorios[ataqueTerrestre.alvo].exercitos);
    return { tipo: "defesa", ataque: ataqueTerrestre, dados };
  }
  if (ataqueAereo?.etapa === "antiaereo") return { tipo: "antiaereo", ataque: ataqueAereo };
  if (!euSouDaVez(visao)) return { tipo: "espera" };
  if (visao.fase === "PREP_ESCOLHA_5J") {
    if (i.modo === "doisVagos") return doisVagos(visao, i);
    return {
      tipo: "escolha5j",
      centros: visao.preparacao?.centrosExtras ?? [],
      doisVagosPossivel:
        lembrar(visao, "doisVagos", () => conjunto(inicioDoisVagos(visao))).size > 0,
    };
  }
  if (visao.fase === "PREP_OCUPACAO") {
    return {
      tipo: "ocupar",
      opcoes: lembrar(visao, "ocupaveis", () => conjunto(territoriosOcupaveis(visao))),
    };
  }
  // Pendências na ordem em que o engine as cobra.
  const turno = visao.turno;
  if (turno.conquistaPendente) return { tipo: "conquista", conquista: turno.conquistaPendente };
  if (turno.ataqueAereo) return { tipo: "aereoEmCurso", ataque: turno.ataqueAereo };
  if (turno.conflitoTerrestre) {
    const { origem, alvo } = turno.conflitoTerrestre;
    return {
      tipo: "conflito",
      conflito: turno.conflitoTerrestre,
      maximoDados: maximoDados(visao, origem, alvo),
    };
  }

  if (i.modo === "reforco") return reforco(visao, i);
  if (i.modo === "transporte") return transporte(visao, i);
  if (i.modo === "descarte")
    return { tipo: "descarte", cartas: cartasMarcadas(visao, i.cartas).todas };
  if (maoAcimaDoLimite(visao)) {
    return {
      tipo: "maoCheia",
      quantidade: eu(visao)?.cartas?.length ?? 0,
      limite: visao.parametros.limiteMao,
    };
  }
  if (visao.fase === "RECEBER") return receber(visao, i);
  if (visao.fase === "ATACAR")
    return i.modo === "ataqueAereo" && temAvioes(visao) ? aereo(visao, i) : terrestre(visao, i);
  return deslocar(visao, i);
}

// ---- Mapa ----

export interface DestaquesDoMapa {
  // null = mapa sem esmaecer nada.
  opcoes: Conjunto | null;
  marcados: Conjunto;
}

const marcar = (...ts: (T | null)[]): Conjunto => conjunto(ts.filter((t): t is T => t !== null));

export function destaquesDoMapa(etapa: Etapa): DestaquesDoMapa {
  switch (etapa.tipo) {
    case "doisVagos":
      return { opcoes: etapa.opcoes, marcados: marcar(etapa.primeiro, etapa.segundo) };
    case "ocupar":
      return { opcoes: etapa.opcoes, marcados: VAZIO };
    case "receber":
      if (etapa.passo === "cartas") return { opcoes: null, marcados: VAZIO };
      return { opcoes: etapa.opcoes, marcados: marcar(etapa.territorio) };
    case "reforco":
      return { opcoes: etapa.opcoes, marcados: marcar(etapa.territorio) };
    case "terrestre":
      return { opcoes: etapa.opcoes, marcados: marcar(etapa.origem, etapa.alvo) };
    case "aereo":
      return { opcoes: etapa.opcoes, marcados: marcar(etapa.alvo) };
    case "deslocar":
    case "transporte":
      return { opcoes: etapa.opcoes, marcados: marcar(etapa.origem, etapa.destino) };
    case "conquista":
      return { opcoes: VAZIO, marcados: marcar(etapa.conquista.origem, etapa.conquista.alvo) };
    case "conflito":
      return { opcoes: VAZIO, marcados: marcar(etapa.conflito.origem, etapa.conflito.alvo) };
    case "aereoEmCurso":
    case "antiaereo":
      return { opcoes: VAZIO, marcados: marcar(etapa.ataque.alvo) };
    case "defesa":
      return { opcoes: VAZIO, marcados: marcar(etapa.ataque.origem, etapa.ataque.alvo) };
    case "espera":
    case "escolha5j":
    case "maoCheia":
    case "descarte":
      return { opcoes: null, marcados: VAZIO };
    default: {
      const nova: never = etapa;
      return nova;
    }
  }
}

// O que um clique no mapa faz na etapa atual (null = só mostra o território no painel).
export type Efeito =
  | { tipo: "origem"; territorio: T | null }
  | { tipo: "destino"; territorio: T | null }
  | { tipo: "enviar"; acao: Acao };

// Etapas de dois cliques (origem e depois destino). Clicar de novo num escolhido o desmarca;
// clicar noutra origem válida troca a origem. Com o par completo, qualquer outro território
// recomeça a escolha com ele como origem (ou sem origem, se ele não puder sê-la).
function doisCliques(
  t: T,
  origem: T | null,
  destino: T | null,
  origens: Conjunto,
  opcoes: Conjunto,
): Efeito | null {
  if (t === origem) return { tipo: "origem", territorio: null };
  if (t === destino) return { tipo: "destino", territorio: null };
  if (origem !== null && destino !== null) {
    return { tipo: "origem", territorio: origens.has(t) ? t : null };
  }
  if (origem !== null && opcoes.has(t)) return { tipo: "destino", territorio: t };
  if (origens.has(t)) return { tipo: "origem", territorio: t };
  return null;
}

// Etapas de um clique só: o escolhido fica em `destino`.
function umClique(t: T, atual: T | null, opcoes: Conjunto): Efeito | null {
  if (t === atual) return { tipo: "destino", territorio: null };
  return opcoes.has(t) ? { tipo: "destino", territorio: t } : null;
}

export function cliqueNoMapa(etapa: Etapa, t: T): Efeito | null {
  switch (etapa.tipo) {
    case "doisVagos":
      if (etapa.primeiro === null) {
        return etapa.opcoes.has(t) ? { tipo: "origem", territorio: t } : null;
      }
      return doisCliques(t, etapa.primeiro, etapa.segundo, VAZIO, etapa.opcoes);
    case "ocupar":
      return etapa.opcoes.has(t)
        ? { tipo: "enviar", acao: { tipo: "ocupar", territorio: t } }
        : null;
    case "receber":
    case "reforco":
      return umClique(t, etapa.territorio, etapa.opcoes);
    case "aereo":
      return umClique(t, etapa.alvo, etapa.opcoes);
    case "terrestre":
      return doisCliques(t, etapa.origem, etapa.alvo, etapa.origens, etapa.opcoes);
    case "deslocar":
    case "transporte":
      return doisCliques(t, etapa.origem, etapa.destino, etapa.origens, etapa.opcoes);
    default:
      return null;
  }
}

// Escolha recusada num clique de etapa de origem e destino: diz qual das duas o território seria.
export type PapelDaEscolha = "origem" | "destino";

// Origem e destino das etapas de dois cliques (null nas demais).
function escolhaDaEtapa(
  etapa: Etapa,
): { origem: T | null; destino: T | null; origens: Conjunto; opcoes: Conjunto } | null {
  switch (etapa.tipo) {
    case "terrestre":
      return {
        origem: etapa.origem,
        destino: etapa.alvo,
        origens: etapa.origens,
        opcoes: etapa.opcoes,
      };
    case "deslocar":
      return etapa;
    case "transporte":
      return etapa.cartas === null ? null : etapa;
    default:
      return null;
  }
}

export function cliqueInvalido(etapa: Etapa, t: T): PapelDaEscolha | null {
  const e = escolhaDaEtapa(etapa);
  if (e === null || t === e.origem || t === e.destino) return null;
  if (e.origem === null || e.destino !== null) return e.origens.has(t) ? null : "origem";
  return e.opcoes.has(t) || e.origens.has(t) ? null : "destino";
}

// Origem e destino já escolhidos numa etapa de dois cliques.
export function parCompleto(etapa: Etapa): boolean {
  const e = escolhaDaEtapa(etapa);
  return e !== null && e.origem !== null && e.destino !== null;
}
