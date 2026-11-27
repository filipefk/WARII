// Moldura das telas de administração: título e abas (Usuários, Partidas, Log), mais peças comuns.
import { NavLink, Outlet } from "react-router";
import { TituloDaTela } from "../../componentes/basicos";

const classeAba = ({ isActive }: { isActive: boolean }) => `botao ${isActive ? "ativo" : ""}`;

export function Admin() {
  return (
    <div className="space-y-espaco-8">
      <div className="flex flex-wrap items-end justify-between gap-espaco-5">
        <TituloDaTela
          titulo="Administração"
          apoio="Contas dos jogadores, todas as partidas e o log de cada jogador."
        />
        <nav className="flex gap-espaco-2" aria-label="Administração">
          <NavLink to="/admin/usuarios" className={classeAba}>
            Usuários
          </NavLink>
          <NavLink to="/admin/partidas" className={classeAba}>
            Partidas
          </NavLink>
          <NavLink to="/admin/log" className={classeAba}>
            Log
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

export const formatoData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
