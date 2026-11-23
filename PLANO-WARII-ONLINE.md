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

### Etapa 6 — Contrato `shared` e lobby (REST)
- Em `@warii/shared`: schemas `zod` das ações do jogo, DTOs da API e tipos dos eventos do Socket.IO (validação no servidor, tipos no front).
- Tabelas `partidas`, `participantes`, `acoes_partida` (log append-only) e `snapshots`.
- Lobby: criar partida, link de convite (token aleatório), entrar, escolher cor, configurar parâmetros da partida, iniciar. Autorização por partida (só o anfitrião configura/inicia).
- **Pronto quando:** dois usuários conseguem criar, entrar e iniciar uma partida via API.

### Etapa 7 — Servidor de partida em tempo real
- Socket.IO autenticado pelo mesmo cookie de sessão; cada partida é uma sala.
- Fluxo de uma ação: validar payload (zod) → verificar vez/permissão → aplicar no engine com RNG `crypto` do servidor → gravar ação + resultado dos dados em transação (com número de sequência para evitar concorrência) → emitir a **visão filtrada** a cada jogador.
- Carregamento da partida a partir de snapshot + replay do log; reconexão devolve o estado atual.
- Rate limit por socket e tamanho máximo de mensagem.
- **Pronto quando:** dois clientes jogam pelo socket e nenhum recebe dados ocultos do outro.

### Etapa 8 — Front: base, autenticação e lobby
- Roteamento, layout, stores Zustand, cliente da API e do socket tipados pelo `shared`.
- Telas de cadastro/login, lista de partidas, sala de espera com convite e configuração.
- **Pronto quando:** o fluxo "criar conta → criar partida → amigo entra pelo convite → iniciar" funciona no navegador.

### Etapa 9 — Front: tabuleiro e jogo
- Portar o mapa de `Tabuleiro.html` (D3 + TopoJSON) para componentes React, lendo os dados do engine.
- HUD: jogador da vez, fase, exércitos a distribuir, mão de cartas, objetivo, bases aéreas, log da partida.
- Interações por fase: distribuir, atacar (terrestre/aéreo, com animação dos dados), deslocar, usar cartas.
- Pré-visualização local com o engine (validação imediata, mas a resposta oficial é sempre a do servidor).
- Reutilizar a galeria de cartas/dados e o guia de regras de `Tabuleiro.html`.
- **Pronto quando:** uma partida completa é jogada entre navegadores.

### Etapa 10 — Endurecimento de segurança e observabilidade
- Revisão geral: headers (`@fastify/helmet`, CSP no Nginx), CORS restrito à origem, checagem de `Origin` no socket, CSRF (SameSite + verificação de origem), limites de payload, logs de auditoria.
- `pnpm audit`, revisão de segredos, usuário não-root nas imagens Docker.
- Logs de erro e métricas básicas.
- **Pronto quando:** checklist de segurança fechado e `/security-review` sem achados relevantes.

### Etapa 11 — Deploy no Dokploy
- Duas aplicações (server e web) com context na raiz; variáveis de ambiente e segredos no Dokploy; domínio com roteamento `/`, `/api`, `/socket.io`; HTTPS.
- Backup do Postgres.
- **Pronto quando:** amigos jogam no domínio publicado.

### Etapa 12 — Variante Centro de Informações (opcional)
- Regras §12 no engine (já atrás de parâmetro), exceção de visibilidade para o captor, UI de espionagem.

### Etapa 13 — Playtest e ajustes
- Partidas reais entre amigos, ajuste de parâmetros ⚠ A CONFIRMAR, correções de UX.

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
- Textos, comentários e docs em PT-BR; ao mexer em regra, sincronizar `WARII.md` ↔ `Tabuleiro.html` (e a cópia no site).
- Atualizar `CLAUDE.md`/`README.md` ao fim de cada etapa.

## Verificação
Manual, rodando a aplicação (`pnpm dev`) contra o Postgres: cada etapa tem seu critério "Pronto quando" acima, e o detalhamento de cada uma trará o roteiro de verificação.
