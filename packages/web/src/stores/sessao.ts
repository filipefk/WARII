// Sessão do usuário logado. A fonte da verdade é o cookie httpOnly (o front não o enxerga):
// ao abrir, pergunta ao servidor quem é (`/api/auth/eu`); qualquer 401 depois volta a "anonimo".
import type { DefinirSenhaEntrada, LoginEntrada, UsuarioDto } from "@warii/shared";
import { create } from "zustand";
import { apiAuth } from "../api/auth";
import { definirAoNaoAutenticado } from "../api/cliente";

export type SituacaoSessao = "carregando" | "anonimo" | "logado";

interface EstadoSessao {
  situacao: SituacaoSessao;
  usuario: UsuarioDto | null;
  carregar: () => Promise<void>;
  entrar: (entrada: LoginEntrada) => Promise<void>;
  definirSenha: (entrada: DefinirSenhaEntrada) => Promise<void>;
  sair: () => Promise<void>;
  sairDeTodas: () => Promise<void>;
  limpar: () => void;
}

export const useSessao = create<EstadoSessao>()((set) => ({
  situacao: "carregando",
  usuario: null,

  async carregar() {
    try {
      const usuario = await apiAuth.eu();
      set({ situacao: "logado", usuario });
    } catch {
      // Sem sessão (401) ou sem servidor: em ambos os casos não há o que mostrar logado.
      set({ situacao: "anonimo", usuario: null });
    }
  },

  async entrar(entrada) {
    const usuario = await apiAuth.login(entrada);
    set({ situacao: "logado", usuario });
  },

  async definirSenha(entrada) {
    const usuario = await apiAuth.definirSenha(entrada);
    set({ situacao: "logado", usuario });
  },

  async sair() {
    try {
      await apiAuth.logout();
    } finally {
      set({ situacao: "anonimo", usuario: null });
    }
  },

  async sairDeTodas() {
    await apiAuth.sairDeTodas();
    set({ situacao: "anonimo", usuario: null });
  },

  limpar() {
    set({ situacao: "anonimo", usuario: null });
  },
}));

definirAoNaoAutenticado(() => useSessao.getState().limpar());
