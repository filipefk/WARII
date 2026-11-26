// Comandos de administração das contas (não há cadastro público; o mesmo se faz pela tela de
// usuários do administrador, em /admin/usuarios).
// Em dev:      pnpm --filter @warii/server cli <comando> [argumentos]
// Em produção: node dist/cli.js <comando> [argumentos]   (no terminal do container, no Dokploy)
//
// Não roda migrations: o banco já precisa ter sido preparado pelo servidor ao menos uma vez.
import { esquemaEmail, esquemaNome } from "@warii/shared";
import { criarConta, ErroDeConta, gerarLinkSenha, listarContas } from "./auth/contas.js";
import { pool } from "./db/index.js";

const AJUDA = `Uso:
  conta:criar <email> <nome>   cria a conta e mostra o link de ativação (válido por 72 h)
  senha:link <email>           mostra um link para definir a senha: de ativação (72 h) se a
                               conta ainda não tem senha, senão de redefinição (1 h)
  contas:listar                lista as contas

O link é de uso único e deve ser enviado só ao dono da conta.`;

function formatarData(data: Date): string {
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function lerEmail(valor: string | undefined): string {
  const resultado = esquemaEmail.safeParse(valor ?? "");
  if (!resultado.success) throw new ErroDeConta("ENTRADA_INVALIDA", "informe um e-mail válido");
  return resultado.data;
}

async function exigirBancoPreparado(): Promise<void> {
  const { rows } = await pool.query<{ existe: boolean }>(
    "SELECT to_regclass('public.usuarios') IS NOT NULL AS existe",
  );
  if (!rows[0]?.existe) {
    throw new ErroDeConta(
      "BANCO_NAO_PREPARADO",
      "a tabela de usuários não existe; inicie o servidor uma vez para aplicar as migrations",
    );
  }
}

async function executar(argumentos: string[]): Promise<void> {
  const [comando, ...resto] = argumentos;
  switch (comando) {
    case "conta:criar": {
      const email = lerEmail(resto[0]);
      const nome = esquemaNome.safeParse(resto.slice(1).join(" "));
      if (!nome.success) {
        throw new ErroDeConta("ENTRADA_INVALIDA", nome.error.issues[0]?.message ?? "nome inválido");
      }
      await exigirBancoPreparado();
      await criarConta(email, nome.data);
      const { link, expiraEm } = await gerarLinkSenha(email, "ativacao");
      console.log(`Conta criada para ${nome.data} <${email}>.`);
      console.log(`Link de ativação (válido até ${formatarData(expiraEm)}):\n${link}`);
      return;
    }
    case "senha:link": {
      const email = lerEmail(resto[0]);
      await exigirBancoPreparado();
      const { link, expiraEm, conta, finalidade } = await gerarLinkSenha(email);
      const tipo = finalidade === "ativacao" ? "ativação" : "redefinição";
      console.log(`Link de ${tipo} para ${conta.nome} <${conta.email}>`);
      console.log(`(válido até ${formatarData(expiraEm)}; links anteriores foram invalidados):`);
      console.log(link);
      return;
    }
    case "contas:listar": {
      await exigirBancoPreparado();
      const contas = await listarContas();
      if (contas.length === 0) {
        console.log("Nenhuma conta cadastrada.");
        return;
      }
      console.table(
        contas.map((conta) => ({
          email: conta.email,
          nome: conta.nome,
          situacao: conta.robo ? "robô" : conta.ativa ? "ativa" : "aguardando ativação",
          criada: formatarData(conta.criadoEm),
        })),
      );
      return;
    }
    default:
      console.log(AJUDA);
      if (comando !== undefined && comando !== "ajuda") process.exitCode = 1;
  }
}

try {
  await executar(process.argv.slice(2));
} catch (erro) {
  console.error(erro instanceof ErroDeConta ? `Erro: ${erro.message}` : erro);
  process.exitCode = 1;
} finally {
  await pool.end();
}
