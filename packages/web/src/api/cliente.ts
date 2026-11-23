// Cliente HTTP da API (/api). Toda resposta de erro do servidor tem o corpo { codigo, mensagem }
// (ErroApi); aqui ela vira um ErroDaApi, que as telas exibem pela mensagem.
import type { ErroApi } from "@warii/shared";

export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroDaApi";
  }
}

type Metodo = "GET" | "POST" | "PUT" | "DELETE";

// Chamado quando o servidor responde que a sessão não vale mais (o store da sessão se registra).
let aoNaoAutenticado: () => void = () => {};
export function definirAoNaoAutenticado(funcao: () => void): void {
  aoNaoAutenticado = funcao;
}

function ehErroApi(corpo: unknown): corpo is ErroApi {
  return (
    typeof corpo === "object" &&
    corpo !== null &&
    "codigo" in corpo &&
    "mensagem" in corpo &&
    typeof corpo.codigo === "string" &&
    typeof corpo.mensagem === "string"
  );
}

export async function requisitar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      credentials: "same-origin",
      headers: corpo === undefined ? undefined : { "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroDaApi(0, "SEM_CONEXAO", "sem conexão com o servidor; tente de novo");
  }

  // As respostas vêm do próprio servidor, tipadas pelo contrato de @warii/shared (sem validação
  // em tempo de execução): o tipo de cada rota é declarado em api/auth.ts e api/partidas.ts.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  if (resposta.status === 204) return undefined as T;
  const dados: unknown = await resposta.json().catch(() => undefined);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  if (resposta.ok) return dados as T;

  const erro = ehErroApi(dados)
    ? new ErroDaApi(resposta.status, dados.codigo, dados.mensagem)
    : new ErroDaApi(resposta.status, "ERRO_DESCONHECIDO", `erro ${resposta.status} do servidor`);
  if (erro.codigo === "NAO_AUTENTICADO") aoNaoAutenticado();
  throw erro;
}

// Mensagem para exibir de qualquer erro capturado numa tela.
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDaApi) return erro.message;
  return "algo deu errado; tente de novo";
}
