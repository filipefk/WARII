// Situação da conexão em tempo real (Socket.IO), para o indicador do cabeçalho.
import type { ErroApi } from "@warii/shared";
import { create } from "zustand";

export type SituacaoConexao = "desligada" | "conectando" | "conectada" | "reconectando";

interface EstadoConexao {
  situacao: SituacaoConexao;
  // Último erro avulso enviado pelo servidor (evento `erro`), para um aviso no cabeçalho.
  ultimoErro: ErroApi | null;
  definir: (situacao: SituacaoConexao) => void;
  avisar: (erro: ErroApi | null) => void;
}

export const useConexao = create<EstadoConexao>()((set) => ({
  situacao: "desligada",
  ultimoErro: null,
  definir: (situacao) => set({ situacao }),
  avisar: (ultimoErro) => set({ ultimoErro }),
}));
