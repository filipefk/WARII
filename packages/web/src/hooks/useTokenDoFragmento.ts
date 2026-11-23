// Lê o token dos links de uso único (`…#token=…`) e o tira da barra de endereço logo ao montar:
// ele fica só na memória da página (nunca em query string, histórico ou armazenamento local).
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

function tokenDe(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token");
}

export function useTokenDoFragmento(): string | null {
  const local = useLocation();
  const navegar = useNavigate();
  // O inicializador roda uma vez por montagem; o StrictMode preserva o estado ao remontar.
  const [token] = useState(() => tokenDe(local.hash));

  useEffect(() => {
    if (local.hash) {
      void navegar({ pathname: local.pathname, search: local.search }, { replace: true });
    }
  }, [local.hash, local.pathname, local.search, navegar]);

  return token;
}
