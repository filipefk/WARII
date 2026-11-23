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
  // Ataque terrestre (§7.1–7.2). `dados` = exércitos que atacam.
  | {
      readonly tipo: "atacar";
      readonly origem: TerritorioId;
      readonly alvo: TerritorioId;
      readonly dados: number;
    }
  // Total de exércitos que entram no território conquistado (1 até os dados do último ataque).
  | { readonly tipo: "moverAposConquista"; readonly quantidade: number }
  // Ataque aéreo (§7.3): bombardeiros da base e/ou da caixa por cartas (§9.3 B).
  | {
      readonly tipo: "iniciarAtaqueAereo";
      readonly alvo: TerritorioId;
      readonly daBase: number;
      readonly cartas?: { readonly carta: CartaId; readonly numericas: readonly CartaId[] };
    }
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
