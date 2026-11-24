// Moldura das telas: cabeçalho (logotipo, navegação, usuário, sair, situação da conexão).
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useConexao, type SituacaoConexao } from "../stores/conexao";
import { useSessao } from "../stores/sessao";
import { FundoDeGuerra } from "./FundoDeGuerra";

const INDICADOR: Record<SituacaoConexao, { texto: string; cor: string } | null> = {
  desligada: null,
  conectando: { texto: "Conectando…", cor: "bg-muted" },
  conectada: { texto: "Conectado", cor: "bg-good" },
  reconectando: { texto: "Sem conexão, tentando de novo…", cor: "bg-bad" },
};

function IndicadorConexao() {
  const situacao = useConexao((s) => s.situacao);
  const indicador = INDICADOR[situacao];
  if (!indicador) return null;
  return (
    <span className="dica flex items-center gap-espaco-2" title={indicador.texto}>
      <span className={`inline-block h-2 w-2 rounded-raio-circulo ${indicador.cor}`} />
      <span className="hidden sm:inline">{indicador.texto}</span>
    </span>
  );
}

// A navegação é uma linha de abas: a da tela atual fica ativa.
const classeAba = ({ isActive }: { isActive: boolean }) => `botao ${isActive ? "ativo" : ""}`;

export function Layout() {
  const usuario = useSessao((s) => s.usuario);
  const sair = useSessao((s) => s.sair);
  const ultimoErro = useConexao((s) => s.ultimoErro);
  const avisar = useConexao((s) => s.avisar);
  const navegar = useNavigate();

  const aoSair = () => {
    void sair().finally(() => {
      void navegar("/entrar", { replace: true });
    });
  };

  return (
    <div className="relative isolate min-h-screen">
      <FundoDeGuerra />
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-espaco-8 gap-y-espaco-3 px-espaco-7 py-espaco-5">
          <Link
            to={usuario ? "/partidas" : "/entrar"}
            className="flex items-end gap-espaco-3 text-text no-underline"
          >
            <img src="/WARII-cromado.svg" alt="War II" width={150} className="block h-auto" />
            <span className="text-titulo font-extrabold leading-none">Online</span>
          </Link>
          {usuario && (
            <nav className="flex items-center gap-espaco-2">
              <NavLink to="/partidas" className={classeAba}>
                Partidas
              </NavLink>
              <NavLink to="/conta" className={classeAba}>
                Conta
              </NavLink>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-espaco-5">
            <IndicadorConexao />
            {usuario && (
              <>
                <span className="hidden text-muted sm:inline">{usuario.nome}</span>
                <button type="button" onClick={aoSair} className="botao">
                  Sair
                </button>
              </>
            )}
          </div>
        </div>
        {ultimoErro && (
          <div
            role="alert"
            className="mx-auto flex max-w-5xl items-center gap-espaco-5 px-espaco-7 pb-espaco-3 text-bad"
          >
            <span>{ultimoErro.mensagem}</span>
            <button type="button" onClick={() => avisar(null)} className="link dica">
              Fechar
            </button>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-espaco-7 py-espaco-8">
        <Outlet />
      </main>
    </div>
  );
}
