// Ataque terrestre e conquista (WARII.md §7.1–7.2).

import { FACES_D6 } from "../data/dados.js";
import { saoVizinhos } from "../data/fronteiras.js";
import type { TerritorioId } from "../data/territorios.js";
import { type Contexto, daVez, emitir, exigirProprio, exigirTerritorio } from "./contexto.js";
import { verificarEliminacao } from "./eliminacao.js";
import { exigir, exigirQuantidade } from "./resultado.js";
import { rolar } from "./rng.js";

const rolarOrdenado = (ctx: Contexto, quantidade: number): number[] =>
  Array.from({ length: quantidade }, () => rolar(ctx.rng, FACES_D6)).toSorted((a, b) => b - a);

export function atacar(
  ctx: Contexto,
  valorOrigem: unknown,
  valorAlvo: unknown,
  dados: unknown,
): void {
  const estado = ctx.estado;
  const j = daVez(ctx);
  const origem = exigirProprio(ctx, valorOrigem, "Origem");
  const alvo = exigirTerritorio(valorAlvo, "Alvo");
  const o = estado.territorios[origem];
  const a = estado.territorios[alvo];
  exigir(a.dono !== null && a.dono !== j.id, "ALVO_INVALIDO", "O alvo deve ser de um adversário");
  exigir(saoVizinhos(origem, alvo), "NAO_VIZINHO", "O alvo não faz fronteira com a origem");
  exigir(o.exercitos >= 2, "EXERCITOS_INSUFICIENTES", "A origem precisa de pelo menos 2 exércitos");
  exigirQuantidade(dados);
  const maximo = Math.min(3, o.exercitos - 1);
  exigir(dados <= maximo, "QUANTIDADE_INVALIDA", `Dá para atacar com no máximo ${maximo} dados`);

  // Cada um rola os seus: primeiro o atacante, aqui; depois o defensor, em rolarDefesa().
  const defensor = a.dono;
  const dadosAtaque = rolarOrdenado(ctx, dados);
  estado.turno.ataqueTerrestre = { origem, alvo, defensor, dadosAtaque };
  emitir(ctx, {
    tipo: "dadosDeAtaqueRolados",
    jogador: j.id,
    defensor,
    origem,
    alvo,
    dadosAtaque,
  });
}

export function rolarDefesa(ctx: Contexto): void {
  const estado = ctx.estado;
  const pendente = estado.turno.ataqueTerrestre;
  exigir(pendente !== null, "FASE_ERRADA", "Não há ataque terrestre esperando a defesa");
  estado.turno.ataqueTerrestre = null;
  const j = daVez(ctx);
  const { origem, alvo, defensor, dadosAtaque } = pendente;
  const dados = dadosAtaque.length;
  const o = estado.territorios[origem];
  const a = estado.territorios[alvo];
  const dadosDefesa = rolarOrdenado(ctx, Math.min(3, a.exercitos));
  let perdasAtaque = 0;
  let perdasDefesa = 0;
  const pares = Math.min(dadosAtaque.length, dadosDefesa.length);
  for (let k = 0; k < pares; k++) {
    // Empate favorece a defesa.
    if ((dadosAtaque[k] ?? 0) > (dadosDefesa[k] ?? 0)) perdasDefesa++;
    else perdasAtaque++;
  }
  o.exercitos -= perdasAtaque;
  a.exercitos -= perdasDefesa;
  emitir(ctx, {
    tipo: "ataqueTerrestre",
    jogador: j.id,
    defensor,
    origem,
    alvo,
    dadosAtaque,
    dadosDefesa,
    perdasAtaque,
    perdasDefesa,
  });
  if (a.exercitos > 0) return;

  // Conquista: o primeiro exército entra na hora, para o território nunca ficar vazio; o
  // jogador escolhe depois o total, até o número de dados do último ataque (§7.2). Numa
  // conquista o atacante não perde exércitos na rolagem, então a origem ainda tem ≥ dados + 1.
  a.dono = j.id;
  a.exercitos = 1;
  o.exercitos -= 1;
  estado.turno.conquistou = true;
  emitir(ctx, { tipo: "territorioConquistado", jogador: j.id, defensor, origem, territorio: alvo });
  const totalPossivel = Math.min(dados, o.exercitos);
  if (totalPossivel > 1) estado.turno.conquistaPendente = { origem, alvo, maximo: totalPossivel };
  else concluirConquista(ctx, origem, alvo, 1);
  verificarEliminacao(ctx, defensor, j.id);
}

export function moverAposConquista(ctx: Contexto, quantidade: unknown): void {
  const c = ctx.estado.turno.conquistaPendente;
  exigir(c !== null, "FASE_ERRADA", "Não há conquista esperando movimento");
  exigirQuantidade(quantidade);
  exigir(
    quantidade <= c.maximo,
    "QUANTIDADE_INVALIDA",
    `Podem entrar de 1 a ${c.maximo} exércitos`,
  );
  const extras = quantidade - 1;
  ctx.estado.territorios[c.origem].exercitos -= extras;
  ctx.estado.territorios[c.alvo].exercitos += extras;
  ctx.estado.turno.conquistaPendente = null;
  concluirConquista(ctx, c.origem, c.alvo, quantidade);
}

function concluirConquista(
  ctx: Contexto,
  origem: TerritorioId,
  alvo: TerritorioId,
  quantidade: number,
): void {
  // ⚠ §8.3: por padrão, quem entrou por conquista não se move na fase de deslocamento.
  if (!ctx.estado.parametros.exercitosDaConquistaPodemDeslocar) {
    ctx.estado.territorios[alvo].chegaramNoTurno += quantidade;
  }
  emitir(ctx, {
    tipo: "exercitosMovidosAposConquista",
    jogador: daVez(ctx).id,
    origem,
    destino: alvo,
    quantidade,
  });
}
