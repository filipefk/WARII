// Hash de senha com Argon2id (node:crypto), guardado no formato PHC:
// $argon2id$v=19$m=<KiB>,t=<passes>,p=<paralelismo>$<sal base64>$<hash base64>
// Os parâmetros vão junto do hash: dá para endurecê-los no futuro sem invalidar senhas antigas.
import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const argon2Async = promisify(argon2);

// Mínimo recomendado pela OWASP para Argon2id: 19 MiB, 2 passes, 1 via.
const PARAMETROS = { memoria: 19_456, passes: 2, paralelismo: 1 } as const;
const TAMANHO_SAL = 16;
const TAMANHO_HASH = 32;
const VERSAO = 19;

// Teto dos parâmetros aceitos ao ler um hash do banco (evita gastar memória à toa com um hash adulterado).
const MEMORIA_MAXIMA = 262_144;
const PASSES_MAXIMO = 10;

const FORMATO_PHC =
  /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

async function derivar(
  senha: string,
  sal: Buffer,
  memoria: number,
  passes: number,
  paralelismo: number,
  tamanho: number,
): Promise<Buffer> {
  return argon2Async("argon2id", {
    message: senha,
    nonce: sal,
    memory: memoria,
    passes,
    parallelism: paralelismo,
    tagLength: tamanho,
  });
}

// PHC usa base64 sem o "=" de preenchimento.
function base64SemPreenchimento(buffer: Buffer): string {
  return buffer.toString("base64").replace(/=+$/, "");
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const { memoria, passes, paralelismo } = PARAMETROS;
  const hash = await derivar(senha, sal, memoria, passes, paralelismo, TAMANHO_HASH);
  return (
    `$argon2id$v=${VERSAO}$m=${memoria},t=${passes},p=${paralelismo}` +
    `$${base64SemPreenchimento(sal)}$${base64SemPreenchimento(hash)}`
  );
}

export async function verificarSenha(senha: string, hashGuardado: string): Promise<boolean> {
  const partes = FORMATO_PHC.exec(hashGuardado);
  if (!partes) return false;
  const [, versao, m, t, p, salB64, hashB64] = partes;
  const memoria = Number(m);
  const passes = Number(t);
  const paralelismo = Number(p);
  if (
    Number(versao) !== VERSAO ||
    memoria > MEMORIA_MAXIMA ||
    passes > PASSES_MAXIMO ||
    paralelismo < 1 ||
    paralelismo > 16
  ) {
    return false;
  }
  const sal = Buffer.from(salB64 ?? "", "base64");
  const esperado = Buffer.from(hashB64 ?? "", "base64");
  if (sal.length < 8 || esperado.length < 16 || esperado.length > 64) return false;
  const obtido = await derivar(senha, sal, memoria, passes, paralelismo, esperado.length);
  return timingSafeEqual(obtido, esperado);
}

// Hash de uma senha aleatória, calculado uma vez: o login verifica contra ele quando o e-mail
// não existe (ou a conta não foi ativada), para o tempo de resposta não denunciar o caso.
let hashFicticio: Promise<string> | undefined;
export function obterHashFicticio(): Promise<string> {
  hashFicticio ??= gerarHashSenha(randomBytes(32).toString("base64url"));
  return hashFicticio;
}
