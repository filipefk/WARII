// Login com e-mail e senha. Depois de entrar, volta para onde o usuário estava (ExigirLogin).
import { LoginEntrada } from "@warii/shared";
import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { mensagemDoErro } from "../api/cliente";
import { Aviso, Botao, Campo, Carregando, Cartao } from "../componentes/basicos";
import { useSessao } from "../stores/sessao";

const DESTINO_PADRAO = "/partidas";

const textoDe = (objeto: object, campo: string): string => {
  const valor: unknown = Reflect.get(objeto, campo);
  return typeof valor === "string" ? valor : "";
};

// O `state` da navegação vem do ExigirLogin, mas é lido como desconhecido (o histórico guarda o
// que quiser): só aceita caminhos internos.
function destinoDepoisDoLogin(estado: unknown): string {
  if (typeof estado !== "object" || estado === null) return DESTINO_PADRAO;
  const de: unknown = Reflect.get(estado, "de");
  if (typeof de !== "object" || de === null) return DESTINO_PADRAO;
  const caminho = textoDe(de, "pathname");
  if (!caminho.startsWith("/") || caminho.startsWith("//") || caminho === "/entrar") {
    return DESTINO_PADRAO;
  }
  return `${caminho}${textoDe(de, "search")}${textoDe(de, "hash")}`;
}

export function Entrar() {
  const situacao = useSessao((s) => s.situacao);
  const entrar = useSessao((s) => s.entrar);
  const local = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (situacao === "carregando") return <Carregando />;
  if (situacao === "logado") {
    return <Navigate to={destinoDepoisDoLogin(local.state)} replace />;
  }

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    const entrada = LoginEntrada.safeParse({ email, senha });
    if (!entrada.success) {
      setErro(entrada.error.issues[0]?.message ?? "dados inválidos");
      return;
    }
    setErro(null);
    setEnviando(true);
    entrar(entrada.data)
      .catch((falha: unknown) => setErro(mensagemDoErro(falha)))
      .finally(() => setEnviando(false));
  };

  return (
    <div className="mx-auto max-w-sm">
      <Cartao titulo="Entrar">
        <form onSubmit={aoEnviar} className="space-y-espaco-7" noValidate>
          <Campo
            rotulo="E-mail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Campo
            rotulo="Senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          {erro && <Aviso>{erro}</Aviso>}
          <Botao type="submit" ocupado={enviando} className="w-full">
            Entrar
          </Botao>
        </form>
        <p className="dica mt-espaco-7">
          Não tem conta ou esqueceu a senha? Peça um link ao administrador.
        </p>
      </Cartao>
    </div>
  );
}
