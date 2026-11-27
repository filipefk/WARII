// Rotas da SPA. O Nginx (produção) e o Vite (dev) devolvem o index.html para qualquer caminho.
import { createBrowserRouter, Navigate } from "react-router";
import { ExigirAdmin } from "./componentes/ExigirAdmin";
import { ExigirLogin } from "./componentes/ExigirLogin";
import { Layout } from "./componentes/Layout";
import { Admin } from "./paginas/admin/Admin";
import { AdminLog } from "./paginas/admin/AdminLog";
import { AdminPartidas } from "./paginas/admin/AdminPartidas";
import { AdminUsuarios } from "./paginas/admin/AdminUsuarios";
import { Conta } from "./paginas/Conta";
import { Convite } from "./paginas/Convite";
import { DefinirSenha } from "./paginas/DefinirSenha";
import { Entrar } from "./paginas/Entrar";
import { NaoEncontrada } from "./paginas/NaoEncontrada";
import { Partida } from "./paginas/Partida";
import { Partidas } from "./paginas/Partidas";
import { TabuleiroLivre } from "./paginas/TabuleiroLivre";

export const roteador = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/partidas" replace /> },
      { path: "entrar", element: <Entrar /> },
      { path: "definir-senha", element: <DefinirSenha /> },
      {
        element: <ExigirLogin />,
        children: [
          { path: "convite", element: <Convite /> },
          { path: "partidas", element: <Partidas /> },
          { path: "partidas/:id", element: <Partida /> },
          { path: "tabuleiro", element: <TabuleiroLivre /> },
          { path: "conta", element: <Conta /> },
          {
            element: <ExigirAdmin />,
            children: [
              {
                path: "admin",
                element: <Admin />,
                children: [
                  { index: true, element: <Navigate to="/admin/usuarios" replace /> },
                  { path: "usuarios", element: <AdminUsuarios /> },
                  { path: "partidas", element: <AdminPartidas /> },
                  { path: "log", element: <AdminLog /> },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <NaoEncontrada /> },
    ],
  },
]);
