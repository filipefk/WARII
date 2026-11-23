// Moldura das telas: cabeçalho (nome do usuário, navegação, sair, situação da conexão).
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useConexao, type SituacaoConexao } from "../stores/conexao";
import { useSessao } from "../stores/sessao";

const INDICADOR: Record<SituacaoConexao, { texto: string; cor: string } | null> = {
  desligada: null,
  conectando: { texto: "conectando…", cor: "bg-amber-400" },
  conectada: { texto: "conectado", cor: "bg-emerald-400" },
  reconectando: { texto: "sem conexão, tentando de novo…", cor: "bg-red-500" },
};

function IndicadorConexao() {
  const situacao = useConexao((s) => s.situacao);
  const indicador = INDICADOR[situacao];
  if (!indicador) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400" title={indicador.texto}>
      <span className={`inline-block h-2 w-2 rounded-full ${indicador.cor}`} />
      <span className="hidden sm:inline">{indicador.texto}</span>
    </span>
  );
}

const classeLink = ({ isActive }: { isActive: boolean }) =>
  `text-sm ${isActive ? "text-amber-400" : "text-slate-300 hover:text-white"}`;

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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/70">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to={usuario ? "/partidas" : "/entrar"} className="text-lg font-bold tracking-wide">
            War II <span className="text-amber-400">Online</span>
          </Link>
          {usuario && (
            <nav className="flex items-center gap-4">
              <NavLink to="/partidas" className={classeLink}>
                Partidas
              </NavLink>
              <NavLink to="/conta" className={classeLink}>
                Conta
              </NavLink>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-4">
            <IndicadorConexao />
            {usuario && (
              <>
                <span className="hidden text-sm text-slate-300 sm:inline">{usuario.nome}</span>
                <button
                  type="button"
                  onClick={aoSair}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  Sair
                </button>
              </>
            )}
          </div>
        </div>
        {ultimoErro && (
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-2 text-sm text-red-300">
            <span>{ultimoErro.mensagem}</span>
            <button
              type="button"
              onClick={() => avisar(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              fechar
            </button>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
