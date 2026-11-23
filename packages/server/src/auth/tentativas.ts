// Atraso progressivo e bloqueio temporário de login por e-mail + IP, em memória.
// Basta para uma instância única do servidor; se um dia houver várias, mover para o banco/Redis.
// Complementa o rate limit por IP (@fastify/rate-limit): este freia quem insiste numa mesma conta.

// Falhas toleradas sem atraso.
const FALHAS_SEM_ATRASO = 2;
const ATRASO_BASE_MS = 500;
const ATRASO_MAXIMO_MS = 5_000;
// A partir desta falha, a combinação fica bloqueada por BLOQUEIO_MS.
const FALHAS_PARA_BLOQUEIO = 10;
const BLOQUEIO_MS = 15 * 60 * 1000;
// Sem falhas novas nesse intervalo, o contador é esquecido.
const ESQUECER_APOS_MS = 60 * 60 * 1000;
// Teto de entradas, para um ataque com e-mails aleatórios não esgotar a memória.
const MAXIMO_ENTRADAS = 50_000;

interface Registro {
  falhas: number;
  ultimaFalha: number;
  bloqueadoAte: number;
}

const registros = new Map<string, Registro>();

function chave(email: string, ip: string): string {
  return `${email.toLowerCase()}|${ip}`;
}

function registroAtual(email: string, ip: string, agora: number): Registro | undefined {
  const registro = registros.get(chave(email, ip));
  if (
    registro &&
    agora - registro.ultimaFalha > ESQUECER_APOS_MS &&
    registro.bloqueadoAte < agora
  ) {
    registros.delete(chave(email, ip));
    return undefined;
  }
  return registro;
}

// Milissegundos restantes de bloqueio (0 = liberado).
export function bloqueioRestante(email: string, ip: string): number {
  const agora = Date.now();
  const registro = registroAtual(email, ip, agora);
  return registro ? Math.max(0, registro.bloqueadoAte - agora) : 0;
}

// Quanto esperar antes de responder a esta tentativa, conforme as falhas anteriores.
export function atrasoAntesDaTentativa(email: string, ip: string): number {
  const registro = registroAtual(email, ip, Date.now());
  if (!registro || registro.falhas < FALHAS_SEM_ATRASO) return 0;
  const expoente = registro.falhas - FALHAS_SEM_ATRASO;
  return Math.min(ATRASO_MAXIMO_MS, ATRASO_BASE_MS * 2 ** expoente);
}

export function registrarFalha(email: string, ip: string): void {
  const agora = Date.now();
  const registro = registroAtual(email, ip, agora) ?? {
    falhas: 0,
    ultimaFalha: 0,
    bloqueadoAte: 0,
  };
  registro.falhas += 1;
  registro.ultimaFalha = agora;
  if (registro.falhas >= FALHAS_PARA_BLOQUEIO) registro.bloqueadoAte = agora + BLOQUEIO_MS;
  if (!registros.has(chave(email, ip)) && registros.size >= MAXIMO_ENTRADAS) {
    // Descarta a entrada mais antiga (o Map preserva a ordem de inserção).
    const maisAntiga = registros.keys().next().value;
    if (maisAntiga !== undefined) registros.delete(maisAntiga);
  }
  registros.set(chave(email, ip), registro);
}

export function registrarSucesso(email: string, ip: string): void {
  registros.delete(chave(email, ip));
}

export function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}
