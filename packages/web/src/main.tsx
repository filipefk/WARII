import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { roteador } from "./rotas";
import { iniciarTempoReal } from "./socket";
import { useSessao } from "./stores/sessao";
import "./index.css";

// Liga o socket conforme a sessão e pergunta ao servidor quem está logado (cookie httpOnly).
iniciarTempoReal();
void useSessao.getState().carregar();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={roteador} />
  </StrictMode>,
);
