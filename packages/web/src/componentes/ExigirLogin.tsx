// Rota-pai das telas que pedem login. Sem sessão, manda para /entrar guardando onde o usuário
// estava (caminho e fragmento, no `state` da navegação — o token do convite nunca vai para a URL
// de outra página nem para a query string).
import { Navigate, Outlet, useLocation, type Location } from "react-router";
import { useSessao } from "../stores/sessao";
import { Carregando } from "./basicos";

export interface EstadoVolta {
  de?: Pick<Location, "pathname" | "search" | "hash">;
}

export function ExigirLogin() {
  const situacao = useSessao((s) => s.situacao);
  const local = useLocation();

  if (situacao === "carregando") return <Carregando />;
  if (situacao === "anonimo") {
    const estado: EstadoVolta = {
      de: { pathname: local.pathname, search: local.search, hash: local.hash },
    };
    return <Navigate to="/entrar" replace state={estado} />;
  }
  return <Outlet />;
}
