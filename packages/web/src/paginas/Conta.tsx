// Conta do usuário: trocar a senha e encerrar as sessões em todos os dispositivos.
import { SENHA_MIN, TrocarSenhaEntrada } from "@warii/shared";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { apiAuth } from "../api/auth";
import { mensagemDoErro } from "../api/cliente";
import { Aviso, Botao, Campo, Cartao } from "../componentes/basicos";
import { useSessao } from "../stores/sessao";

function TrocarSenha() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    setSucesso(false);
    if (novaSenha !== confirmacao) {
      setErro("as senhas novas não conferem");
      return;
    }
    const entrada = TrocarSenhaEntrada.safeParse({ senhaAtual, novaSenha });
    if (!entrada.success) {
      setErro(entrada.error.issues[0]?.message ?? "dados inválidos");
      return;
    }
    setErro(null);
    setEnviando(true);
    apiAuth
      .trocarSenha(entrada.data)
      .then(() => {
        setSucesso(true);
        setSenhaAtual("");
        setNovaSenha("");
        setConfirmacao("");
      })
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setEnviando(false));
  };

  return (
    <Cartao titulo="Trocar senha">
      <form onSubmit={aoEnviar} className="max-w-sm space-y-4" noValidate>
        <Campo
          rotulo="Senha atual"
          type="password"
          autoComplete="current-password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
        />
        <Campo
          rotulo="Nova senha"
          type="password"
          autoComplete="new-password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          dica={`Pelo menos ${SENHA_MIN} caracteres.`}
        />
        <Campo
          rotulo="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
        {erro && <Aviso>{erro}</Aviso>}
        {sucesso && (
          <Aviso tipo="sucesso">Senha trocada. As outras sessões foram encerradas.</Aviso>
        )}
        <Botao type="submit" ocupado={enviando}>
          Trocar senha
        </Botao>
      </form>
    </Cartao>
  );
}

function SairDeTodas() {
  const sairDeTodas = useSessao((s) => s.sairDeTodas);
  const navegar = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const aoClicar = () => {
    if (!window.confirm("Encerrar a sessão em todos os dispositivos, inclusive este?")) return;
    setEnviando(true);
    sairDeTodas()
      .then(() => navegar("/entrar", { replace: true }))
      .catch((falha: unknown) => {
        setErro(mensagemDoErro(falha));
        setEnviando(false);
      });
  };

  return (
    <Cartao titulo="Sessões">
      <p className="mb-3 text-sm text-slate-300">
        Esqueceu a conta aberta em outro computador? Encerre todas as sessões de uma vez.
      </p>
      {erro && (
        <div className="mb-3">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <Botao variante="perigo" ocupado={enviando} onClick={aoClicar}>
        Sair de todos os dispositivos
      </Botao>
    </Cartao>
  );
}

export function Conta() {
  const usuario = useSessao((s) => s.usuario);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{usuario?.nome}</h1>
        <p className="text-sm text-slate-400">{usuario?.email}</p>
      </div>
      <TrocarSenha />
      <SairDeTodas />
    </div>
  );
}
