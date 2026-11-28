// Ativação da conta ou redefinição de senha pelo link de uso único gerado na CLI
// (`/definir-senha#token=…`). Ao concluir, o servidor já abre a sessão.
import { DefinirSenhaEntrada, esquemaTokenSenha } from "@warii/shared";
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { Aviso, Botao, Campo, Cartao } from "../componentes/basicos";
import { useTokenDoFragmento } from "../hooks/useTokenDoFragmento";
import { useSessao } from "../stores/sessao";

export function DefinirSenha() {
  const token = useTokenDoFragmento();
  const definirSenha = useSessao((s) => s.definirSenha);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  if (concluido) return <Navigate to="/partidas" replace />;

  if (!token || !esquemaTokenSenha.safeParse(token).success) {
    return (
      <div className="mx-auto max-w-sm">
        <Aviso>Link inválido ou expirado. Peça outro ao administrador.</Aviso>
      </div>
    );
  }

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    if (senha !== confirmacao) {
      setErro("as senhas não conferem");
      return;
    }
    const entrada = DefinirSenhaEntrada.safeParse({ token, senha });
    if (!entrada.success) {
      setErro(entrada.error.issues[0]?.message ?? "dados inválidos");
      return;
    }
    setErro(null);
    setEnviando(true);
    definirSenha(entrada.data)
      .then(() => setConcluido(true))
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setEnviando(false));
  };

  return (
    <div className="mx-auto max-w-sm">
      <Cartao titulo="Definir senha">
        <form onSubmit={aoEnviar} className="space-y-espaco-7" noValidate>
          <Campo
            rotulo="Nova senha"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <Campo
            rotulo="Repita a senha"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
          />
          {erro && <Aviso>{erro}</Aviso>}
          <Botao type="submit" ocupado={enviando} className="w-full">
            Definir senha e entrar
          </Botao>
        </form>
      </Cartao>
    </div>
  );
}
