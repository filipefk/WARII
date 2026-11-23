// Ambiente dos testes do servidor. Precisa ser o PRIMEIRO import de cada *.test.ts: o config.ts
// lê process.env assim que é carregado, e os imports de um módulo ESM rodam na ordem em que aparecem.
//
// Banco: DATABASE_URL_TESTE, se definida; senão o mesmo servidor de DATABASE_URL (do .env) num
// database com sufixo "_teste", criado e migrado sozinho. Os testes APAGAM os dados desse database.
// Sem nenhuma das duas, os testes que usam o banco são pulados.

const urlDeTeste = process.env.DATABASE_URL_TESTE;
const urlBase = process.env.DATABASE_URL;

function urlComSufixo(url: string): string {
  const alvo = new URL(url);
  alvo.pathname = `${alvo.pathname}_teste`;
  return alvo.toString();
}

export const temBanco = urlDeTeste !== undefined || urlBase !== undefined;
export const motivoSemBanco = temBanco ? false : "sem DATABASE_URL nem DATABASE_URL_TESTE";

process.env.DATABASE_URL =
  urlDeTeste ?? (urlBase ? urlComSufixo(urlBase) : "postgres://ninguem@127.0.0.1:1/sem_banco");
process.env.NODE_ENV = "development";
process.env.LOG_LEVEL = "silent";
process.env.SESSION_SECRET = "segredo-usado-somente-nos-testes-automatizados";
process.env.URL_PUBLICA = "http://localhost:5173";
process.env.TRUST_PROXY = "false";
