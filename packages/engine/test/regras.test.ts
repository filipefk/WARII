// Regras do engine conferidas com os exemplos do manual (WARII.md), com dados roteirizados.
// `pnpm test` na raiz.

import { describe, test } from "node:test";

import {
  type Acao,
  aplicarAcao,
  calcularRecebimento,
  CARTAS_DE_TROCA,
  type CartaId,
  centrosDe,
  criarPartida,
  eventosParaJogador,
  FACES_ANTIAEREO_MANUAL,
  IDS_TERRITORIOS,
  jogadorDaVez,
  objetivo,
  objetivoCumprido,
  PARAMETROS_PADRAO,
  type Parametros,
  rngComSemente,
  territorio,
  type TerritorioId,
  territoriosVagos,
  visaoDoJogador,
} from "../src/index.js";
import {
  d6,
  deA,
  eventos,
  igual,
  jog,
  jogadoresDe,
  type Montagem,
  montar,
  prepararAutomatico,
  recusa,
  rngMisto,
  rodar,
  rodarSo,
  verdade,
} from "./apoio.js";

// AS inteira (4), maioria da OC (3), 2 da AF, 5 da AN, 3 da EU e 2 da ÁSI.
const A19: TerritorioId[] = [
  "venezuela",
  "peru",
  "brasil",
  "argentina",
  "australia",
  "novaguine",
  "borneu",
  "egito",
  "argelia",
  "alasca",
  "mackenzie",
  "groenlandia",
  "vancouver",
  "california",
  "islandia",
  "suecia",
  "franca",
  "aral",
  "omsk",
];

const terrestre = (mexico: number, novayork: number) =>
  montar({ donos: { mexico: ["A", mexico], novayork: ["B", novayork], japao: ["B", 1] } });

const atqMexNy = (dados: number): Acao => ({
  tipo: "atacar",
  origem: "mexico",
  alvo: "novayork",
  dados,
});

const AA = PARAMETROS_PADRAO.facesAntiaereo; // [0,0,0,1,2,3]

const AT = PARAMETROS_PADRAO.facesAtaqueAereo; // [0,0,0,1,2,3]

const face = (faces: readonly number[], v: number) => faces.indexOf(v);

const aereo = (parametros: Partial<Parametros> = {}, cartas: CartaId[] = []) =>
  montar({
    donos: { china: ["B", 6], japao: ["B", 1] },
    resto: "A",
    base: { A: 5 },
    cartas: { A: cartas },
    parametros,
  });

const compra = (mao: CartaId[]) => {
  const e = montar({
    donos: { japao: ["B", 1] },
    resto: "A",
    fase: "DESLOCAR",
    cartas: { A: mao },
  });
  e.turno.conquistou = true;
  return rodar(e, "A", { tipo: "encerrarJogada" });
};

// China conquista a Índia com 3 dados, move os 3 e encerra os ataques (§8.3).
const vezChinaIndia = (podem: boolean) => {
  const e0 = montar({
    donos: { china: ["A", 4], india: ["B", 1], orientemedio: ["A", 1], japao: ["B", 1] },
    parametros: { exercitosDaConquistaPodemDeslocar: podem },
  });
  let e = rodar(
    e0,
    "A",
    { tipo: "atacar", origem: "china", alvo: "india", dados: 3 },
    d6(6, 5, 4, 1),
  ).estado;
  e = rodar(e, "A", { tipo: "moverAposConquista", quantidade: 3 }).estado;
  return rodar(e, "A", { tipo: "encerrarAtaques" }).estado;
};

const EU: TerritorioId[] = [
  "islandia",
  "inglaterra",
  "suecia",
  "moscou",
  "alemanha",
  "franca",
  "polonia",
];

const OC: TerritorioId[] = ["sumatra", "borneu", "novaguine", "australia"];

const AS: TerritorioId[] = ["venezuela", "peru", "brasil", "argentina"];

const cumpre = (objetivoId: string, donos: Montagem["donos"]) =>
  objetivoCumprido(montar({ donos, resto: "B", objetivos: { A: objetivoId } }), "A");

describe("Preparação (§4)", () => {
  for (const n of [3, 4, 5, 6]) {
    test(`${n} jogadores: CEs, ocupação, objetivos e primeiro jogador`, () => {
      const criada = criarPartida(jogadoresDe(n), PARAMETROS_PADRAO, rngComSemente(n));
      if (!criada.ok) throw new Error(criada.erro.mensagem);
      const e0 = criada.estado;
      for (const j of e0.jogadores) {
        igual(centrosDe(e0, j.id).length, n === 5 ? 2 : 12 / n, `CEs de ${j.id}`);
        for (const c of centrosDe(e0, j.id))
          igual(e0.territorios[c].exercitos, 2, `exércitos em ${c}`);
      }
      igual(e0.fase, "PREP_OCUPACAO", "fase");
      igual(e0.monte.length, 61, "monte com as 61 cartas");
      igual(e0.jogadores[e0.vez]?.id, e0.jogadores[e0.distribuidor]?.id, "ocupa primeiro");
      const { estado: e, ultimoAOcupar } = prepararAutomatico(
        e0,
        rngComSemente(n + 10),
        rngComSemente(n + 20),
      );
      igual(territoriosVagos(e).length, 0, "territórios vagos");
      igual([e.fase, e.rodada, e.etapaPrimeiraRodada], ["RECEBER", 1, 1], "início da 1ª rodada");
      const iUltimo = e.jogadores.findIndex((j) => j.id === ultimoAOcupar);
      igual(e.primeiroJogador, (iUltimo + 1) % n, "primeiro jogador = seguinte ao último a ocupar");
      igual(e.vez, e.primeiroJogador, "vez");
      const cores = new Set(e.jogadores.map((j) => j.cor));
      for (const j of e.jogadores) {
        const o = objetivo(j.objetivoOriginalId ?? "");
        verdade(o !== undefined, `${j.id} sem objetivo`);
        for (const r of o?.requisitos ?? []) {
          if (r.tipo === "destruirCor")
            verdade(cores.has(r.cor), `objetivo de cor fora do jogo (${r.cor})`);
        }
      }
    });
  }

  test("Distribuidor: empatados no maior valor rolam de novo (§4.1)", () => {
    const criada = criarPartida(jogadoresDe(3), PARAMETROS_PADRAO, rngMisto(d6(6, 6, 2, 3, 5), 1));
    if (!criada.ok) throw new Error(criada.erro.mensagem);
    const ev = criada.eventos.find((e) => e.tipo === "distribuidorSorteado");
    verdade(ev?.tipo === "distribuidorSorteado", "sem evento do distribuidor");
    if (ev?.tipo !== "distribuidorSorteado") return;
    igual(ev.rolagens.length, 2, "rodadas de rolagem");
    igual(ev.distribuidor, "J2", "distribuidor");
    const primeiro = criada.eventos.find((e) => e.tipo === "centrosDistribuidos");
    igual(
      primeiro?.tipo === "centrosDistribuidos" ? primeiro.jogador : null,
      "J2",
      "1ª carta de CE",
    );
  });

  test("5 jogadores: 2 CEs sem dono, ocupados como vagos na ocupação (§4.3)", () => {
    const criada = criarPartida(jogadoresDe(5), PARAMETROS_PADRAO, rngComSemente(8));
    if (!criada.ok) throw new Error(criada.erro.mensagem);
    const e0 = criada.estado;
    const vagos = IDS_TERRITORIOS.filter(
      (t) => territorio(t).centroEstrategico && e0.territorios[t].dono === null,
    );
    igual(vagos.length, 2, "CEs vagos depois da distribuição");
    const r = rodar(e0, jogadorDaVez(e0).id, { tipo: "ocupar", territorio: vagos[0] ?? "brasil" });
    igual(r.estado.territorios[vagos[0] ?? "brasil"].exercitos, 1, "CE ocupado com 1 exército");
    const { estado: e } = prepararAutomatico(e0, rngComSemente(9), rngComSemente(4));
    igual(territoriosVagos(e).length, 0, "territórios vagos");
    for (const c of vagos) verdade(e.territorios[c].dono !== null, `CE ${c} sem dono`);
  });

  test("Objetivo de destruir a própria cor vira 24 territórios desde o início (§10.2)", () => {
    let achados = 0;
    for (let s = 1; s <= 300; s++) {
      const criada = criarPartida(jogadoresDe(6), PARAMETROS_PADRAO, rngComSemente(s));
      if (!criada.ok) throw new Error(criada.erro.mensagem);
      const { estado: e } = prepararAutomatico(
        criada.estado,
        rngComSemente(s),
        rngComSemente(s + 1),
      );
      for (const j of e.jogadores) {
        const o = objetivo(j.objetivoOriginalId ?? "");
        const propria =
          o?.requisitos.some((r) => r.tipo === "destruirCor" && r.cor === j.cor) ?? false;
        if (propria) {
          achados++;
          igual(j.objetivoId, "subst-24-territorios", `objetivo em vigor de ${j.id}`);
        } else {
          igual(j.objetivoId, j.objetivoOriginalId, `objetivo de ${j.id}`);
        }
      }
    }
    verdade(achados > 0, "nenhum caso de destruir a própria cor em 300 sorteios");
  });
});

describe("Recebimento (§6)", () => {
  test("§6.4 exemplo do manual: 19 territórios, 3 CE, AS inteira e maioria da OC = 17", () => {
    let e = montar({ donos: { ...deA(A19), japao: ["B", 1] }, fase: "DESLOCAR", vez: 2 });
    const calc = calcularRecebimento(e, "A");
    igual(
      [calc.livres, calc.porContinente, calc.centros.length, calc.total],
      [9, { AS: 3, OC: 2 }, 3, 17],
      "cálculo",
    );
    e = rodar(e, "C", { tipo: "encerrarJogada" }).estado;
    igual([e.fase, e.vez], ["RECEBER", 0], "vez de A no recebimento");
    igual(e.territorios.brasil.exercitos, 2, "+1 automático no CE");
    igual([jog(e, "A").bombardeirosBase, jog(e, "A").bombardeirosCaixa], [3, 7], "bombardeiros");
    recusa(e, "A", { tipo: "encerrarRecebimento" }, "RECEBIMENTO_PENDENTE");
    e = rodar(e, "A", { tipo: "posicionar", territorio: "alasca", quantidade: 9 }).estado;
    recusa(
      e,
      "A",
      { tipo: "posicionar", territorio: "alasca", quantidade: 1 },
      "EXERCITOS_INSUFICIENTES",
    );
    e = rodar(e, "A", { tipo: "posicionar", territorio: "brasil", quantidade: 3 }).estado;
    recusa(
      e,
      "A",
      { tipo: "posicionar", territorio: "australia", quantidade: 3 },
      "EXERCITOS_INSUFICIENTES",
    );
    e = rodar(e, "A", { tipo: "posicionar", territorio: "australia", quantidade: 2 }).estado;
    e = rodar(e, "A", { tipo: "encerrarRecebimento" }).estado;
    igual(e.fase, "ATACAR", "fase");
  });

  test("§6.1 parcela de territórios: 8 → 4, 11 → 5, 2 → 3 (mínimo)", () => {
    for (const [n, esperado] of [
      [8, 4],
      [11, 5],
      [2, 3],
    ] as const) {
      const e = montar({ donos: deA(IDS_TERRITORIOS.slice(0, n)) });
      igual(calcularRecebimento(e, "A").livres, esperado, `${n} territórios`);
    }
  });
});

describe("Ataque terrestre e conquista (§7.1–7.2)", () => {
  test("4 × 3 com 3 × 3 dados: 5,4,1 contra 6,3,1 → fica 2 × 2", () => {
    const r = rodar(terrestre(4, 3), "A", atqMexNy(3), d6(5, 4, 1, 6, 3, 1));
    igual(
      [r.estado.territorios.mexico.exercitos, r.estado.territorios.novayork.exercitos],
      [2, 2],
      "exércitos",
    );
  });

  test("3 × 1 com 2 × 1 dados: 3,2 contra 6 → atacante perde 1", () => {
    const r = rodar(terrestre(3, 1), "A", atqMexNy(2), d6(3, 2, 6));
    igual(
      [r.estado.territorios.mexico.exercitos, r.estado.territorios.novayork.exercitos],
      [2, 1],
      "exércitos",
    );
  });

  test("10 × 4: fica 8 × 3, depois conquista e move de 1 até 3", () => {
    let e = rodar(terrestre(10, 4), "A", atqMexNy(3), d6(6, 3, 2, 5, 4, 2)).estado;
    igual([e.territorios.mexico.exercitos, e.territorios.novayork.exercitos], [8, 3], "1º ataque");
    const r = rodar(e, "A", atqMexNy(3), d6(5, 3, 2, 4, 2, 1));
    e = r.estado;
    igual(eventos(r, "territorioConquistado").length, 1, "conquista");
    igual(e.turno.conquistaPendente?.maximo, 3, "máximo a mover");
    recusa(e, "A", { tipo: "moverAposConquista", quantidade: 4 }, "QUANTIDADE_INVALIDA");
    recusa(e, "A", { tipo: "encerrarAtaques" }, "ACAO_BLOQUEADA");
    e = rodar(e, "A", { tipo: "moverAposConquista", quantidade: 3 }).estado;
    igual(
      [
        e.territorios.novayork.dono,
        e.territorios.novayork.exercitos,
        e.territorios.mexico.exercitos,
      ],
      ["A", 3, 5],
      "depois do movimento",
    );
    igual(e.turno.conquistou, true, "conquistou no turno");
    igual(e.territorios.novayork.chegaramNoTurno, 0, "podem se mover no deslocamento (padrão)");
  });

  test("Exércitos da conquista se deslocam no fim da vez: China → Índia → Oriente Médio", () => {
    const desloca: Acao = {
      tipo: "deslocar",
      origem: "india",
      destino: "orientemedio",
      quantidade: 2,
    };
    const antes = vezChinaIndia(true);
    const r = rodar(antes, "A", desloca);
    igual(
      [r.estado.territorios.india.exercitos, r.estado.territorios.orientemedio.exercitos],
      [1, antes.territorios.orientemedio.exercitos + 2],
      "2 dos 3 seguiram para o Oriente Médio",
    );
    recusa(vezChinaIndia(false), "A", desloca, "EXERCITOS_INSUFICIENTES");
  });

  test("Conquista com 1 dado move 1 exército sem perguntar", () => {
    const r = rodar(terrestre(2, 1), "A", atqMexNy(1), d6(6, 1));
    igual(r.estado.turno.conquistaPendente, null, "sem pendência");
    igual(
      [r.estado.territorios.mexico.exercitos, r.estado.territorios.novayork.exercitos],
      [1, 1],
      "exércitos",
    );
  });

  test("Requisitos: dados ≤ origem − 1, origem ≥ 2, alvo vizinho e adversário", () => {
    recusa(terrestre(3, 2), "A", atqMexNy(3), "QUANTIDADE_INVALIDA");
    recusa(terrestre(1, 2), "A", atqMexNy(1), "EXERCITOS_INSUFICIENTES");
    const e = montar({
      donos: { mexico: ["A", 5], california: ["A", 1], novayork: ["B", 2], japao: ["B", 1] },
    });
    recusa(e, "A", { tipo: "atacar", origem: "mexico", alvo: "japao", dados: 1 }, "NAO_VIZINHO");
    recusa(
      e,
      "A",
      { tipo: "atacar", origem: "mexico", alvo: "california", dados: 1 },
      "ALVO_INVALIDO",
    );
    recusa(e, "B", atqMexNy(1), "NAO_E_SUA_VEZ");
  });

  test("Cada um rola os seus: primeiro o ataque, depois a defesa", () => {
    const r1 = rodarSo(terrestre(4, 2), "A", atqMexNy(3), d6(6, 3, 2));
    let e = r1.estado;
    igual(eventos(r1, "dadosDeAtaqueRolados")[0]?.dadosAtaque, [6, 3, 2], "dados do ataque");
    igual(e.turno.ataqueTerrestre?.defensor, "B", "esperando a defesa de B");
    igual(e.territorios.novayork.exercitos, 2, "nada perdido antes da defesa");
    recusa(e, "A", { tipo: "encerrarAtaques" }, "NAO_E_SUA_VEZ");
    recusa(e, "C", { tipo: "rolarDefesa" }, "NAO_E_SUA_VEZ");
    recusa(e, "B", { tipo: "encerrarAtaques" }, "ACAO_BLOQUEADA");
    const r2 = rodarSo(e, "B", { tipo: "rolarDefesa" }, d6(5, 4));
    e = r2.estado;
    const ataque = eventos(r2, "ataqueTerrestre")[0];
    igual(
      [ataque?.dadosAtaque, ataque?.dadosDefesa],
      [
        [6, 3, 2],
        [5, 4],
      ],
      "dados do combate",
    );
    igual([ataque?.perdasAtaque, ataque?.perdasDefesa], [1, 1], "perdas");
    igual(e.turno.ataqueTerrestre, null, "sem pendência");
    recusa(e, "B", { tipo: "rolarDefesa" }, "NAO_E_SUA_VEZ");
  });

  test("Combate declarado: abre sem rolar, segue nos ataques do par e fecha", () => {
    const declarar = {
      tipo: "iniciarAtaqueTerrestre",
      origem: "mexico",
      alvo: "novayork",
    } as const;
    const r1 = rodarSo(terrestre(6, 3), "A", declarar, []);
    let e = r1.estado;
    igual(
      e.turno.conflitoTerrestre,
      { origem: "mexico", alvo: "novayork", defensor: "B" },
      "conflito aberto",
    );
    igual(eventos(r1, "ataqueTerrestreIniciado").length, 1, "evento de início");
    igual(e.turno.ataqueTerrestre, null, "nada rolado");
    e = rodar(e, "A", atqMexNy(3), d6(6, 5, 4, 6, 6, 6)).estado;
    igual(e.turno.conflitoTerrestre?.alvo, "novayork", "continua aberto depois do ataque");
    const r2 = rodarSo(e, "A", { tipo: "encerrarAtaqueTerrestre" }, []);
    igual(r2.estado.turno.conflitoTerrestre, null, "fechado");
    igual(eventos(r2, "ataqueTerrestreEncerrado").length, 1, "evento de fim");
    recusa(r2.estado, "A", { tipo: "encerrarAtaqueTerrestre" }, "FASE_ERRADA");
    recusa(terrestre(1, 3), "A", declarar, "EXERCITOS_INSUFICIENTES");
  });

  test("Atacar sem declarar declara; outra ação fecha o combate aberto", () => {
    const r1 = rodarSo(terrestre(6, 3), "A", atqMexNy(1), d6(6));
    igual(eventos(r1, "ataqueTerrestreIniciado").length, 1, "declarado pelo atacar");
    const e = rodarSo(r1.estado, "B", { tipo: "rolarDefesa" }, d6(1, 1, 1)).estado;
    igual(e.turno.conflitoTerrestre?.origem, "mexico", "aberto depois da defesa");
    const r2 = rodarSo(e, "A", { tipo: "encerrarAtaques" }, []);
    igual(r2.estado.turno.conflitoTerrestre, null, "fechado ao encerrar os ataques");
    igual(eventos(r2, "ataqueTerrestreEncerrado").length, 1, "evento de fim");
  });
});

describe("Ataque aéreo (§7.3)", () => {
  test("Ciclos: abatidos vão à caixa, alvo nunca fica com menos de 1, sobreviventes à base", () => {
    let r = rodar(aereo(), "A", { tipo: "iniciarAtaqueAereo", alvo: "china", daBase: 5 }, [
      face(AA, 2),
      face(AT, 3),
    ]);
    let e = r.estado;
    igual([e.turno.ataqueAereo?.emCombate, e.territorios.china.exercitos], [3, 3], "1º ciclo");
    recusa(e, "A", atqMexNy(1), "ACAO_BLOQUEADA");
    r = rodar(e, "A", { tipo: "continuarAtaqueAereo" }, [face(AA, 0), face(AT, 3)]);
    e = r.estado;
    igual(e.territorios.china.exercitos, 1, "piso de 1 exército");
    igual(e.turno.ataqueAereo, null, "encerrado ao restar 1 exército");
    igual([jog(e, "A").bombardeirosBase, jog(e, "A").bombardeirosCaixa], [3, 7], "base e caixa");
    igual(eventos(r, "ataqueAereoEncerrado")[0]?.destino, "base", "sobreviventes");
  });

  test("Cada um rola os seus: primeiro a antiaérea do defensor, depois o ataque", () => {
    let e = rodarSo(aereo(), "A", { tipo: "iniciarAtaqueAereo", alvo: "china", daBase: 5 }).estado;
    igual(e.turno.ataqueAereo?.etapa, "antiaereo", "esperando a antiaérea");
    recusa(e, "A", { tipo: "rolarAtaqueAereo" }, "NAO_E_SUA_VEZ");
    recusa(e, "C", { tipo: "rolarAntiaereo" }, "NAO_E_SUA_VEZ");
    const r = rodarSo(e, "B", { tipo: "rolarAntiaereo" }, [face(AA, 2)]);
    e = r.estado;
    igual(eventos(r, "antiaereoRolado")[0]?.bombardeirosAbatidos, 2, "antiaérea");
    igual([e.turno.ataqueAereo?.etapa, e.turno.ataqueAereo?.emCombate], ["ataque", 3], "etapa");
    recusa(e, "B", { tipo: "rolarAntiaereo" }, "NAO_E_SUA_VEZ");
    recusa(e, "A", { tipo: "encerrarAtaqueAereo" }, "ACAO_BLOQUEADA");
    const c = rodarSo(e, "A", { tipo: "rolarAtaqueAereo" }, [face(AT, 2)]);
    const ciclo = eventos(c, "cicloAereo")[0];
    igual([ciclo?.dadoAntiaereo, ciclo?.dadoAtaque], [2, 2], "ciclo completo");
    igual(c.estado.turno.ataqueAereo?.etapa, "decisao", "atacante decide se continua");
    igual(c.estado.territorios.china.exercitos, 4, "exércitos abatidos");
  });

  test("Antiaérea que derruba todos encerra o ciclo sem dado de ataque", () => {
    const e = rodarSo(aereo(), "A", {
      tipo: "iniciarAtaqueAereo",
      alvo: "china",
      daBase: 1,
    }).estado;
    const r = rodarSo(e, "B", { tipo: "rolarAntiaereo" }, [face(AA, 1)]);
    igual(eventos(r, "cicloAereo")[0]?.dadoAtaque, null, "sem dado de ataque");
    igual(r.estado.turno.ataqueAereo, null, "encerrado");
  });

  test("Interromper entre ciclos (vídeo)", () => {
    let e = rodar(aereo(), "A", { tipo: "iniciarAtaqueAereo", alvo: "china", daBase: 2 }, [
      face(AA, 0),
      face(AT, 0),
    ]).estado;
    e = rodar(e, "A", { tipo: "encerrarAtaqueAereo" }).estado;
    igual([jog(e, "A").bombardeirosBase, e.territorios.china.exercitos], [5, 6], "nada mudou");
  });

  test("Requisitos: alvo adversário com ≥ 2 exércitos e bombardeiros na base", () => {
    const e = aereo();
    recusa(e, "A", { tipo: "iniciarAtaqueAereo", alvo: "japao", daBase: 1 }, "ALVO_INVALIDO");
    recusa(e, "A", { tipo: "iniciarAtaqueAereo", alvo: "brasil", daBase: 1 }, "ALVO_INVALIDO");
    recusa(
      e,
      "A",
      { tipo: "iniciarAtaqueAereo", alvo: "china", daBase: 6 },
      "BOMBARDEIROS_INSUFICIENTES",
    );
    recusa(e, "A", { tipo: "iniciarAtaqueAereo", alvo: "china", daBase: 0 }, "QUANTIDADE_INVALIDA");
  });

  test("Manual: sem interrupção, os ciclos seguem sem o atacante decidir", () => {
    const r = rodar(
      aereo({ interromperAtaqueAereo: false }),
      "A",
      { tipo: "iniciarAtaqueAereo", alvo: "china", daBase: 2 },
      [face(AA, 1), face(AT, 0), face(AA, 1)],
    );
    igual(eventos(r, "cicloAereo").length, 2, "ciclos");
    igual(
      [jog(r.estado, "A").bombardeirosBase, jog(r.estado, "A").bombardeirosCaixa],
      [3, 7],
      "base e caixa",
    );
  });

  test("Manual: sobreviventes voltam à caixa; base e caixa não se somam", () => {
    let e = rodar(
      aereo({ sobreviventesAereoVoltamParaBase: false }),
      "A",
      {
        tipo: "iniciarAtaqueAereo",
        alvo: "china",
        daBase: 2,
      },
      [face(AA, 0), face(AT, 0)],
    ).estado;
    e = rodar(e, "A", { tipo: "encerrarAtaqueAereo" }).estado;
    igual([jog(e, "A").bombardeirosBase, jog(e, "A").bombardeirosCaixa], [3, 7], "base e caixa");
    recusa(
      aereo({ somarBaseECaixa: false }, ["china"]),
      "A",
      {
        tipo: "iniciarAtaqueAereo",
        alvo: "china",
        daBase: 1,
        cartas: { carta: "china", numericas: [] },
      },
      "ACAO_BLOQUEADA",
    );
    igual(FACES_ANTIAEREO_MANUAL.length, 6, "faces do manual disponíveis");
  });
});

describe("Deslocamento (§8)", () => {
  test("Movimento único: Brasil → Venezuela, e esses mesmos não seguem para o México", () => {
    let e = montar({
      donos: { brasil: ["A", 5], venezuela: ["A", 1], mexico: ["A", 1], japao: ["B", 1] },
      fase: "DESLOCAR",
    });
    e = rodar(e, "A", {
      tipo: "deslocar",
      origem: "brasil",
      destino: "venezuela",
      quantidade: 3,
    }).estado;
    recusa(
      e,
      "A",
      { tipo: "deslocar", origem: "venezuela", destino: "mexico", quantidade: 1 },
      "EXERCITOS_INSUFICIENTES",
    );
    recusa(
      e,
      "A",
      { tipo: "deslocar", origem: "brasil", destino: "mexico", quantidade: 1 },
      "NAO_VIZINHO",
    );
    recusa(
      e,
      "A",
      { tipo: "deslocar", origem: "brasil", destino: "venezuela", quantidade: 2 },
      "EXERCITOS_INSUFICIENTES",
    );
  });

  test("Aerotransporte CE → CE e proibição de seguir para um vizinho", () => {
    let e = montar({
      donos: { novayork: ["A", 4], japao: ["A", 1], vladivostok: ["A", 1], china: ["B", 1] },
      fase: "DESLOCAR",
    });
    const r = rodar(e, "A", {
      tipo: "deslocar",
      origem: "novayork",
      destino: "japao",
      quantidade: 3,
    });
    igual(eventos(r, "deslocamento")[0]?.aereo, true, "aerotransporte");
    e = r.estado;
    recusa(
      e,
      "A",
      { tipo: "deslocar", origem: "japao", destino: "vladivostok", quantidade: 1 },
      "EXERCITOS_INSUFICIENTES",
    );
  });

  test("Deslocar só na fase de deslocamento", () => {
    const e = montar({ donos: { brasil: ["A", 5], venezuela: ["A", 1], japao: ["B", 1] } });
    recusa(
      e,
      "A",
      { tipo: "deslocar", origem: "brasil", destino: "venezuela", quantidade: 1 },
      "FASE_ERRADA",
    );
  });
});

describe("Cartas (§9)", () => {
  test("A) Califórnia + numérica 3 = 4 exércitos na Califórnia", () => {
    const e = montar({
      donos: { california: ["A", 2], japao: ["B", 1] },
      cartas: { A: ["california-vancouver", "num3-01"] },
    });
    const r = rodar(e, "A", {
      tipo: "reforcarComCartas",
      carta: "california-vancouver",
      territorio: "california",
      numericas: ["num3-01"],
    });
    igual(r.estado.territorios.california.exercitos, 6, "exércitos");
    igual(
      [jog(r.estado, "A").cartas, r.estado.descarte],
      [[], ["california-vancouver", "num3-01"]],
      "cartas",
    );
  });

  test("B) China + numéricas 2 e 3 = 6 bombardeiros da caixa contra a China", () => {
    const e = montar({
      donos: { china: ["B", 7], japao: ["B", 1] },
      resto: "A",
      cartas: { A: ["china", "num2-01", "num3-01"] },
    });
    const r = rodar(
      e,
      "A",
      {
        tipo: "iniciarAtaqueAereo",
        alvo: "china",
        daBase: 0,
        cartas: { carta: "china", numericas: ["num2-01", "num3-01"] },
      },
      [face(AA, 0), face(AT, 0)],
    );
    igual(eventos(r, "ataqueAereoIniciado")[0]?.daCaixa, 6, "bombardeiros da caixa");
    const f = rodar(r.estado, "A", { tipo: "encerrarAtaqueAereo" }).estado;
    igual(
      [jog(f, "A").bombardeirosBase, jog(f, "A").bombardeirosCaixa],
      [6, 4],
      "sobreviventes à base",
    );
  });

  test("Numérica sozinha, carta fora da mão e território fora da carta são recusados", () => {
    const e = montar({
      donos: { california: ["A", 2], alasca: ["A", 1], australia: ["A", 1], japao: ["B", 1] },
      cartas: { A: ["california-vancouver", "num3-01", "cont-OC"] },
    });
    recusa(
      e,
      "A",
      { tipo: "reforcarComCartas", carta: "num3-01", territorio: "california", numericas: [] },
      "CARTA_INVALIDA",
    );
    recusa(
      e,
      "A",
      { tipo: "reforcarComCartas", carta: "alasca", territorio: "alasca", numericas: [] },
      "CARTA_INVALIDA",
    );
    recusa(
      e,
      "A",
      {
        tipo: "reforcarComCartas",
        carta: "california-vancouver",
        territorio: "alasca",
        numericas: [],
      },
      "CARTA_INVALIDA",
    );
    const r = rodar(e, "A", {
      tipo: "reforcarComCartas",
      carta: "cont-OC",
      territorio: "australia",
      numericas: [],
    });
    igual(
      r.estado.territorios.australia.exercitos,
      2,
      "carta de continente vale qualquer território dele",
    );
  });

  test("C) Transporte por 2 cartas de territórios próprios, a qualquer distância", () => {
    const e = montar({
      donos: { brasil: ["A", 5], japao: ["A", 1], alasca: ["A", 1], china: ["B", 1] },
      cartas: { A: ["brasil", "japao"] },
    });
    recusa(
      e,
      "A",
      {
        tipo: "transportarComCartas",
        cartas: ["brasil", "japao"],
        origem: "brasil",
        destino: "alasca",
        quantidade: 1,
      },
      "CARTA_INVALIDA",
    );
    const f = rodar(e, "A", {
      tipo: "transportarComCartas",
      cartas: ["brasil", "japao"],
      origem: "brasil",
      destino: "japao",
      quantidade: 4,
    }).estado;
    igual(
      [
        f.territorios.brasil.exercitos,
        f.territorios.japao.exercitos,
        f.territorios.japao.chegaramNoTurno,
      ],
      [1, 5, 4],
      "exércitos",
    );
  });

  test("Compra no fim da vez: 3 cartas, 2 com 3 na mão, nenhuma com 5 (§9.2)", () => {
    igual(jog(compra([]).estado, "A").cartas.length, 3, "mão vazia");
    igual(
      jog(compra(["alasca", "argelia", "num2-01"]).estado, "A").cartas.length,
      5,
      "com 3 na mão",
    );
    const cinco: CartaId[] = ["alasca", "argelia", "num2-01", "num2-02", "num2-03"];
    igual(eventos(compra(cinco), "cartasCompradas").length, 0, "com 5 na mão");
    const semConquista = montar({ donos: { japao: ["B", 1] }, resto: "A", fase: "DESLOCAR" });
    igual(
      eventos(rodar(semConquista, "A", { tipo: "encerrarJogada" }), "cartasCompradas").length,
      0,
      "sem conquista",
    );
  });

  test("Descarte com 10 cartas volta embaralhado ao monte (§9.4)", () => {
    const descarte = CARTAS_DE_TROCA.slice(30, 39).map((c) => c.id);
    const e = montar({
      donos: { japao: ["B", 1] },
      resto: "A",
      cartas: { A: ["alasca"] },
      descarte,
    });
    const antes = e.monte.length;
    const r = aplicarAcao(e, "A", { tipo: "descartar", cartas: ["alasca"] }, rngComSemente(1));
    if (!r.ok) throw new Error(r.erro.mensagem);
    igual([r.estado.descarte.length, r.estado.monte.length], [0, antes + 10], "monte e descarte");
    igual(eventos(r, "descarteReembaralhado")[0]?.quantidade, 10, "evento");
  });

  test("Monte vazio na compra: o descarte volta mesmo abaixo de 10 (§9.4)", () => {
    const descarte = CARTAS_DE_TROCA.slice(30, 32).map((c) => c.id);
    const e = montar({ donos: { japao: ["B", 1] }, resto: "A", fase: "DESLOCAR", descarte });
    e.monte = [];
    e.turno.conquistou = true;
    const r = aplicarAcao(e, "A", { tipo: "encerrarJogada" }, rngComSemente(1));
    if (!r.ok) throw new Error(r.erro.mensagem);
    igual(eventos(r, "descarteReembaralhado")[0]?.quantidade, 2, "reembaralhou");
    igual(jog(r.estado, "A").cartas.length, 2, "comprou as 2 do descarte");
  });
});

describe("Objetivos, eliminação e vitória (§10–11)", () => {
  test("Destruir a cor pelo próprio jogador: vitória na hora", () => {
    const e = montar({
      donos: { japao: ["B", 1], vladivostok: ["A", 4] },
      resto: "A",
      objetivos: { A: "obj01" }, // destruir azul (B)
    });
    const r = rodar(
      e,
      "A",
      { tipo: "atacar", origem: "vladivostok", alvo: "japao", dados: 3 },
      d6(6, 6, 6, 1),
    );
    igual([r.estado.fase, r.estado.vencedor], ["FIM", "A"], "fim de jogo");
    igual(jog(r.estado, "B").eliminado, true, "B eliminado");
    recusa(r.estado, "A", { tipo: "encerrarAtaques" }, "PARTIDA_ENCERRADA");
    igual(
      visaoDoJogador(r.estado, "C").jogadores[0]?.objetivoId,
      "obj01",
      "objetivo do vencedor revelado",
    );
  });

  test("Herança por sorteio: só as que cabem no limite; o resto vai para o descarte", () => {
    const base = {
      donos: { japao: ["B", 1], vladivostok: ["A", 4], brasil: ["C", 1] },
      resto: "A",
      objetivos: { C: "obj01" },
    } as const;
    const atacar = { tipo: "atacar", origem: "vladivostok", alvo: "japao", dados: 3 } as const;
    // A com 3 cartas: cabem 2 das 3 de B. Embaralhar 3 cartas sorteia 2 vezes (índices 0 e 0):
    // [alasca, groenlandia, argelia] → [groenlandia, argelia, alasca].
    const e = montar({
      ...base,
      cartas: {
        A: ["venezuela", "islandia-suecia", "num2-01"],
        B: ["alasca", "groenlandia", "argelia"],
      },
    });
    const r = rodar(e, "A", atacar, [...d6(6, 6, 6, 1), 0, 0]);
    igual(
      jog(r.estado, "A").cartas,
      ["venezuela", "islandia-suecia", "num2-01", "groenlandia", "argelia"],
      "A ficou com 5",
    );
    igual(r.estado.descarte, ["alasca"], "a sobra foi para o descarte");
    const evento = r.eventos.find((x) => x.tipo === "cartasHerdadas");
    igual(
      evento?.tipo === "cartasHerdadas" ? [evento.quantidade, evento.doAdversario] : null,
      [2, 3],
      "2 das 3",
    );
    // Sem a mão cheia, a vez segue sem bloqueio.
    const f = rodar(r.estado, "A", { tipo: "moverAposConquista", quantidade: 1 }).estado;
    rodar(f, "A", { tipo: "encerrarAtaques" });

    // A já com 5 cartas: não recebe nenhuma, e nada é sorteado.
    const cheia = montar({
      ...base,
      cartas: {
        A: ["venezuela", "islandia-suecia", "num2-01", "num2-02", "num2-03"],
        B: ["alasca", "groenlandia"],
      },
    });
    const r2 = rodar(cheia, "A", atacar, d6(6, 6, 6, 1));
    igual(jog(r2.estado, "A").cartas.length, 5, "A continua com 5");
    igual(r2.estado.descarte, ["alasca", "groenlandia"], "todas para o descarte");
  });

  test("Eliminação por outro: destruir cor vira 24 territórios; cartas herdadas acima de 5", () => {
    const e = montar({
      donos: { japao: ["B", 1], vladivostok: ["A", 4], brasil: ["C", 1] },
      resto: "A",
      objetivos: { C: "obj01" },
      // Regra do manual: herda todas e descarta o excesso.
      parametros: { herancaLimitadaPorSorteio: false },
      cartas: {
        A: ["venezuela", "islandia-suecia", "num2-01"],
        B: ["alasca", "groenlandia", "argelia"],
      },
    });
    const r = rodar(
      e,
      "A",
      { tipo: "atacar", origem: "vladivostok", alvo: "japao", dados: 3 },
      d6(6, 6, 6, 1),
    );
    let f = r.estado;
    igual(jog(f, "C").objetivoId, "subst-24-territorios", "objetivo de C");
    igual(jog(f, "A").cartas.length, 6, "A herdou as cartas de B");
    igual(f.fase, "ATACAR", "partida segue");
    const paraC = eventosParaJogador(r.eventos, "C");
    igual(
      paraC.filter((x) => x.tipo === "objetivoAlterado").length,
      1,
      "C vê a troca do próprio objetivo",
    );
    const paraB = eventosParaJogador(r.eventos, "B");
    igual(paraB.filter((x) => x.tipo === "objetivoAlterado").length, 0, "B não vê o objetivo de C");
    const herdadas = paraB.find((x) => x.tipo === "cartasHerdadas");
    igual(
      herdadas?.tipo === "cartasHerdadas" ? herdadas.cartas : null,
      [],
      "B não vê as cartas herdadas",
    );
    f = rodar(f, "A", { tipo: "moverAposConquista", quantidade: 1 }).estado;
    recusa(f, "A", { tipo: "encerrarAtaques" }, "ACAO_BLOQUEADA");
    recusa(
      f,
      "A",
      { tipo: "atacar", origem: "vladivostok", alvo: "japao", dados: 1 },
      "ACAO_BLOQUEADA",
    );
    f = rodar(f, "A", { tipo: "encerrarAtaqueTerrestre" }).estado;
    igual(f.turno.conflitoTerrestre, null, "combate fechado com a mão cheia");
    f = rodar(f, "A", { tipo: "descartar", cartas: ["num2-01"] }).estado;
    f = rodar(f, "A", { tipo: "encerrarAtaques" }).estado;
    igual(f.fase, "DESLOCAR", "fase");
  });

  test("Objetivo 12: Europa, Oceania e outro continente", () => {
    igual(cumpre("obj12", deA([...EU, ...OC, ...AS])), true, "EU + OC + AS");
    igual(cumpre("obj12", deA([...EU, ...OC])), false, "só EU + OC");
  });

  test("Objetivo 17: América do Sul, Europa e 20 exércitos na Alemanha", () => {
    igual(
      cumpre("obj17", { ...deA([...AS, ...EU]), alemanha: ["A", 19] }),
      false,
      "19 na Alemanha",
    );
    igual(cumpre("obj17", { ...deA([...AS, ...EU]), alemanha: ["A", 20] }), true, "20 na Alemanha");
  });

  test("Objetivo 19: 5 CE com pelo menos 10 exércitos em cada", () => {
    const ces: TerritorioId[] = ["brasil", "egito", "china", "japao", "novayork"];
    igual(cumpre("obj19", deA(ces, 10)), true, "5 CE com 10");
    igual(cumpre("obj19", { ...deA(ces, 10), japao: ["A", 9] }), false, "um CE com 9");
  });

  test("Objetivo 20: 20 exércitos em Nova York e 20 no Japão", () => {
    igual(cumpre("obj20", { novayork: ["A", 20], japao: ["A", 20] }), true, "20 e 20");
    igual(cumpre("obj20", { novayork: ["A", 20], japao: ["A", 19] }), false, "20 e 19");
    igual(cumpre("obj20", { novayork: ["A", 20], japao: ["B", 20] }), false, "Japão de outro");
  });
});
