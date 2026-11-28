// Indicador do usuário logado no cabeçalho: ao clicar no nome/avatar, abre o submenu com
// "Conta" e "Sair". Fecha ao escolher, ao clicar fora ou com Esc.
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useSessao } from "../stores/sessao";
import { Avatar } from "./Avatar";

const CLASSE_ITEM =
  "block w-full px-espaco-6 py-espaco-3 text-left text-text no-underline hover:bg-panel-2 focus-visible:bg-panel-2 focus-visible:outline-none";

export function MenuDoUsuario() {
  const usuario = useSessao((s) => s.usuario);
  const sair = useSessao((s) => s.sair);
  const navegar = useNavigate();
  const local = useLocation();
  // Guarda a tela em que o menu foi aberto: trocar de tela o fecha.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === local.pathname;
  const setAberto = (abrir: boolean) => setAbertoEm(abrir ? local.pathname : null);
  const raiz = useRef<HTMLDivElement>(null);
  const idMenu = useId();

  // Ouvintes sempre ligados: fechar o que já está fechado não renderiza de novo.
  useEffect(() => {
    const aoClicarFora = (e: PointerEvent) => {
      const alvo = e.target;
      if (!(alvo instanceof Node) || !raiz.current?.contains(alvo)) setAbertoEm(null);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbertoEm(null);
    };
    document.addEventListener("pointerdown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, []);

  if (!usuario) return null;

  const aoSair = () => {
    setAberto(false);
    void sair().finally(() => {
      void navegar("/entrar", { replace: true });
    });
  };

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        title={usuario.nome}
        className={`flex items-center gap-espaco-2 rounded-raio-md border px-espaco-3 py-espaco-1 text-muted hover:border-accent ${
          aberto ? "border-accent" : "border-transparent"
        }`}
      >
        <Avatar usuarioId={usuario.id} avatar={usuario.avatar} />
        <span className="hidden sm:inline">{usuario.nome}</span>
        <span aria-hidden className="text-dica">
          ▾
        </span>
      </button>
      {aberto && (
        <div
          id={idMenu}
          role="menu"
          className="absolute right-0 top-full z-30 mt-espaco-2 min-w-[10rem] overflow-hidden rounded-raio-md border border-border bg-panel py-espaco-1"
        >
          <Link
            to="/conta"
            role="menuitem"
            onClick={() => setAberto(false)}
            className={CLASSE_ITEM}
          >
            Conta
          </Link>
          <button type="button" role="menuitem" onClick={aoSair} className={CLASSE_ITEM}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
