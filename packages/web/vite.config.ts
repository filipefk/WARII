import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Uma só cópia do React: sem isso, o pré-empacotamento do Vite embutia outra dentro do
  // react-router (os links do pnpm no Windows apareciam como caminhos diferentes) e a tela
  // ficava em branco com "Invalid hook call".
  resolve: { dedupe: ["react", "react-dom"] },
  server: {
    port: 5173,
    // Abre o navegador padrão na URL do front ao rodar `pnpm dev`.
    open: true,
    // Em desenvolvimento, a API e o WebSocket rodam em outro processo (packages/server).
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});
