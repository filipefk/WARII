# War II Online

Projeto web para jogar **War II** (jogo de tabuleiro da Grow) online entre amigos, de 3 a 6 jogadores, em turnos.

> **Status:** regras levantadas, protótipo do mapa pronto e esqueleto do monorepo criado. A implementação do jogo ainda está começando.

## Conteúdo do repositório

| Caminho | O que é |
|---|---|
| [`WARII.md`](WARII.md) | Especificação das regras — fonte de verdade para a implementação (mapa, preparação, turno, combate, cartas, objetivos, variante Centro de Informações, modelo de dados e parâmetros configuráveis) |
| [`Tabuleiro.html`](Tabuleiro.html) | Protótipo do mapa (D3 + TopoJSON) com territórios, continentes, centros estratégicos e bases aéreas; inclui galeria de cartas e dados e um guia de regras com calculadora de reforços e simuladores de ataque. Basta abrir no navegador |
| [`packages/`](packages) | Código do jogo (monorepo, ver abaixo) |

## Protótipo

**Tabuleiro** — os 43 territórios sobre a geografia real, com continentes, centros estratégicos, rotas marítimas e bases aéreas:

![Tabuleiro](docs/img/tabuleiro.webp)

**Regras do jogo** — guia didático com ilustrações, calculadora de reforços e simuladores de ataque:

![Guia de regras](docs/img/regras.png)

**Cartas** — as 61 cartas de troca, desenhadas com a silhueta dos territórios do próprio mapa, e as 20 cartas-objetivo:

![Cartas de troca](docs/img/cartas.png)

**Dados** — as faces dos 8 dados (ataque e defesa terrestres, ataque aéreo e defesa antiaérea):

![Dados](docs/img/dados.png)

## Arquitetura

Monorepo **TypeScript** com **pnpm workspaces**:

| Pacote | Papel | Principais libs |
|---|---|---|
| `packages/engine` (`@warii/engine`) | Motor de regras com funções puras `(estado, ação, rng) → novo estado + eventos`. Sem rede, banco nem UI | — |
| `packages/shared` (`@warii/shared`) | Contrato servidor ↔ front: eventos do Socket.IO e DTOs | — |
| `packages/server` (`@warii/server`) | API autoritativa: valida ações com o engine, rola os dados, persiste o log da partida e envia a cada jogador só a sua visão | Fastify, Socket.IO, Drizzle ORM + `pg` |
| `packages/web` (`@warii/web`) | Front SPA: mapa, interface e pré-visualização das jogadas com o engine | Vite, React, Tailwind 4, D3 + TopoJSON, Zustand |

Princípios:

- **Servidor autoritativo** — toda validação de regra e todos os dados rolados no servidor, com log auditável.
- **Informação oculta** — objetivo e cartas de um jogador nunca chegam aos clientes dos outros.
- **Regras configuráveis** — pontos divergentes ou incertos das regras viram parâmetros da partida (ver `WARII.md` §13.4).

## Requisitos

- Node.js **24+**
- pnpm **11** (`corepack enable` ativa a versão definida no `package.json`)
- PostgreSQL acessível pelo servidor

## Como rodar em desenvolvimento

```powershell
pnpm install
```

Copie o arquivo de exemplo e ajuste `DATABASE_URL` e `SESSION_SECRET`. O servidor valida as variáveis ao iniciar e não sobe se alguma estiver faltando ou inválida, nem com o segredo do exemplo:

```powershell
Copy-Item packages/server/.env-exemplo packages/server/.env
```

Não é preciso preparar o banco à mão: ao iniciar, o servidor cria o database de `DATABASE_URL` se ele não existir (o usuário precisa da permissão `CREATEDB`) e aplica as migrações pendentes, sob uma trava para duas instâncias não migrarem juntas. Só depois disso ele abre a porta.

Suba servidor e front juntos:

```powershell
pnpm dev
```

O servidor escuta em `http://localhost:3000` (REST em `/api`, Socket.IO em `/socket.io`) e o Vite faz proxy desses caminhos para o front.

## Scripts

| Comando (na raiz) | O que faz |
|---|---|
| `pnpm dev` | Servidor e front em modo watch |
| `pnpm lint` | Lint com Oxlint, incluindo regras com tipos (`pnpm lint:fix` corrige o que der) |
| `pnpm format` | Formata o código com Prettier (`pnpm format:check` só confere) |
| `pnpm typecheck` | Checagem de tipos em todos os pacotes |
| `pnpm conferir` | Confere os dados estáticos do engine (mapa, fronteiras, cartas, objetivos, dados) contra `WARII.md`; o servidor faz a mesma conferência ao iniciar e não sobe se algo estiver errado |
| `pnpm build` | Build de produção de todos os pacotes |

No servidor também há `db:generate` e `db:studio` (Drizzle Kit), executados com `pnpm --filter @warii/server <script>`. Para mudar o banco: edite `packages/server/src/db/schema.ts`, rode `db:generate` e reinicie o servidor, que aplica a nova migração sozinho.

`GET /api/health` responde `200` com o banco no ar e `503` quando ele não responde.

## Deploy

Pensado para o **Dokploy**: um projeto com duas aplicações apontando para este repositório, ambas com *build context* na raiz:

- `packages/server/Dockerfile` — servidor Node
- `packages/web/Dockerfile` — build do Vite servido pelo Nginx

Domínio único com roteamento por caminho: `/` → web; `/api` e `/socket.io` → server. O PostgreSQL roda em container separado, e a conexão é feita pela variável `DATABASE_URL`.

## Propriedade intelectual

"War" e "War II" são marcas da Grow; mapa, arte e textos das cartas são protegidos. Este projeto é de uso privado entre amigos. Se um dia for publicado, nome, arte e textos devem ser trocados por versões próprias, mantendo apenas as mecânicas.
