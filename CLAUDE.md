# CLAUDE.md — War II Online

Projeto web para jogar **War II** (jogo de tabuleiro da Grow) online entre amigos.

## Status

Regras levantadas e protótipo do mapa pronto. **Stack decidida e esqueleto do monorepo criado.** Implementação segue o plano em etapas de `PLANO-WARII-ONLINE.md`: **etapas 1 (fundações de qualidade), 2 (banco e migrations), 3 (dados estáticos do engine), 4 (regras e máquina de estados do engine, com testes), 5 (contas e autenticação, com testes do servidor) e 6 (contrato `shared` e lobby REST) concluídas**; próxima: 7 (servidor de partida em tempo real).

## Stack

Monorepo **TypeScript** com **pnpm workspaces** (Node 24, pnpm 11). Um único repositório, quatro pacotes:

| Pacote | Papel | Principais libs |
|---|---|---|
| `packages/engine` (`@warii/engine`) | Motor de regras: funções puras `(estado, ação, rng) → novo estado + eventos`. Sem rede, banco nem UI; o dado entra como parâmetro | — |
| `packages/shared` (`@warii/shared`) | Contrato servidor ↔ front: eventos do Socket.IO e DTOs | — |
| `packages/server` (`@warii/server`) | API autoritativa: valida ações com o engine, rola os dados, persiste o log de ações, envia a cada jogador só a sua visão | Fastify (REST em `/api`), Socket.IO (`/socket.io`), Drizzle ORM + `pg`, zod (config), tsx (dev), tsup (build) |
| `packages/web` (`@warii/web`) | Front SPA: mapa, interface, pré-visualização com o engine | Vite, React, Tailwind 4, D3 + TopoJSON, Zustand, socket.io-client |

- **Dados do jogo:** `packages/engine/src/data/` é a **fonte única** dos dados de regra (territórios, continentes e bônus, fronteiras, cartas de troca, objetivos, faces dos dados), com ids iguais aos de `Tabuleiro.html`. Só o que as regras usam; a geografia do mapa fica no front. Ids de cartas e objetivos são estáveis (vão para o log das partidas). Ao mexer nos dados, `conferirDados()` (`pnpm conferir`) os confere contra `WARII.md`; o servidor roda a mesma conferência ao iniciar e não sobe se falhar.
- **Regras:** `packages/engine/src/regras/`. Entrada única `aplicarAcao(estado, jogadorId, acao, rng)` → `{ ok, estado, eventos }` ou `{ ok: false, erro: { codigo, mensagem } }`; `criarPartida(jogadores, parametros, rng)` cria a partida. O estado é JSON puro (vai para snapshots) e contém a informação oculta: para os clientes, só `visaoDoJogador()` e `eventosParaJogador()`. A RNG é injetada e consumida em ordem determinística (`gravarRng`/`rngDeReplay` repetem uma partida). Toda regra ⚠ é parâmetro em `parametros.ts`. Testes do engine em `packages/engine/test/` com `node:test` (rodados pelo `tsx --test`, sem dependência nova): `regras.test.ts` confere os exemplos do manual com dados roteirizados, `dados.test.ts` roda `conferirDados()` e `simulacao.test.ts` joga partidas com robôs aleatórios conferindo invariantes, informação oculta e replay. Auxiliares (montagem de estados, robô) em `test/apoio.ts`.
- `engine` e `shared` são consumidos como **código-fonte TS** (`exports` → `src/index.ts`); o tsup embute os dois no bundle do servidor e o Vite no do front.
- **Banco:** PostgreSQL em container separado, preparado pelo usuário. Conexão via `DATABASE_URL` (ver `packages/server/.env-exemplo`). Ao iniciar, o servidor (`src/db/preparar.ts`) cria o database se não existir (usuário precisa de `CREATEDB`) e aplica as migrations de `packages/server/drizzle` sob `pg_advisory_lock`; só então abre a porta. Não existe `db:migrate`: para mudar o banco, editar `src/db/schema.ts` → `pnpm --filter @warii/server db:generate` → reiniciar. Pool único em `src/db/index.ts`; encerramento gracioso em SIGTERM/SIGINT; `/api/health` devolve 503 sem banco.
- **Contas e autenticação** (`packages/server/src/auth/`): **sem cadastro público** — o administrador cria contas pela CLI (`src/cli.ts`: `pnpm --filter @warii/server cli conta:criar|senha:link|contas:listar`; em produção `node dist/cli.js`), que imprime um link de uso único (`URL_PUBLICA/definir-senha#token=…`, token no fragmento) para o próprio usuário definir a senha; recuperação de senha igual, sem e-mail. Tabelas `usuarios`, `sessoes`, `tokens_senha`. Senha Argon2id via `node:crypto` (formato PHC, `senha.ts`); tokens opacos com só o HMAC-SHA256(`SESSION_SECRET`) no banco (`tokens.ts`); sessão de 30 dias deslizante (`sessoes.ts`; `sessaoPorToken` é a porta única, a reutilizar no handshake do Socket.IO na etapa 7). Rotas `/api/auth/*` em `rotas.ts`, com DTOs/zod em `@warii/shared` (`shared/src/auth.ts`); `exigirSessao`/`sessaoDa` em `plugin.ts`, que também recusa métodos não-GET com `Origin` ≠ `URL_PUBLICA`. Rate limit por rota (`@fastify/rate-limit`) e atraso progressivo/bloqueio por e-mail+IP em memória (`tentativas.ts`). Erros da API sempre `{ codigo, mensagem }` (`src/erros.ts`).
- **Contrato** (`packages/shared/src/`): `shared` depende do `engine` (ids de territórios, cartas e cores). `acoes.ts` tem `esquemaAcao` (formato das ações do socket; conferências em tempo de compilação o mantêm igual ao `Acao` do engine — ao mudar uma ação no engine, mudar aqui), `parametros.ts` o `esquemaParametros` (a validade das regras continua em `validarParametros()` do engine), `partidas.ts` as entradas/DTOs do lobby e `socket.ts` os eventos do Socket.IO.
- **Lobby e partidas** (`packages/server/src/partidas/`, rotas `/api/partidas`): criar, `POST /entrar {token}`, cor, parâmetros, renovar convite, sair, remover, cancelar e iniciar; só o anfitrião configura/remove/cancela/inicia (403 `SOMENTE_ANFITRIAO`), quem não participa recebe 404, fora de `aguardando` → 409. Operações em transação com a linha da partida travada (`FOR UPDATE`); recusas por `ErroDeLobby`. Convite: token em claro em `partidas.convite` (link `URL_PUBLICA/convite#token=…`), reutilizável até iniciar/cancelar, só o anfitrião o vê. Máximo de 5 partidas `aguardando` por anfitrião. Partidas não são apagadas (só canceladas). Ao iniciar, `montarPartida()` (`inicio.ts`) sorteia os assentos e chama `criarPartida` com `gravarRng(rngCrypto())`; grava `acoes_partida` seq 0 (`tipo: "criarPartida"`, participantes na ordem de entrada + parâmetros + sorteios) e `snapshots` seq 0; `partidas.seq` guarda a última ação (-1 antes de iniciar). `acoes_partida` é só de inclusão (trigger da migration 0003). O `JogadorId` do engine é o id do usuário.
- **Deploy (Dokploy):** um projeto com duas aplicações apontando para o mesmo repositório, ambas com **context na raiz**: `packages/server/Dockerfile` (Node) e `packages/web/Dockerfile` (build Vite + Nginx). Domínio único com roteamento por path: `/` → web; `/api` e `/socket.io` → server. Em dev, o Vite faz proxy desses paths para `localhost:3000`.
- Comandos na raiz: `pnpm dev` (server + web), `pnpm typecheck`, `pnpm conferir`, `pnpm test` (testes rápidos do engine e do servidor), `pnpm test:simulacao` (partidas simuladas, ~20 s; `$env:PARTIDAS=N` muda a quantidade, padrão 40), `pnpm lint` (`lint:fix`), `pnpm format` (`format:check`). **Testes automatizados no engine e no servidor** (desde a etapa 5), rodados à mão (sem CI); o front é verificado rodando a aplicação. Testes do servidor em `packages/server/test/` (`node:test` + `app.inject`, montando o app por `criarApp()` de `src/app.ts`): unitários (senha, tokens, tentativas, schemas de auth e do contrato do jogo) e de integração das rotas (`auth.test.ts`, `lobby.test.ts`) contra um banco de teste — `DATABASE_URL_TESTE` ou o `DATABASE_URL` do `.env` com sufixo `_teste`, criado/migrado sozinho e **apagado a cada teste**; sem banco, a integração é pulada. `test/ambiente.ts` define o ambiente e precisa ser o primeiro import de cada `*.test.ts`; auxiliares em `test/apoio.ts`. Arquivos rodam em série (`--test-concurrency=1`) por compartilharem o banco. Nos `*.test.ts` o lint desliga `no-floating-promises` (o `describe`/`test` do `node:test` devolvem Promise).
- **Lint com Oxlint** (`.oxlintrc.json`, com regras que usam tipos via `oxlint-tsgolint`), e não ESLint: o typescript-eslint ainda não suporta o TypeScript 7 nativo. Formatação com Prettier (`.prettierrc.json`; os `.md` e o `Tabuleiro.html` ficam de fora).
- **Configuração do servidor** validada com zod em `packages/server/src/config.ts`: o código lê de `config`, nunca de `process.env` direto. O logger (`src/logger.ts`) oculta cookie, authorization, senha, token e segredo.
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
