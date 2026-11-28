// Convites diretos recebidos pelo socket (evento `convite`), à espera de resposta. Um por
// partida: um convite repetido substitui o anterior.
import type { ConviteDto } from "@warii/shared";
import { create } from "zustand";

interface EstadoConvites {
  pendentes: ConviteDto[];
  receber: (convite: ConviteDto) => void;
  descartar: (partidaId: string) => void;
  limpar: () => void;
}

export const useConvites = create<EstadoConvites>()((set) => ({
  pendentes: [],
  receber: (convite) =>
    set((s) => ({
      pendentes: [...s.pendentes.filter((c) => c.partidaId !== convite.partidaId), convite],
    })),
  descartar: (partidaId) =>
    set((s) => ({ pendentes: s.pendentes.filter((c) => c.partidaId !== partidaId) })),
  limpar: () => set({ pendentes: [] }),
}));
