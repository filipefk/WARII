// Rota-pai das telas de administração (dentro de ExigirLogin). Quem não é administrador vê
// "página não encontrada"; o servidor também recusa as rotas /api/admin (403).
import { Outlet } from "react-router";
import { NaoEncontrada } from "../paginas/NaoEncontrada";
import { useSessao } from "../stores/sessao";

export function ExigirAdmin() {
  const admin = useSessao((s) => s.usuario?.admin === true);
  return admin ? <Outlet /> : <NaoEncontrada />;
}
