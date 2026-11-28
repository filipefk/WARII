// Os 8 dados do jogo (WARII.md §2 e §7.3). As faces dos dados aéreos são parâmetros da
// partida (§13.4); aqui ficam os valores padrão e a alternativa do manual.

export const FACES_D6 = [1, 2, 3, 4, 5, 6] as const;

// Exércitos do defensor abatidos por face (fichas de exército no dado azul).
export const FACES_ATAQUE_AEREO_PADRAO = [0, 0, 0, 1, 2, 3] as const;

// Bombardeiros abatidos por face (peças de avião no dado azul). Escolha de projeto, na linha do
// vídeo (faces com mais de 1 avião) e simétrica ao dado de ataque aéreo.
export const FACES_ANTIAEREO_PADRAO = [0, 0, 0, 1, 2, 3] as const;

// Versão do manual: só faces de 1 avião.
export const FACES_ANTIAEREO_MANUAL = [0, 0, 0, 1, 1, 1] as const;

export interface Dado {
  readonly nome: string;
  readonly quantidade: number;
  readonly faces: readonly number[];
}

export const DADOS = {
  ataqueTerrestre: { nome: "Ataque terrestre (vermelho)", quantidade: 3, faces: FACES_D6 },
  defesaTerrestre: { nome: "Defesa terrestre (amarelo)", quantidade: 3, faces: FACES_D6 },
  ataqueAereo: { nome: "Ataque aéreo (azul)", quantidade: 1, faces: FACES_ATAQUE_AEREO_PADRAO },
  defesaAntiaerea: {
    nome: "Defesa antiaérea (azul)",
    quantidade: 1,
    faces: FACES_ANTIAEREO_PADRAO,
  },
} as const satisfies Readonly<Record<string, Dado>>;
