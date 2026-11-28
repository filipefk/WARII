// Avisos de que o administrador encerrou ou apagou uma partida que o jogador acompanhava (eventos
// `encerrada` e `apagada` do socket). Ficam numa fila global porque a tela sai da partida.
import { create } from "zustand";

export type AvisoDoAdmin = { partidaId: string; tipo: "encerrada" | "apagada" };

interface EstadoAvisosDoAdmin {
  pendentes: AvisoDoAdmin[];
  receber: (aviso: AvisoDoAdmin) => void;
  descartar: () => void;
  limpar: () => void;
}

export const useAvisosDoAdmin = create<EstadoAvisosDoAdmin>()((set) => ({
  pendentes: [],
  // Um por partida: apagar depois de encerrar fica só com o último.
  receber: (aviso) =>
    set((s) => ({
      pendentes: [...s.pendentes.filter((a) => a.partidaId !== aviso.partidaId), aviso],
    })),
  descartar: () => set((s) => ({ pendentes: s.pendentes.slice(1) })),
  limpar: () => set({ pendentes: [] }),
}));
