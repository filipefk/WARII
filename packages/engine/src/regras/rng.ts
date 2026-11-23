// Gerador de números aleatórios injetado nas regras. O engine nunca sorteia por conta própria:
// o servidor fornece o seu (crypto), e os cenários usam um roteirizado ou com semente.
// O engine consome a RNG numa ordem determinística, então gravar os sorteios basta para repetir
// uma partida (log auditável, etapa 7).

export interface Rng {
  // Inteiro uniforme em [0, maxExclusivo).
  inteiro(maxExclusivo: number): number;
}

export interface Sorteio {
  readonly max: number;
  readonly valor: number;
}

export function rolar(rng: Rng, faces: readonly number[]): number {
  const face = faces[rng.inteiro(faces.length)];
  if (face === undefined) throw new Error("RNG devolveu índice fora das faces do dado");
  return face;
}

// Fisher–Yates; devolve um array novo.
export function embaralhar<T>(rng: Rng, itens: readonly T[]): T[] {
  const r = [...itens];
  for (let i = r.length - 1; i > 0; i--) {
    const j = rng.inteiro(i + 1);
    const a = r[i];
    const b = r[j];
    if (a === undefined || b === undefined) throw new Error("Índice fora da lista ao embaralhar");
    r[i] = b;
    r[j] = a;
  }
  return r;
}

function conferirSorteio(max: number, valor: number): number {
  if (!Number.isInteger(valor) || valor < 0 || valor >= max) {
    throw new Error(`RNG devolveu ${valor}, fora de [0, ${max})`);
  }
  return valor;
}

// Mulberry32: rápido e reprodutível. Só para cenários e simulações, nunca para partidas reais.
export function rngComSemente(semente: number): Rng {
  let a = semente >>> 0;
  return {
    inteiro(max) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const x = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(x * max);
    },
  };
}

// Devolve os índices dados, em ordem. Falha se acabarem ou se um não couber no sorteio pedido.
export function rngRoteirizado(indices: readonly number[]): Rng & { restantes(): number } {
  let pos = 0;
  return {
    inteiro(max) {
      const valor = indices[pos];
      if (valor === undefined) throw new Error(`RNG roteirizada esgotada (sorteio ${pos + 1})`);
      pos++;
      return conferirSorteio(max, valor);
    },
    restantes: () => indices.length - pos,
  };
}

// Envolve uma RNG e registra cada sorteio (para gravar no log junto com a ação).
export function gravarRng(rng: Rng): { rng: Rng; sorteios: Sorteio[] } {
  const sorteios: Sorteio[] = [];
  return {
    sorteios,
    rng: {
      inteiro(max) {
        const valor = conferirSorteio(max, rng.inteiro(max));
        sorteios.push({ max, valor });
        return valor;
      },
    },
  };
}

// Repete sorteios gravados; falha se a sequência de pedidos divergir da gravação.
export function rngDeReplay(sorteios: readonly Sorteio[]): Rng & { restantes(): number } {
  let pos = 0;
  return {
    inteiro(max) {
      const s = sorteios[pos];
      if (s === undefined) throw new Error(`Replay esgotado (sorteio ${pos + 1})`);
      if (s.max !== max) {
        throw new Error(`Replay divergente no sorteio ${pos + 1}: gravado ${s.max}, pedido ${max}`);
      }
      pos++;
      return s.valor;
    },
    restantes: () => sorteios.length - pos,
  };
}

// Índice de uma face com o valor dado (para roteirizar dados nos cenários).
export function indiceDaFace(faces: readonly number[], valor: number): number {
  const i = faces.indexOf(valor);
  if (i < 0) throw new Error(`Nenhuma face com o valor ${valor}`);
  return i;
}
