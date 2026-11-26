// Ações que um jogador pode enviar. São só intenções: aplicarAcao() valida tudo contra o estado.
// O formato também é validado na fronteira (zod, em @warii/shared, etapa 6).

import type { CartaId } from "../data/cartas.js";
import type { TerritorioId } from "../data/territorios.js";

export type Acao =
  // Preparação, 5 jogadores (§4.3): opção (a) ou (b).
  | { readonly tipo: "pegarCentroExtra"; readonly carta: CartaId }
  | {
      readonly tipo: "ocuparDoisVagos";
      readonly territorios: readonly [TerritorioId, TerritorioId];
    }
  // Preparação: ocupação dos vagos (§4.4).
  | { readonly tipo: "ocupar"; readonly territorio: TerritorioId }
  // Recebimento (§6).
  | { readonly tipo: "posicionar"; readonly territorio: TerritorioId; readonly quantidade: number }
  | { readonly tipo: "encerrarRecebimento" }
  // Declara o ataque terrestre entre a origem e o alvo, sem rolar nada: abre o combate para a mesa.
  | {
      readonly tipo: "iniciarAtaqueTerrestre";
      readonly origem: TerritorioId;
      readonly alvo: TerritorioId;
    }
  // Fecha o combate terrestre declarado.
  | { readonly tipo: "encerrarAtaqueTerrestre" }
  // Ataque terrestre (§7.1–7.2). `dados` = exércitos que atacam; o atacante já rola os dele. Sem
  // combate declarado (ou com outro par), declara este antes.
  | {
      readonly tipo: "atacar";
      readonly origem: TerritorioId;
      readonly alvo: TerritorioId;
      readonly dados: number;
    }
  // Do defensor: rola os dados de defesa do ataque terrestre em curso.
  | { readonly tipo: "rolarDefesa" }
  // Total de exércitos que entram no território conquistado (1 até os dados do último ataque).
  | { readonly tipo: "moverAposConquista"; readonly quantidade: number }
  // Ataque aéreo (§7.3): bombardeiros da base e/ou da caixa por cartas (§9.3 B).
  | {
      readonly tipo: "iniciarAtaqueAereo";
      readonly alvo: TerritorioId;
      readonly daBase: number;
      readonly cartas?: { readonly carta: CartaId; readonly numericas: readonly CartaId[] };
    }
  // Do defensor: rola a antiaérea do ciclo. Do atacante: rola o dado de ataque do ciclo.
  | { readonly tipo: "rolarAntiaereo" }
  | { readonly tipo: "rolarAtaqueAereo" }
  // Do atacante, entre os ciclos (só com interromperAtaqueAereo).
  | { readonly tipo: "continuarAtaqueAereo" }
  | { readonly tipo: "encerrarAtaqueAereo" }
  | { readonly tipo: "encerrarAtaques" }
  // Deslocamento terrestre ou aerotransporte CE → CE (§8).
  | {
      readonly tipo: "deslocar";
      readonly origem: TerritorioId;
      readonly destino: TerritorioId;
      readonly quantidade: number;
    }
  // Cartas (§9.3 A e C) e descarte (§9.2).
  | {
      readonly tipo: "reforcarComCartas";
      readonly carta: CartaId;
      readonly territorio: TerritorioId;
      readonly numericas: readonly CartaId[];
    }
  | {
      readonly tipo: "transportarComCartas";
      readonly cartas: readonly [CartaId, CartaId];
      readonly origem: TerritorioId;
      readonly destino: TerritorioId;
      readonly quantidade: number;
    }
  | { readonly tipo: "descartar"; readonly cartas: readonly CartaId[] }
  // Fim da vez: compra as cartas, se houve conquista, e passa a vez (§9.2).
  | { readonly tipo: "encerrarJogada" };

export type TipoAcao = Acao["tipo"];
