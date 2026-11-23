// Limite de mensagens por conexão (balde de fichas). Quem estoura recebe LIMITE_EXCEDIDO; quem
// insiste é desconectado.

export interface LimitesDoSocket {
  // Rajada máxima de mensagens.
  capacidade: number;
  // Reposição de fichas por segundo.
  porSegundo: number;
  // Mensagens recusadas por excesso, dentro de um minuto, que levam à desconexão.
  recusasAteDesconectar: number;
}

// Folgados para uma pessoa jogando, apertados para um robô. Mutável só para os testes (que jogam
// partidas inteiras em segundos); vale para as conexões abertas depois da mudança.
export const LIMITES_DO_SOCKET: LimitesDoSocket = {
  capacidade: 20,
  porSegundo: 10,
  recusasAteDesconectar: 20,
};

const JANELA_RECUSAS_MS = 60_000;

export type Veredito = "ok" | "recusar" | "desconectar";

export class LimiteDeMensagens {
  private readonly limites: LimitesDoSocket;
  private fichas: number;
  private ultimo: number;
  private recusas: number[] = [];

  constructor(limites: LimitesDoSocket = LIMITES_DO_SOCKET, agora = Date.now()) {
    this.limites = { ...limites };
    this.fichas = limites.capacidade;
    this.ultimo = agora;
  }

  avaliar(agora = Date.now()): Veredito {
    const { capacidade, porSegundo, recusasAteDesconectar } = this.limites;
    const decorrido = Math.max(0, agora - this.ultimo) / 1000;
    this.fichas = Math.min(capacidade, this.fichas + decorrido * porSegundo);
    this.ultimo = agora;
    if (this.fichas >= 1) {
      this.fichas -= 1;
      return "ok";
    }
    this.recusas = this.recusas.filter((t) => agora - t < JANELA_RECUSAS_MS);
    this.recusas.push(agora);
    return this.recusas.length >= recusasAteDesconectar ? "desconectar" : "recusar";
  }
}
