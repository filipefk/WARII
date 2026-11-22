# CLAUDE.md — War II Online

Projeto web para jogar **War II** (jogo de tabuleiro da Grow) online entre amigos.

## Status

Regras levantadas e protótipo do mapa pronto. **Stack decidida e esqueleto do monorepo criado**; o plano de implementação ainda vai ser montado junto com o usuário.

## Stack

Monorepo **TypeScript** com **pnpm workspaces** (Node 24, pnpm 11). Um único repositório, quatro pacotes:

| Pacote | Papel | Principais libs |
|---|---|---|
| `packages/engine` (`@warii/engine`) | Motor de regras: funções puras `(estado, ação, rng) → novo estado + eventos`. Sem rede, banco nem UI; o dado entra como parâmetro | — (testes com Vitest) |
| `packages/shared` (`@warii/shared`) | Contrato servidor ↔ front: eventos do Socket.IO e DTOs | — |
| `packages/server` (`@warii/server`) | API autoritativa: valida ações com o engine, rola os dados, persiste o log de ações, envia a cada jogador só a sua visão | Fastify (REST em `/api`), Socket.IO (`/socket.io`), Drizzle ORM + `pg`, tsx (dev), tsup (build) |
| `packages/web` (`@warii/web`) | Front SPA: mapa, interface, pré-visualização com o engine | Vite, React, Tailwind 4, D3 + TopoJSON, Zustand, socket.io-client |

- `engine` e `shared` são consumidos como **código-fonte TS** (`exports` → `src/index.ts`); o tsup embute os dois no bundle do servidor e o Vite no do front.
- **Banco:** PostgreSQL em container separado, preparado pelo usuário. Conexão via `DATABASE_URL` (ver `packages/server/.env.example`).
- **Deploy (Dokploy):** um projeto com duas aplicações apontando para o mesmo repositório, ambas com **context na raiz**: `packages/server/Dockerfile` (Node) e `packages/web/Dockerfile` (build Vite + Nginx). Domínio único com roteamento por path: `/` → web; `/api` e `/socket.io` → server. Em dev, o Vite faz proxy desses paths para `localhost:3000`.
- Comandos na raiz: `pnpm dev` (server + web), `pnpm test`, `pnpm typecheck`.
- Scripts de build de dependências precisam ser liberados em `allowBuilds` no `pnpm-workspace.yaml` (pnpm 11).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `WARII.md` | **Especificação de regras** (fonte de verdade para implementar). Inclui mapa, preparação, turno, combate, cartas, objetivos, variante CI, modelo de dados sugerido e parâmetros configuráveis |
| `Tabuleiro.html` | Protótipo do mapa (D3 + TopoJSON): territórios, continentes, bônus e **centros estratégicos corretos** (`sc: true`). Bases aéreas com 10 vagas de avião (símbolo do caça delta), preenchidas na cor do jogador conforme os aviões na base. Botão "Ver cartas e dados do jogo" abre a galeria das 61 cartas de troca (desenhadas em SVG com a silhueta dos territórios do próprio mapa), das 20 cartas-objetivo (HTML/CSS) e das faces dos 8 dados (SVG). Botão "Regras do jogo" abre um guia didático (resumo de `WARII.md`) com ilustrações, exemplos do manual, calculadora de reforços e simuladores de ataque terrestre e aéreo |
| `packages/` | Código do jogo (ver "Stack") |

**Publicação:** uma cópia de `Tabuleiro.html` é servida na rota `/warii` do site em `D:\Fontes\Site do Boca` (arquivo `public/warii/tabuleiro.html`, exibido em tela cheia por `src/routes/warii.tsx`) — é a prévia publicada para os amigos verem.

## Decisões de regras

- Onde manual e vídeo divergem, vale o **vídeo** para: escolha com 5 jogadores (§4.3), ataque aéreo — soma base + caixa, pode interromper entre ciclos, sobreviventes voltam à base, dado antiaéreo com faces `[0,0,0,1,1,2]` (§7.3) — e mudança automática de objetivo para "24 territórios" (§10.2). Nos demais pontos vale o **manual**.
- Regras divergentes ou incertas (itens **⚠ A CONFIRMAR** em `WARII.md`) devem virar **parâmetros configuráveis** da partida, nunca valores fixos no código. Ver tabela em `WARII.md` §13.4.
- Variante **Centro de Informações** é módulo opcional, desligado por padrão.

## Princípios para a implementação

- **Servidor autoritativo**: toda validação de regra e todos os dados rolados no servidor, com log auditável da partida.
- **Informação oculta**: objetivo e cartas de um jogador nunca são enviados aos clientes dos outros (exceto ao captor de um CI, na variante).
- Mapa modelado como **grafo não direcionado** de adjacências; CEs formam uma rede à parte para aerotransporte.
- Jogo multiplayer por turnos entre amigos (3 a 6 jogadores).

## Convenções

- Documentação, textos da interface e comentários em **Português do Brasil**.
- Ao alterar regras, atualizar `WARII.md` (fonte de verdade) e manter as marcações 📘 MANUAL × VÍDEO e ⚠ A CONFIRMAR.

## Sincronização obrigatória

- **`WARII.md` ↔ `Tabuleiro.html`**: toda alteração de regra em `WARII.md` deve ser refletida nas mesmas regras em `Tabuleiro.html` (guia "Regras do jogo", calculadora, simuladores, cartas etc.) e vice-versa.
- **`Tabuleiro.html` → site**: toda alteração em `Tabuleiro.html` deve ser replicada (cópia do arquivo) para `D:\Fontes\Site do Boca\public\warii\tabuleiro.html`.

## Propriedade intelectual

"War" e "War II" são marcas da Grow; mapa, arte e textos das cartas são protegidos. O uso é privado entre amigos; se um dia for publicado, trocar nome, arte e textos por versões próprias mantendo as mecânicas.
