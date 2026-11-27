// Carrega a geografia do mapa (chunk próprio) para uma tela.
import { useEffect, useState } from "react";
import { carregarGeografia, type Geografia } from "./geografia";

export function useGeografia(): { geografia: Geografia | null; erro: string | null } {
  const [geografia, setGeografia] = useState<Geografia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    carregarGeografia()
      .then((g) => ativo && setGeografia(g))
      .catch(() => ativo && setErro("Não foi possível carregar o mapa. Recarregue a página."));
    return () => {
      ativo = false;
    };
  }, []);
  return { geografia, erro };
}
