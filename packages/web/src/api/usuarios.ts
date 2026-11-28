// Rotas /api/usuarios.
import type { UsuarioResumoDto } from "@warii/shared";
import { requisitar } from "./cliente";

export const apiUsuarios = {
  online: () => requisitar<UsuarioResumoDto[]>("GET", "/usuarios/online"),
};
