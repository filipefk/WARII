// Rotas da SPA. O Nginx (produção) e o Vite (dev) devolvem o index.html para qualquer caminho.
import { createBrowserRouter, Navigate } from "react-router";
import { ExigirLogin } from "./componentes/ExigirLogin";
import { Layout } from "./componentes/Layout";
import { Conta } from "./paginas/Conta";
import { Convite } from "./paginas/Convite";
import { DefinirSenha } from "./paginas/DefinirSenha";
import { Entrar } from "./paginas/Entrar";
import { NaoEncontrada } from "./paginas/NaoEncontrada";
import { Partida } from "./paginas/Partida";
import { Partidas } from "./paginas/Partidas";
import { VitrineDev } from "./paginas/VitrineDev";

export const roteador = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/partidas" replace /> },
      { path: "entrar", element: <Entrar /> },
      { path: "definir-senha", element: <DefinirSenha /> },
      ...(import.meta.env.DEV ? [{ path: "dev/vitrine", element: <VitrineDev /> }] : []),
      {
        element: <ExigirLogin />,
        children: [
          { path: "convite", element: <Convite /> },
          { path: "partidas", element: <Partidas /> },
          { path: "partidas/:id", element: <Partida /> },
          { path: "conta", element: <Conta /> },
        ],
      },
      { path: "*", element: <NaoEncontrada /> },
    ],
  },
]);
