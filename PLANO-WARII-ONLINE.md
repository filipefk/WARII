# Plano macro — War II Online

## Contexto

O monorepo já existe (`engine`, `shared`, `server`, `web`), mas só como esqueleto: o servidor tem `/api/health` e um Socket.IO de boas-vindas, `db/schema.ts` está vazio e o engine não tem nenhuma regra. As regras estão especificadas em `WARII.md` (§13 já sugere modelo de dados, máquina de estados e parâmetros) e o mapa/cartas/objetivos estão prototipados em `Tabuleiro.html`.

Este plano define **as etapas e a ordem**. Cada etapa será detalhada depois, em um plano próprio.

**Decisões tomadas:**
- PostgreSQL; ao iniciar, a API **cria o database se não existir** e **roda as migrations sozinha**.
- Login com **e-mail e senha** (contas próprias).
- Partidas **ao vivo, com reconexão** e retomada (estado salvo no banco); sem modo assíncrono por enquanto.
- **Sem GitHub Actions.** Testes automatizados no engine e, a partir da etapa 5, no servidor (`node:test`, rodados à mão com `pnpm test` e `pnpm test:simulacao`); o front é verificado rodando a aplicação.
- Boas práticas de programação e segurança em todas as etapas (ver seção final).

---

## Etapas (em ordem)

### Etapa 1 — Fundações de qualidade ✅ CONCLUÍDA (2026-11-23)
- TypeScript `strict` em todos os pacotes; Oxlint (com regras que usam tipos) + Prettier, com scripts `pnpm lint` / `pnpm format` na raiz. ESLint descartado: o typescript-eslint ainda não suporta o TypeScript 7.
- Validação de configuração no início do servidor (`zod` sobre `process.env`): falha rápida se faltar `DATABASE_URL`, segredo de sessão etc.
- Logger estruturado (pino do Fastify) com redação de campos sensíveis (senha, cookie, token).
- Remover o Vitest e os scripts `test` do esqueleto.
- **Pronto quando:** `pnpm lint` e `pnpm typecheck` passam na raiz.
- **Entregue:** `.oxlintrc.json`, `.prettierrc.json`/`.prettierignore`, `packages/server/src/config.ts` (zod; recusa o segredo do exemplo), `packages/server/src/logger.ts` (redação com `[oculto]`, pino-pretty em dev), `packages/server/.env-exemplo` (substitui o `.env.example`) e abertura automática do navegador no `pnpm dev`. Verificação manual feita.

### Etapa 2 — Banco de dados e migrations automáticas ✅ CONCLUÍDA (2026-11-23)
- Rotina de bootstrap em `packages/server/src/db/`:
  1. Conecta no banco de manutenção (`postgres`) com as credenciais de `DATABASE_URL`, consulta `pg_database` e executa `CREATE DATABASE` (nome validado e citado como identificador) se não existir.
  2. Obtém um `pg_advisory_lock` para que duas instâncias não migrem ao mesmo tempo.
  3. Roda `migrate()` do `drizzle-orm/node-postgres/migrator` sobre a pasta de migrations gerada pelo `drizzle-kit generate`.
  4. Só então o Fastify começa a escutar a porta.
- Pool de conexões único, encerramento gracioso (SIGTERM) e `/api/health` checando o banco.
- Dockerfile do server passa a copiar a pasta de migrations para a imagem.
- Schema inicial apenas de infraestrutura (o das partidas entra nas etapas 5–6).
- **Pronto quando:** subir a API contra um Postgres vazio cria o database e as tabelas; subir de novo não faz nada.
- **Entregue:** `packages/server/src/db/preparar.ts` (cria o database com espera de até ~30 s pelo Postgres, trava consultiva e `migrate()`), `src/db/index.ts` (pool único e `bancoResponde()`), `src/index.ts` (bootstrap antes do `listen`, health com 503, encerramento gracioso), migration `drizzle/0000_inicial.sql` (extensão `citext`, para o e-mail na etapa 5), script `db:migrate` removido e checagem das migrations no Dockerfile. Verificação manual feita.

### Etapa 3 — Engine: dados estáticos do jogo ✅ CONCLUÍDA (2026-11-23)
- Extrair de `Tabuleiro.html` para `packages/engine/src/data/`: territórios, continentes, adjacências (grafo não direcionado), CEs e sua rede de aerotransporte, as 61 cartas de troca, as 20 cartas-objetivo, faces dos dados e tabela de bônus (§6.2).
- Conferência dos dados contra `WARII.md` (simetria das adjacências, contagem por continente, CEs, baralho completo).
- **Pronto quando:** os dados do engine são a fonte única e batem com `WARII.md`.
- **Entregue:** `packages/engine/src/data/` com `cores.ts`, `continentes.ts` (bônus padrão), `territorios.ts` (43, ids do `Tabuleiro.html`, tipo `TerritorioId`), `fronteiras.ts` (81 ligações, `vizinhos()`/`saoVizinhos()`), `cartas.ts` (61 cartas com ids estáveis), `objetivos.ts` (20 objetivos como lista de requisitos, mais os substitutos de §10.2), `dados.ts` (faces padrão) e `conferir.ts` (`conferirDados()`). Script `pnpm conferir` e conferência no boot do servidor. A geografia do mapa ficou fora do engine (vai para o `web` na etapa 9); os parâmetros de §13.4 entram na etapa 4.1. Verificação manual feita.

### Etapa 4 — Engine: regras e máquina de estados ✅ CONCLUÍDA (2026-11-23)
Funções puras `(estado, ação, rng) → { estado, eventos }`, seguindo a máquina de §13.2. Subetapas:
1. Tipos do estado, ações, eventos e **parâmetros configuráveis** (§13.4) com valores padrão.
2. Preparação: cores, distribuidor, CEs, caso de 5 jogadores, ocupação, objetivos, primeiro jogador, 1ª rodada especial.
3. Recebimento de exércitos e bombardeiros (§6).
4. Ataque terrestre e conquista (§7.1–7.2).
5. Ataque aéreo com ciclos, dado antiaéreo e interrupção (§7.3).
6. Deslocamento terrestre, aerotransporte e regra de movimento único (§8).
7. Cartas: compra, uso, descarte e reembaralho (§9).
8. Objetivos, mudanças automáticas, vitória e eliminação (§10–11).
9. **Projeção da visão por jogador** (`visaoDoJogador(estado, jogadorId)`), que remove objetivos e cartas alheios.
- RNG injetado como interface (o servidor fornece o seu).
- **Pronto quando:** todas as fases do turno estão implementadas e conferidas com os exemplos do manual.
- **Entregue:** `packages/engine/src/regras/` com `parametros.ts` (§13.4 mais os ⚠ desta etapa), `estado.ts` (estado serializável em JSON), `acoes.ts`, `eventos.ts`, `rng.ts` (`Rng`, `rolar`, `embaralhar`, `gravarRng`/`rngDeReplay` para o log, `rngComSemente`/`rngRoteirizado` para os cenários), `resultado.ts` (recusa com código estável, sem exceção para fora), `consultas.ts` (`calcularRecebimento`, `exercitosMoviveis` etc.), `criar.ts` (`criarPartida`), `aplicar.ts` (`aplicarAcao`) e um módulo por fase (preparação, turno, recebimento, ataques, deslocamento, cartas, objetivos, eliminação) e `visao.ts` (`visaoDoJogador`, `eventosParaJogador`). Testes em `packages/engine/test/` com `node:test`: `pnpm test` (exemplos do manual com dados roteirizados e conferência dos dados) e `pnpm test:simulacao` (partidas simuladas com robôs: invariantes, informação oculta e replay). `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm test:simulacao` passam (2026-11-23).

### Etapa 5 — Contas e autenticação ✅ CONCLUÍDA (2026-11-23)
- Tabelas `usuarios` e `sessoes` (Drizzle + migration).
- ~~Cadastro~~ (decisão: só o administrador cria contas, pela CLI), login, logout, "quem sou eu"; senha com **Argon2id**; sessão opaca em cookie `httpOnly`, `Secure`, `SameSite=Lax`, guardada (hash) no banco, com expiração e revogação.
- Rate limit e atraso progressivo no login; mensagens de erro que não revelam se o e-mail existe.
- Recuperação de senha: definir na etapa (depende de ter envio de e-mail). **Decidido:** sem e-mail; a CLI gera um link de uso único que o administrador envia ao amigo.
- **Pronto quando:** rotas `/api/auth/*` funcionam e as sessões aparecem/expiram corretamente no banco.
- **Entregue:** migration `drizzle/0001_contas.sql` (`usuarios`, `sessoes`, `tokens_senha`); `packages/server/src/auth/` com `senha.ts` (Argon2id do `node:crypto`, formato PHC), `tokens.ts` (HMAC com `SESSION_SECRET`), `sessoes.ts` (30 dias deslizantes, revogação, limpeza a cada 6 h), `contas.ts`, `tentativas.ts` (atraso progressivo e bloqueio), `plugin.ts` (cookie, rate limit, checagem de Origin, `exigirSessao`) e `rotas.ts` (`/login`, `/logout`, `/eu`, `/senha/definir`, `PUT /senha`, `/sair-de-todas`); `src/cli.ts` (`conta:criar`, `senha:link`, `contas:listar`); `src/erros.ts` (erros `{ codigo, mensagem }`); DTOs em `packages/shared/src/auth.ts`; config `URL_PUBLICA` e `TRUST_PROXY`. Montagem do app em `src/app.ts` (`criarApp`) e testes em `packages/server/test/`: unitários (senha, tokens, tentativas, schemas) e integração das rotas com banco de teste (`auth.test.ts`), rodados por `pnpm test` junto com os do engine. `pnpm lint` sem avisos; verificação manual feita pelo usuário.

### Etapa 6 — Contrato `shared` e lobby (REST) ✅ CONCLUÍDA (2026-11-23)
- Em `@warii/shared`: schemas `zod` das ações do jogo, DTOs da API e tipos dos eventos do Socket.IO (validação no servidor, tipos no front).
- Tabelas `partidas`, `participantes`, `acoes_partida` (log append-only) e `snapshots`.
- Lobby: criar partida, link de convite (token aleatório), entrar, escolher cor, configurar parâmetros da partida, iniciar. Autorização por partida (só o anfitrião configura/inicia).
- **Pronto quando:** dois usuários conseguem criar, entrar e iniciar uma partida via API (na prática três: o engine exige 3 a 6 jogadores).
- **Decidido:** ordem da mesa sorteada ao iniciar (RNG crypto, no log); convite reutilizável, válido até iniciar, renovável pelo anfitrião; iniciar já cria o estado no engine.
- **Entregue:** `@warii/shared` passa a depender do engine, com `acoes.ts` (`esquemaAcao`, conferido em tempo de compilação contra `Acao`), `parametros.ts` (`esquemaParametros`/`esquemaParametrosParciais`), `partidas.ts` (entradas e DTOs do lobby) e `socket.ts` (eventos da etapa 7). Migrations `0002_partidas.sql` (`partidas`, `participantes`, `acoes_partida`, `snapshots`) e `0003_log_append_only.sql` (trigger que recusa UPDATE/DELETE no log). `packages/server/src/partidas/`: `rng.ts` (`rngCrypto`), `inicio.ts` (`montarPartida`: sorteio dos assentos + `criarPartida`, usado também no replay), `lobby.ts` (operações em transação com `FOR UPDATE`, `ErroDeLobby`) e `rotas.ts` (`/api/partidas`). Testes `contrato.test.ts` e `lobby.test.ts`. `pnpm typecheck`, `pnpm lint` (sem avisos) e `pnpm test` passam; verificação feita pelo usuário.

### Etapa 7 — Servidor de partida em tempo real ✅ CONCLUÍDA (2026-11-23)
- Socket.IO autenticado pelo mesmo cookie de sessão; cada partida é uma sala.
- Fluxo de uma ação: validar payload (zod) → verificar vez/permissão → aplicar no engine com RNG `crypto` do servidor → gravar ação + resultado dos dados em transação (com número de sequência para evitar concorrência) → emitir a **visão filtrada** a cada jogador.
- Carregamento da partida a partir de snapshot + replay do log; reconexão devolve o estado atual.
- Rate limit por socket e tamanho máximo de mensagem.
- **Pronto quando:** dois clientes jogam pelo socket e nenhum recebe dados ocultos do outro.
- **Decidido:** também push do lobby (eventos `lobby` e `removido`) e presença (`presenca`); uma única instância do servidor (cache e fila por partida na memória); sem temporizador de vez.
- **Entregue:** `packages/server/src/tempoReal/` com `servidor.ts` (`registrarTempoReal`, handlers e `app.tempoReal` para as rotas), `handshake.ts` (Origin + cookie de sessão), `partidasAtivas.ts` (cache, `naFila`, `carregarDoBanco`/`repetirLog`, despejo), `acoes.ts` (`processarAcao`, regra de snapshot), `emissao.ts` (estado, lobby, presença), `limite.ts` (balde de fichas) e `tipos.ts` (salas). Contrato `shared/src/socket.ts` com `partidaId` em todos os eventos, `lobby`, `removido`, `presenca`, `deixarPartida` e `TAMANHO_MAXIMO_MENSAGEM`. Rotas do lobby e de auth avisam o socket; `sessaoAtiva()` em `auth/sessoes.ts`. Testes em `test/socket.test.ts` (handshake, entrada, validação, serialização, partida com robôs sem vazamento, recarga e log adulterado, fim de jogo, lobby, presença, limites, sessão encerrada). `pnpm typecheck`, `pnpm lint` (sem avisos) e `pnpm test` passam; verificação feita pelo usuário.

### Etapa 8 — Front: base, autenticação e lobby ✅ CONCLUÍDA (2026-11-23)
- Roteamento, layout, stores Zustand, cliente da API e do socket tipados pelo `shared`.
- Telas de ~~cadastro~~/login, lista de partidas, sala de espera com convite e configuração.
- **Pronto quando:** o fluxo "criar conta → criar partida → amigo entra pelo convite → iniciar" funciona no navegador.
- **Decidido:** React Router 7 (modo biblioteca); configuração de todos os parâmetros na sala de espera; sem cadastro público (conta pela CLI + página `/definir-senha`); partida iniciada mostra um painel provisório até a etapa 9.
- **Entregue:** `packages/web/src/` com `rotas.tsx` (`/entrar`, `/definir-senha`, `/convite`, `/partidas`, `/partidas/:id`, `/conta`), `api/` (`requisitar` → `ErroDaApi`; uma função por rota), `stores/` (`sessao`, `conexao`, `partidas`), `socket.ts` (`iniciarTempoReal`: liga/desliga conforme a sessão, ouvintes únicos, reconexão após recusa ou desconexão pelo servidor, ressincroniza se faltar `seq`), `hooks/useAcompanharPartida.ts` e `hooks/useTokenDoFragmento.ts` (tira o token da barra), `componentes/` (`Layout`, `ExigirLogin`, básicos), `paginas/` (inclui `SalaDeEspera`, `ParametrosPartida` e o provisório `PartidaEmAndamento`) e `ui/` (`cores.ts`, `parametros.ts`). Dependência nova: `react-router`; `resolve.dedupe` de React no `vite.config.ts` (o pré-empacotamento embutia outra cópia no react-router e a tela ficava em branco). Parâmetros comparados sem depender da ordem das chaves (o `jsonb` as reordena). Contas de teste em `USUARIOS-TESTE.md`. `pnpm typecheck` e `pnpm lint` (sem avisos) passam; fluxo do lobby testado no navegador (definir senha, login, convite com redirecionamento, cores, parâmetros, remover, sair, renovar convite, iniciar) e verificado pelo usuário.

### Etapa 9 — Front: tabuleiro e jogo ✅ CONCLUÍDA (2026-11-25)
- Portar o mapa de `Tabuleiro.html` (D3 + TopoJSON) para componentes React, lendo os dados do engine.
- HUD: jogador da vez, fase, exércitos a distribuir, mão de cartas, objetivo, bases aéreas, log da partida.
- Interações por fase: distribuir, atacar (terrestre/aéreo, com animação dos dados), deslocar, usar cartas.
- Pré-visualização local com o engine (validação imediata, mas a resposta oficial é sempre a do servidor).
- Reutilizar a galeria de cartas/dados e o guia de regras de `Tabuleiro.html`.
- **Pronto quando:** uma partida completa é jogada entre navegadores.
- **Decidido:** o servidor manda a visão nova junto com os eventos (o evento passa a ser `eventos(partidaId, eventos, visao, seq)`; não há redutor de eventos no front); a geometria do mapa é pré-calculada por script e versionada; a galeria e o guia de regras são portados para React (o `Tabuleiro.html` continua como protótipo publicado).
- **Entregue** (subetapas 9.1–9.7):
  - **Contrato e servidor:** `server/src/tempoReal/acoes.ts` emite a cada jogador `eventosParaJogador` junto com `visaoDoJogador`; testes do socket conferem que a última visão recebida é igual à do engine e que a visão dos eventos não leva segredos alheios.
  - **Geometria:** `web/scripts/gerar-geografia.mjs` (`node scripts/gerar-geografia.mjs` em `packages/web`; baixa o world-atlas 50m, projeção Miller com `rotate([-11,0])` e o `fitExtent` do protótipo, `d3.geoContains` no lugar de `isPointInFill`) gera `web/src/mapa/geografia.json` (981 KB, 214 KB com gzip; fora do Prettier), tipado e carregado sob demanda por `mapa/geografia.ts` (`carregarGeografia()`, chunk próprio; `chaveDaRota(a, b)`). Ids, continentes, CEs e fronteiras vêm do engine e o script falha se o mapa não bater; só avisa que três ligações marítimas (Argélia–França, Vladivostok–Japão, Bornéu–Nova Guiné) encostam no mapa a menos de 1 px.
  - **Componentes do tabuleiro** (`web/src/componentes/tabuleiro/`): `DefsDoJogo` (caminhos grandes, `<clipPath>` e peças das cartas, usados por `<use href>`; montado uma vez na tela), `Tabuleiro` (zoom `d3.zoom` 1–8; estados selecionado, marcado, opção e esmaecido), `MarcadorTerritorio`, `BaseAerea`, `Dado`, `CartaTroca`, `CartaObjetivo` e `pecas.tsx`; `componentes/Modal.tsx` (`Modal`, `Abas`); `ui/tokens.ts` (cores de continente e território).
  - **Ações e prévia** (`web/src/jogo/`): `enviarAcao.ts` (`enviarAcao` com ack de até 10 s, `useEnviarAcao`), `previa.ts` (pseudo-estado a partir da visão e RNG que interrompe no primeiro sorteio: `validar` → `recusada`/`sorteio`/`prevista`, mais as consultas de destaques; nenhuma regra reescrita no front), `interacao.ts` (`derivarEtapa`, `destaquesDoMapa`, `cliqueNoMapa`), `mesa.ts` e `calculadora.ts`; store `stores/jogo.ts` (`useJogo`, só de interface, zerada a cada vez e a cada fase).
  - **Tela da partida** (`paginas/TelaDoJogo.tsx`, aberta por `Partida.tsx` em andamento ou encerrada): mapa ao lado do painel de 340px (abaixo de 861px o mapa fica com 62vh e o painel desce); `componentes/jogo/` com os blocos Vez, Ação (`PainelAcao`, controles de cada fase), Combate (dados animados por 0,9 s, puláveis, direto com `prefers-reduced-motion`), Território (`InfoTerritorio`), Recebimento, Mesa, Minhas cartas, Meu objetivo, Continentes e Log; `TelaDeVitoria` com o logotipo ferrugem. Textos dos eventos em `ui/textosEventos.ts` (`switch` exaustivo). `Layout` largo nessa tela. O painel provisório `PartidaEmAndamento` e a vitrine `/dev/vitrine` foram apagados.
  - **Galeria e guia** (`componentes/guia/`): `Galeria` (cartas de troca com filtros, objetivos e dados com as faces dos parâmetros), `GuiaDeRegras` (as 12 seções do guia do `Tabuleiro.html` em JSX, com os números que são parâmetros vindos da partida e "ver no mapa"), `Simuladores` (calculadora pelo `calcularRecebimento` do engine; simuladores com sorteio local só ilustrativo). Abertos pelos botões "Regras do jogo" e "Ver cartas e dados".
  - `pnpm typecheck`, `pnpm lint` (sem avisos), `pnpm format:check` e `pnpm test` passam. Conferido no navegador com a partida "Teste do lobby" e robôs nos outros assentos (fluxo de todas as fases, galeria, guia, 375px); a tela de vitória foi conferida injetando uma visão em `FIM`, porque os robôs aleatórios não cumprem objetivos.
- **Cuidados descobertos:**
  - **Tailwind 4 só emite as variáveis de tema citadas por extenso** no código: montar `--color-cont-${x}` em tempo de execução devolve vazio (os territórios saíram pretos). Usar nomes literais, como em `ui/tokens.ts`.
  - **React duplicado no Vite** ao passar a importar o d3 (tela em branco, "Invalid hook call"): apagar `packages/web/node_modules/.vite` antes de subir.
  - Na visão, o dono de um território é o `JogadorId` (id do usuário); para o mapa, converter para a cor com `visao.jogadores`; os nomes vêm de `lobby.participantes`.
  - O servidor só envia `estado` e `eventos` aos jogadores da partida (sem espectadores).
  - Robôs para testar no navegador: o `escolherAcao` de `engine/test/apoio.ts` sobre `estadoDaVisao`; ao parar, conferir se o `node` filho do `npx` também morreu.
- **Pendências levadas adiante** (etapa 13): o log da partida só mostra os eventos recebidos desde o último `estado` (recarregar a página o esvazia; um histórico persistente exige rota nova no servidor); nas cartas-objetivo de "destruir cor", o número do canto encosta no texto, como no protótipo; a partida completa entre navegadores com 3 pessoas (até a vitória) fica para o playtest.

### Etapa 10 — Endurecimento de segurança e observabilidade ✅ CONCLUÍDA (2026-11-25)
- Revisão geral: headers (`@fastify/helmet`, CSP no Nginx), CORS restrito à origem, checagem de `Origin` no socket, CSRF (SameSite + verificação de origem), limites de payload, logs de auditoria.
- `pnpm audit`, revisão de segredos, usuário não-root nas imagens Docker.
- Logs de erro e métricas básicas.
- **Pronto quando:** checklist de segurança fechado e `/security-review` sem achados relevantes.
- **Decidido:** sem CORS (nenhuma outra origem lê a API); quando falta `Origin`, a regra de origem olha o `Sec-Fetch-Site` em vez de exigir `Origin` (o navegador não o manda no GET da mesma origem, como no polling do Socket.IO); auditoria no próprio log (linhas com o campo `auditoria`), não em tabela; métricas no log a cada 15 min e numa rota protegida por token opcional; `TRUST_PROXY` passa a aceitar o número de proxies (usar `1` no Dokploy).
- **Entregue:**
  - **Checklist:** cabeçalhos da API (`server/src/seguranca.ts`: helmet com CSP `default-src 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CORP `same-origin`, HSTS só em produção) ✔; CSP e cabeçalhos do site (`web/nginx-cabecalhos.conf`, incluído em cada `location` do `nginx.conf`; `script-src 'self'`, estilos com `'unsafe-inline'` pelos atributos `style`, `connect-src 'self'` para API e WebSocket) ✔; zod sem `new Function` no navegador (`shared/src/zod.ts`, para a CSP sem `eval`) ✔; CORS: nenhum ✔; origem no REST e no socket com a mesma regra (`server/src/origem.ts`: `Origin` = `URL_PUBLICA`; sem `Origin`, `Sec-Fetch-Site` `same-origin`/`none`; sem os dois, cliente fora do navegador) ✔; CSRF: `SameSite=Lax` + origem + só corpo JSON (parser de `text/plain` removido → 415) ✔; limites: `bodyLimit` global de 16 KB, `requestTimeout` de 30 s, `client_max_body_size 1k` no Nginx, mais os limites por rota e por socket que já existiam ✔; auditoria (`server/src/auditoria.ts`: login, falha e bloqueio com e-mail mascarado, logout, senha definida/trocada e falhas, sair de todas, origem recusada, socket recusado/excesso de mensagens, criar/entrar/sair/remover/convite/iniciar/cancelar partida, partida encerrada e corrompida; alertas como `warn`) ✔; `pnpm audit` sem vulnerabilidades (override do `esbuild` do `@esbuild-kit/core-utils`, trazido pelo `drizzle-kit`, para 0.25.12; `db:generate` conferido) ✔; segredos: nada versionado no histórico além do valor de exemplo e do segredo dos testes (`.env` no `.gitignore` e no `.dockerignore`) ✔; Docker sem root: servidor em duas etapas só com dependências de produção, `USER node`, `HEALTHCHECK` e `--enable-source-maps`; web em `nginxinc/nginx-unprivileged` na **porta 8080** ✔; `TRUST_PROXY` com número de proxies (`true` confia em `X-Forwarded-For` forjado e vira aviso no log em produção) ✔.
  - **Observabilidade:** `server/src/metricas.ts` (requisições por classe de status e faixa de tempo, ações aceitas/recusadas, erros internos, sockets, partidas na memória, memória, atraso do event loop) no log a cada 15 min e em `GET /api/metricas` com `METRICAS_TOKEN` (Bearer, comparação em tempo constante; sem o token a rota não existe); `unhandledRejection` vai para o log e `uncaughtException` encerra o processo com log `fatal`.
  - **Testes:** `server/test/seguranca.test.ts` (regra de origem, máscara de e-mail, cabeçalhos, `Sec-Fetch-Site` de outro site, `text/plain` → 415, limite global de corpo, métricas desligadas) e o handshake do socket com `Sec-Fetch-Site`. `pnpm typecheck`, `pnpm lint` (sem avisos), `pnpm format:check` e `pnpm test` (36 do engine, 86 do servidor) passam. Conferido no navegador em dev: sessão, lista, partida conectada pelo socket e uma ação aceita.
  - **Revisão de segurança:** o `/security-review` não roda neste repositório (compara com `origin/HEAD` e não há remoto); a revisão do diff foi feita à mão, sem achados relevantes.
  - **Não verificado:** as imagens Docker não foram construídas nesta etapa (a CSP do Nginx e o `nginx-unprivileged` ainda precisam ser vistos rodando).
- **Para a etapa 11:** a aplicação web escuta na **8080**; no servidor, `TRUST_PROXY=1`, `URL_PUBLICA` com https e, se quiser as métricas, `METRICAS_TOKEN`.

### Etapa 11 — Deploy no Dokploy
- Duas aplicações (server e web) com context na raiz; variáveis de ambiente e segredos no Dokploy; domínio com roteamento `/`, `/api`, `/socket.io`; HTTPS.
- Backup do Postgres.
- **Pronto quando:** amigos jogam no domínio publicado.

### Etapa 12 — Variante Centro de Informações (opcional)
- Regras §12 no engine (já atrás de parâmetro), exceção de visibilidade para o captor, UI de espionagem.

### Etapa 13 — Playtest e ajustes
- Partidas reais entre amigos, ajuste de parâmetros ⚠ A CONFIRMAR, correções de UX.
- Pendências da etapa 9: histórico persistente do log da partida e o número do canto das cartas-objetivo de "destruir cor".
- Roteiro herdado da etapa 9 para a primeira partida completa (contas de `USUARIOS-TESTE.md`, cada jogador num contexto de navegador separado): ocupação; 1ª rodada só de recebimento; ataque terrestre com conquista; ataque aéreo com ciclos; deslocamento e aerotransporte; cartas (compra, reforço, transporte e descarte); recusa mostrada no painel; recarga da página (reconexão); eliminação e vitória. Conferir que ninguém vê objetivo nem cartas alheios (nem no painel nem nas mensagens do socket), a galeria, o guia, o zoom, o layout abaixo de 860px e `prefers-reduced-motion`.

---

## Dependências e paralelismo

```
1 → 2 ──────────→ 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12/13
1 → 3 → 4 ───────────────↗ (7 e 9 dependem do engine)
```
- Etapas 3–4 (engine) e 2/5 (banco e contas) podem andar em paralelo após a etapa 1.
- A etapa 8 pode começar assim que a 6 estiver pronta, em paralelo com a 7.

## Boas práticas transversais (valem para todas as etapas)
- **Servidor autoritativo**: o cliente só envia intenções; toda regra e todo dado rolado ficam no servidor, com log auditável.
- **Validação de entrada** em toda fronteira (REST e socket) com `zod`; nunca confiar no cliente.
- **Informação oculta** garantida pela projeção da visão.
- SQL sempre parametrizado (Drizzle); segredos só por variável de ambiente; nada sensível em log ou URL.
- Textos, comentários e docs em PT-BR; ao mexer em regra, sincronizar `WARII.md` ↔ `Tabuleiro.html` (e a cópia no site) e o guia de regras do front (`packages/web/src/componentes/guia/`).
- Atualizar `CLAUDE.md`/`README.md` ao fim de cada etapa.

## Verificação
Manual, rodando a aplicação (`pnpm dev`) contra o Postgres: cada etapa tem seu critério "Pronto quando" acima, e o detalhamento de cada uma trará o roteiro de verificação.
