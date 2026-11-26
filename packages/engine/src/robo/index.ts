// Robô heurístico: escolhe a próxima ação de um jogador controlado pelo servidor.
//
// Decide só pela visão do próprio robô (não vê cartas nem objetivos alheios) e não reescreve
// regra nenhuma: monta um estado com `estadoDaVisao`, gera ações candidatas em ordem de
// preferência e fica com a primeira que `aplicarAcao` aceitaria (com uma RNG que interrompe no
// primeiro sorteio, como a pré-visualização do front). Se nada servir, usa a ação que encerra a
// fase.

import type { Acao } from "../regras/acoes.js";
import { aplicarAcao } from "../regras/aplicar.js";
import {
  centrosDe,
  exercitosMoviveis,
  jogador,
  jogadorQueAge,
  territoriosDaCarta,
  territoriosDe,
  territoriosVagos,
} from "../regras/consultas.js";
import type { EstadoJogador, EstadoPartida, JogadorId } from "../regras/estado.js";
import type { Rng } from "../regras/rng.js";
import { porTerritorio } from "../regras/util.js";
import { estadoDaVisao, type VisaoPartida } from "../regras/visao.js";
import { cartaDeTroca, type CartaDeTroca, type CartaId } from "../data/cartas.js";
import { IDS_CONTINENTES, type ContinenteId } from "../data/continentes.js";
import { vizinhos } from "../data/fronteiras.js";
import { objetivo } from "../data/objetivos.js";
import {
  CENTROS_ESTRATEGICOS,
  IDS_TERRITORIOS,
  territorio,
  type TerritorioId,
  territoriosDoContinente,
} from "../data/territorios.js";

class SorteioNecessario extends Error {}

const RNG_INTERROMPE: Rng = {
  inteiro() {
    throw new SorteioNecessario("sorteio");
  },
};

interface Contexto {
  readonly estado: EstadoPartida;
  readonly eu: EstadoJogador;
  readonly rng: Rng;
  // Peso de cada território para o objetivo do robô (0 = indiferente).
  readonly interesse: Readonly<Record<TerritorioId, number>>;
}

// A ação seria aceita? Interromper num sorteio quer dizer que passou por todas as conferências.
function aceita(estado: EstadoPartida, id: JogadorId, acao: Acao): boolean {
  try {
    return aplicarAcao(estado, id, acao, RNG_INTERROMPE).ok;
  } catch (e) {
    if (e instanceof SorteioNecessario) return true;
    throw e;
  }
}

// ───────────────────────── leitura do mapa ─────────────────────────

const meu = (c: Contexto, t: TerritorioId): boolean => c.estado.territorios[t].dono === c.eu.id;
const exercitos = (c: Contexto, t: TerritorioId): number => c.estado.territorios[t].exercitos;

const inimigosVizinhos = (c: Contexto, t: TerritorioId): TerritorioId[] =>
  [...vizinhos(t)].filter((v) => {
    const dono = c.estado.territorios[v].dono;
    return dono !== null && dono !== c.eu.id;
  });

const ehFronteira = (c: Contexto, t: TerritorioId): boolean => inimigosVizinhos(c, t).length > 0;

// Exércitos inimigos que podem atacar o território.
const ameaca = (c: Contexto, t: TerritorioId): number =>
  inimigosVizinhos(c, t).reduce((s, v) => s + Math.max(0, exercitos(c, v) - 1), 0);

// Distância (em passos por territórios próprios) até a fronteira mais próxima.
function distanciaAteFronteira(c: Contexto): Map<TerritorioId, number> {
  const dist = new Map<TerritorioId, number>();
  const fila: TerritorioId[] = [];
  for (const t of territoriosDe(c.estado, c.eu.id)) {
    if (ehFronteira(c, t)) {
      dist.set(t, 0);
      fila.push(t);
    }
  }
  for (let i = 0; i < fila.length; i++) {
    const t = fila[i];
    if (t === undefined) break;
    const d = dist.get(t) ?? 0;
    for (const v of vizinhos(t)) {
      if (!meu(c, v) || dist.has(v)) continue;
      dist.set(v, d + 1);
      fila.push(v);
    }
  }
  return dist;
}

const fracaoNoContinente = (estado: EstadoPartida, id: JogadorId, cont: ContinenteId): number => {
  const ts = territoriosDoContinente(cont);
  return ts.filter((t) => estado.territorios[t].dono === id).length / ts.length;
};

// Pequeno ruído para desempatar sem ficar previsível.
const ruido = (c: Contexto): number => c.rng.inteiro(100) / 1000;

function melhor<T>(itens: readonly T[], nota: (x: T) => number): T[] {
  return itens
    .map((x) => ({ x, n: nota(x) }))
    .toSorted((a, b) => b.n - a.n)
    .map((p) => p.x);
}

// ───────────────────────── objetivo ─────────────────────────

function calcularInteresse(estado: EstadoPartida, eu: EstadoJogador): Record<TerritorioId, number> {
  const peso = porTerritorio(() => 0);
  const somar = (ts: readonly TerritorioId[], v: number): void => {
    for (const t of ts) peso[t] += v;
  };
  const o = eu.objetivoId === null ? undefined : objetivo(eu.objetivoId);
  // Continentes em que o robô já está mais forte, para objetivos de "N quaisquer".
  const preferidos = [...IDS_CONTINENTES].toSorted(
    (a, b) => fracaoNoContinente(estado, eu.id, b) - fracaoNoContinente(estado, eu.id, a),
  );
  for (const r of o?.requisitos ?? []) {
    switch (r.tipo) {
      case "destruirCor": {
        const alvo = estado.jogadores.find((j) => j.cor === r.cor);
        if (alvo === undefined || alvo.eliminado || alvo.id === eu.id) break;
        somar(territoriosDe(estado, alvo.id), 4);
        break;
      }
      case "totalidade":
        for (const cont of r.continentes) somar(territoriosDoContinente(cont), 3);
        break;
      case "maioria":
        for (const cont of r.continentes) somar(territoriosDoContinente(cont), 2);
        break;
      case "totalidadeQuaisquer":
        for (const cont of preferidos.slice(0, r.quantidade)) {
          somar(territoriosDoContinente(cont), 2);
        }
        break;
      case "maioriaQuaisquer":
        for (const cont of preferidos.slice(0, r.quantidade + 1)) {
          somar(territoriosDoContinente(cont), 1.5);
        }
        break;
      case "territorios":
        somar(IDS_TERRITORIOS, 1);
        break;
      case "centros":
        somar(CENTROS_ESTRATEGICOS, 3);
        break;
      case "exercitosEm":
        somar(r.territorios, 4);
        break;
    }
  }
  return peso;
}

// ───────────────────────── cartas ─────────────────────────

const cartasDaMao = (c: Contexto): CartaDeTroca[] =>
  c.eu.cartas.flatMap((id) => {
    const carta = cartaDeTroca(id);
    return carta === undefined ? [] : [carta];
  });

const numericasDaMao = (c: Contexto): CartaId[] =>
  cartasDaMao(c)
    .filter((x) => x.tipo === "numerica")
    .map((x) => x.id);

// Reforços com cartas: carta de território (ou continente) num território próprio, de
// preferência na fronteira mais ameaçada. As numéricas vão juntas.
function reforcosComCartas(c: Contexto): Acao[] {
  const numericas = numericasDaMao(c);
  const r: Acao[] = [];
  for (const carta of cartasDaMao(c)) {
    if (carta.tipo === "numerica") continue;
    const meus = territoriosDaCarta(carta).filter((t) => meu(c, t));
    for (const t of melhor(meus, (x) => notaDeReforco(c, x))) {
      r.push({ tipo: "reforcarComCartas", carta: carta.id, territorio: t, numericas });
      r.push({ tipo: "reforcarComCartas", carta: carta.id, territorio: t, numericas: [] });
    }
  }
  return r;
}

// Cartas que menos servem: numéricas por último (somam em qualquer uso), e entre as de território,
// primeiro as que não têm nenhum território próprio nem inimigo útil.
function descartes(c: Contexto): Acao[] {
  const nota = (x: CartaDeTroca): number => {
    if (x.tipo === "numerica") return 10 + x.valor;
    const ts = territoriosDaCarta(x);
    return ts.filter((t) => meu(c, t)).length * 2 + ts.reduce((s, t) => s + c.interesse[t], 0);
  };
  return melhor(cartasDaMao(c), (x) => -nota(x)).map((x) => ({
    tipo: "descartar",
    cartas: [x.id],
  }));
}

// ───────────────────────── preparação ─────────────────────────

function notaDeOcupacao(c: Contexto, t: TerritorioId): number {
  const vizinhosMeus = [...vizinhos(t)].filter((v) => meu(c, v)).length;
  const cont = territorio(t).continente;
  return (
    c.interesse[t] * 2 +
    vizinhosMeus * 1.5 +
    fracaoNoContinente(c.estado, c.eu.id, cont) * 4 +
    (territorio(t).centroEstrategico ? 3 : 0) +
    ruido(c)
  );
}

function acoesDePreparacao(c: Contexto): Acao[] {
  const vagos = melhor(territoriosVagos(c.estado), (t) => notaDeOcupacao(c, t));
  if (c.estado.fase === "PREP_OCUPACAO") {
    return vagos.map((t) => ({ tipo: "ocupar", territorio: t }));
  }
  // 5 jogadores: um CE extra vale mais que dois territórios comuns.
  const r: Acao[] = (c.estado.preparacao?.centrosExtras ?? []).map((carta) => ({
    tipo: "pegarCentroExtra",
    carta,
  }));
  const comuns = vagos.filter((t) => !territorio(t).centroEstrategico).slice(0, 12);
  for (const a of comuns) {
    for (const b of comuns) {
      if (a !== b) r.push({ tipo: "ocuparDoisVagos", territorios: [a, b] });
    }
  }
  return r;
}

// ───────────────────────── recebimento ─────────────────────────

function notaDeReforco(c: Contexto, t: TerritorioId): number {
  if (!ehFronteira(c, t)) return -10 + ruido(c);
  const alvos = inimigosVizinhos(c, t);
  const melhorAlvo = Math.max(0, ...alvos.map((a) => c.interesse[a] - exercitos(c, a) / 4));
  return melhorAlvo * 2 + ameaca(c, t) / 3 + exercitos(c, t) / 5 + ruido(c);
}

function acoesDeRecebimento(c: Contexto): Acao[] {
  const rec = c.estado.turno.recebimento;
  if (rec === null) return [];
  const meus = territoriosDe(c.estado, c.eu.id);
  const r: Acao[] = [];
  // Usa as cartas no recebimento quando a mão está cheia (ou quase).
  if (c.eu.cartas.length >= c.estado.parametros.limiteMao - 1) r.push(...reforcosComCartas(c));
  for (const cont of IDS_CONTINENTES) {
    const v = rec.porContinente[cont] ?? 0;
    if (v <= 0) continue;
    const ali = melhor(
      meus.filter((t) => territorio(t).continente === cont),
      (t) => notaDeReforco(c, t),
    );
    for (const t of ali) r.push({ tipo: "posicionar", territorio: t, quantidade: v });
  }
  if (rec.livres > 0) {
    const ordem = melhor(meus, (t) => notaDeReforco(c, t));
    for (const t of ordem) r.push({ tipo: "posicionar", territorio: t, quantidade: rec.livres });
  }
  r.push({ tipo: "encerrarRecebimento" });
  return r;
}

// ───────────────────────── ataque ─────────────────────────

function notaDeAtaque(c: Contexto, o: TerritorioId, a: TerritorioId): number | null {
  const atk = exercitos(c, o);
  const def = exercitos(c, a);
  const favoravel = atk >= def + 2 || (atk >= 4 && atk >= def * 1.5);
  // Uma conquista barata por vez garante a carta.
  const pelaCarta = !c.estado.turno.conquistou && def === 1 && atk >= 3;
  if (!favoravel && !pelaCarta) return null;
  return c.interesse[a] * 3 + (atk - def) / 2 + (def === 1 ? 2 : 0) + ruido(c);
}

function ataquesTerrestres(c: Contexto) {
  const pares: { o: TerritorioId; a: TerritorioId; n: number }[] = [];
  for (const o of territoriosDe(c.estado, c.eu.id)) {
    if (exercitos(c, o) < 2) continue;
    for (const a of inimigosVizinhos(c, o)) {
      const n = notaDeAtaque(c, o, a);
      if (n !== null) pares.push({ o, a, n });
    }
  }
  return pares
    .toSorted((x, y) => y.n - x.n)
    .map(({ o, a }) => ({
      tipo: "atacar" as const,
      origem: o,
      alvo: a,
      dados: Math.min(3, exercitos(c, o) - 1),
    }));
}

// Bombardeia um território que trava um ataque bom: forte demais para atacar por terra agora.
function ataquesAereos(c: Contexto): Acao[] {
  const base = c.eu.bombardeirosBase;
  const r: Acao[] = [];
  const alvos = melhor(
    IDS_TERRITORIOS.filter((t) => {
      const s = c.estado.territorios[t];
      if (s.dono === null || s.dono === c.eu.id || s.exercitos < 3) return false;
      return [...vizinhos(t)].some((v) => meu(c, v) && exercitos(c, v) >= 4);
    }),
    (t) => c.interesse[t] * 2 + exercitos(c, t) / 3,
  ).slice(0, 3);
  for (const alvo of alvos) {
    const carta = cartasDaMao(c).find(
      (x) => x.tipo !== "numerica" && territoriosDaCarta(x).includes(alvo),
    );
    if (carta !== undefined && c.eu.bombardeirosCaixa >= 2) {
      r.push({
        tipo: "iniciarAtaqueAereo",
        alvo,
        daBase: c.estado.parametros.somarBaseECaixa ? base : 0,
        cartas: { carta: carta.id, numericas: numericasDaMao(c) },
      });
    }
    if (base >= 3) r.push({ tipo: "iniciarAtaqueAereo", alvo, daBase: base });
  }
  return r;
}

function movimentoAposConquista(c: Contexto): Acao[] {
  const p = c.estado.turno.conquistaPendente;
  if (p === null) return [];
  // A origem continua exposta e o conquistado não: entra só o mínimo; senão, o máximo.
  const origemExposta = ehFronteira(c, p.origem);
  const alvoExposto = ehFronteira(c, p.alvo);
  const quantidade = origemExposta && !alvoExposto ? 1 : p.maximo;
  return [
    { tipo: "moverAposConquista", quantidade },
    { tipo: "moverAposConquista", quantidade: 1 },
  ];
}

function acoesDeAtaque(c: Contexto): Acao[] {
  const t = c.estado.turno;
  if (t.conquistaPendente !== null) return movimentoAposConquista(c);
  if (t.ataqueTerrestre !== null) return [{ tipo: "rolarDefesa" }];
  if (t.ataqueAereo?.etapa === "antiaereo") return [{ tipo: "rolarAntiaereo" }];
  if (t.ataqueAereo?.etapa === "ataque") return [{ tipo: "rolarAtaqueAereo" }];
  if (t.ataqueAereo !== null) {
    const continuar = t.ataqueAereo.emCombate > 0 && t.ataqueAereo.ciclos < 6;
    return continuar
      ? [{ tipo: "continuarAtaqueAereo" }, { tipo: "encerrarAtaqueAereo" }]
      : [{ tipo: "encerrarAtaqueAereo" }, { tipo: "continuarAtaqueAereo" }];
  }
  // Como um jogador: declara o ataque (a mesa vê o combate abrir), ataca enquanto o par vale a
  // pena e encerra o combate antes de partir para outro.
  const terrestres = ataquesTerrestres(c);
  const conflito = t.conflitoTerrestre ?? null;
  if (conflito !== null) {
    const mesmoPar = terrestres.filter(
      (a) => a.origem === conflito.origem && a.alvo === conflito.alvo,
    );
    return [...mesmoPar, { tipo: "encerrarAtaqueTerrestre" }];
  }
  if (terrestres.length > 0) {
    return [
      ...terrestres.map(({ origem, alvo }): Acao => ({
        tipo: "iniciarAtaqueTerrestre",
        origem,
        alvo,
      })),
      { tipo: "encerrarAtaques" },
    ];
  }
  // Sem ataque bom por terra: às vezes abre caminho pelo ar.
  const aereos = c.rng.inteiro(2) === 0 ? ataquesAereos(c) : [];
  return [...aereos, { tipo: "encerrarAtaques" }, { tipo: "encerrarJogada" }];
}

// ───────────────────────── deslocamento ─────────────────────────

function acoesDeDeslocamento(c: Contexto): Acao[] {
  const dist = distanciaAteFronteira(c);
  const r: Acao[] = [];
  const meus = territoriosDe(c.estado, c.eu.id);
  // Do interior para o vizinho mais perto da fronteira.
  for (const o of melhor(meus, (t) => dist.get(t) ?? 99)) {
    const d0 = dist.get(o);
    if (d0 === undefined || d0 === 0) continue;
    const quantidade = exercitosMoviveis(c.estado, o);
    if (quantidade < 1) continue;
    const destinos = [...vizinhos(o)].filter((v) => meu(c, v) && (dist.get(v) ?? 99) < d0);
    for (const d of melhor(destinos, (v) => ameaca(c, v) + ruido(c))) {
      r.push({ tipo: "deslocar", origem: o, destino: d, quantidade });
    }
    // CE no interior distante: aerotransporte para o CE de fronteira mais ameaçado.
    if (territorio(o).centroEstrategico && d0 >= 2) {
      const ces = centrosDe(c.estado, c.eu.id).filter((x) => x !== o && dist.get(x) === 0);
      for (const d of melhor(ces, (x) => ameaca(c, x))) {
        r.push({ tipo: "deslocar", origem: o, destino: d, quantidade });
      }
    }
  }
  // Fronteira pouco ameaçada reforça a vizinha bem mais ameaçada.
  for (const o of meus) {
    if (dist.get(o) !== 0) continue;
    const sobra = exercitosMoviveis(c.estado, o) - ameaca(c, o);
    if (sobra < 2) continue;
    for (const d of [...vizinhos(o)].filter((v) => meu(c, v) && dist.get(v) === 0)) {
      if (ameaca(c, d) > exercitos(c, d) + 2) {
        r.push({ tipo: "deslocar", origem: o, destino: d, quantidade: Math.floor(sobra / 2) });
      }
    }
  }
  r.push({ tipo: "encerrarJogada" });
  return r;
}

// ───────────────────────── entrada ─────────────────────────

const SAIDAS: readonly Acao[] = [
  { tipo: "moverAposConquista", quantidade: 1 },
  { tipo: "encerrarAtaqueTerrestre" },
  { tipo: "rolarDefesa" },
  { tipo: "rolarAntiaereo" },
  { tipo: "rolarAtaqueAereo" },
  { tipo: "encerrarAtaqueAereo" },
  { tipo: "continuarAtaqueAereo" },
  { tipo: "encerrarRecebimento" },
  { tipo: "encerrarAtaques" },
  { tipo: "encerrarJogada" },
];

function candidatas(c: Contexto): Acao[] {
  const e = c.estado;
  if (e.fase === "PREP_ESCOLHA_5J" || e.fase === "PREP_OCUPACAO") return acoesDePreparacao(c);
  const pendente =
    e.turno.conquistaPendente !== null ||
    e.turno.ataqueTerrestre !== null ||
    e.turno.ataqueAereo !== null;
  // Mão acima do limite (herança de cartas): usar ou descartar antes de tudo.
  if (!pendente && c.eu.cartas.length > e.parametros.limiteMao) {
    return [...reforcosComCartas(c), ...descartes(c)];
  }
  switch (e.fase) {
    case "RECEBER":
      return acoesDeRecebimento(c);
    case "ATACAR":
      return acoesDeAtaque(c);
    case "DESLOCAR":
      return acoesDeDeslocamento(c);
    default:
      return [];
  }
}

// Próxima ação do robô que deve agir (o da vez, ou o defensor que tem dados a rolar). A RNG só desempata e varia o estilo; os sorteios do jogo
// continuam com o servidor.
export function decidirAcao(visao: VisaoPartida, rng: Rng): Acao {
  const id = visao.voce;
  if (id === null) throw new Error("O robô precisa da visão de um jogador");
  const estado = estadoDaVisao(visao);
  const eu = jogador(estado, id);
  if (eu === undefined || jogadorQueAge(estado) !== id) throw new Error("Não é a vez do robô");
  const c: Contexto = { estado, eu, rng, interesse: calcularInteresse(estado, eu) };
  for (const acao of [...candidatas(c), ...SAIDAS]) {
    if (aceita(estado, id, acao)) return acao;
  }
  throw new Error(`Robô sem ação possível na fase ${estado.fase}`);
}
