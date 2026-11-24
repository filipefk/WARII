# Etapa 9 — Front: tabuleiro e jogo

Plano detalhado da etapa 9 de `PLANO-WARII-ONLINE.md`, com o andamento. **Pronto quando:** uma partida completa é jogada entre navegadores.

## Andamento

| Subetapa | Situação |
|---|---|
| 9.1 Contrato e servidor: visão junto com os eventos | ✅ concluída |
| 9.2 Geometria pré-calculada | ✅ concluída |
| 9.3 Componentes do tabuleiro | ✅ concluída (conferida no navegador pela vitrine `/dev/vitrine`) |
| 9.4 Envio de ações e pré-visualização | ✅ concluída (prévia conferida contra o engine numa partida simulada) |
| 9.5 Tela da partida e HUD | ⏳ próxima |
| 9.6 Interações por fase | ⏳ pendente |
| 9.7 Galeria e guia de regras em React | ⏳ pendente |
| 9.8 Documentação | ⏳ pendente |

**Nada foi commitado ainda.** Tudo o que está abaixo como "feito" está na árvore de trabalho. `pnpm typecheck`, `pnpm lint` (sem avisos), `pnpm format:check` e `pnpm test` passam.

## Contexto

As etapas 1–8 entregaram engine, servidor em tempo real e o front até o lobby. Uma partida iniciada mostra só o painel provisório `PartidaEmAndamento.tsx`. Esta etapa leva o mapa do `Tabuleiro.html` para React, monta o HUD e as interações de cada fase, e porta a galeria e o guia de regras.

Decisões do usuário:
1. O servidor manda a visão nova junto com os eventos; não há redutor de eventos no front.
2. A geometria do mapa é pré-calculada por script e versionada.
3. A galeria e o guia de regras são portados para React.

## Para continuar numa nova sessão

### Onde está cada coisa (já feito)

- **Contrato e servidor (9.1).**
  - `shared/src/socket.ts`: o evento passa a ser `eventos(partidaId, eventos, visao, seq)`.
  - `server/src/tempoReal/acoes.ts`: emite a cada jogador `eventosParaJogador(...)` junto com `visaoDoJogador(novo, id)`.
  - Testes: `server/test/apoioSocket.ts` (a `conferirSemSegredosAlheios` também confere a visão dos eventos) e `server/test/socket.test.ts`, onde a partida jogada por robôs confere que a última visão recebida é igual a `visaoDoJogador`.
- **Store do front** (`web/src/stores/partidas.ts`, `web/src/socket.ts`). `gravarEventos(id, eventos, visao, seq)` troca a visão e guarda:
  - `eventos`: o log, com até 100 itens;
  - `ultimos`: o lote mais recente;
  - `seqEventos`: o seq desse lote.

  Se o seq não for o seguinte, chama `ressincronizar`.
- **Geometria (9.2).**
  - O script é `web/scripts/gerar-geografia.mjs`; rodar com `node scripts/gerar-geografia.mjs` dentro de `packages/web`. Ele baixa o world-atlas 50m e confere os dados contra o engine; falha se algo não bater.
  - A saída é `web/src/mapa/geografia.json` (981 KB, 214 KB com gzip), que está no `.prettierignore`.
  - `web/src/mapa/geografia.ts` tem os tipos, `chaveDaRota(a, b)` e `carregarGeografia()` (`import()` dinâmico, num chunk próprio).
  - Formato:
    - parte de território: `{ d }` ou `{ pais, recorte }` (país dividido, recortado);
    - `paisesDivididos[pais]`: contorno do país, gravado uma vez só;
    - fronteiras: `{ d, recorte?, recortePais? }`;
    - rotas: `{ tipo, d, pontas }`, indexadas por `"a|b"` em ordem alfabética;
    - cada território tem `tom`, a variação de luminosidade da cor do continente.
  - O script avisa, sem falhar, que três ligações marítimas encostam no mapa a menos de 1 px: Argélia–França, Vladivostok–Japão e Bornéu–Nova Guiné. É detalhe geográfico; a regra continua valendo.
- **Componentes (9.3)**, em `web/src/componentes/tabuleiro/`:
  - `DefsDoJogo` é um `<svg>` oculto com os caminhos grandes, os `<clipPath>` e as peças das cartas. Precisa estar montado uma vez na tela; o mapa e as cartas usam `<use href>`. `UsoDaParte` desenha uma parte.
  - `Tabuleiro` recebe estas props:
    - `geografia`;
    - `territorio(id) → { dono: CorId | null, exercitos }`;
    - `bases`: uma por assento, `{ dono, bombardeiros } | null`;
    - `selecionado`;
    - `marcados`: realçados;
    - `opcoes`: quando definido, os demais ficam esmaecidos;
    - `onClicar(id | null)`.

    O zoom usa `d3.zoom` (1 a 8).
  - `MarcadorTerritorio`, `BaseAerea`, `Dado` (`tipo`, `valor`, `rolando`; também `rotuloDaFace`), `CartaTroca` (`carta`, `geografia`, `largura`, `marcada`, `onClick`), `CartaObjetivo` (`id`) e `pecas.tsx` (caça delta, alfinete de CE).
  - `web/src/componentes/Modal.tsx`: `Modal` (com `estreito` para decisões curtas) e `Abas`.
  - `web/src/ui/tokens.ts`: `corDoTerritorio(continente, tom)`, `corClareadaDoContinente(c, quanto)` e `corDoContinente(c)`.
  - CSS em `index.css`, `@layer components`: classes `.mapa-*`, `.carta-troca`, `.carta-botao`, `.carta-objetivo`, `.dado` e a animação `dado-rolando`, desligada com `prefers-reduced-motion`.
- **Ações e prévia (9.4).**
  - `web/src/jogo/enviarAcao.ts`:
    - `enviarAcao(partidaId, acao)` espera o ack por até 10 s e trata as falhas `SEM_CONEXAO` e `SEM_RESPOSTA`;
    - `useEnviarAcao(partidaId)` devolve `{ ocupado, erro, enviar, limparErro }`.
  - `web/src/jogo/previa.ts`:
    - `estadoDaVisao(visao)` e `validar(visao, acao)`, que devolve `recusada` (com o erro do engine), `sorteio` (válida, depende de dado) ou `prevista` (com o estado previsto);
    - consultas: `euSouDaVez`, `eu`, `territoriosOcupaveis`, `inicioDoisVagos`/`parceirosDoisVagos`, `territoriosPosicionaveis`/`maximoPosicionar`, `origensDeAtaque`/`alvosTerrestres`/`maximoDados`, `alvosAereos`, `origensDeDeslocamento`/`destinosDeDeslocamento`/`maximoDeslocar`/`ehAerotransporte`, `territoriosParaReforco`, `paresDeTransporte`/`maximoTransportar` e `maoAcimaDoLimite`.
  - `web/src/stores/jogo.ts` (`useJogo`, só de interface) guarda o `modo` da interação, `origem`, `destino`, `cartas`, `selecionado` e `seqAnimado`. As funções são `abrirPartida`, `sincronizarVez(chaveDaVez(...))` (zera a interação a cada vez), `selecionar`, `iniciar`, `definirOrigem`/`definirDestino`, `alternarCarta`, `cancelar` e `marcarAnimado`.

### Cuidados descobertos no caminho

- **Tailwind 4 e variáveis dinâmicas.** Só são emitidas as variáveis de tema citadas por extenso no código. Montar `--color-cont-${x}` em tempo de execução devolve vazio, e os territórios saíram pretos. Use nomes literais, como em `ui/tokens.ts`.
- **React duplicado no Vite.** Ao passar a importar o d3, a tela ficou em branco com "Invalid hook call". Resolve apagando `packages/web/node_modules/.vite` antes de subir o Vite.
- **Vitrine temporária.** `web/src/paginas/VitrineDev.tsx` (rota `/dev/vitrine`, só em dev, registrada em `rotas.tsx`) mostra o tabuleiro, os dados, as cartas e os objetivos com uma partida local do engine, sem login nem banco. **Remover na 9.5**, junto com a rota.
- **Carta-objetivo.** Nas cartas de "destruir cor", o número do canto encosta no texto, como no protótipo. Ajuste pendente.
- **Nomes dos donos.** Na visão, o dono de um território é o `JogadorId` (o id do usuário). Para o mapa, converta para a cor com `visao.jogadores`. Os nomes vêm de `lobby.participantes`.
- **Espectadores.** O servidor só envia `estado` e `eventos` aos jogadores da partida.
- O plano aprovado original também está em `C:\Users\Filipe\.claude\plans\planeje-a-etapa-9-curried-pillow-of-fd0c0b78-e750-4dea-b54e-770e4d513a3c.md`.

## Subetapas

### 9.1 Contrato e servidor: a visão vai junto com os eventos ✅
- `shared/src/socket.ts`: `eventos: (partidaId, eventos: Evento[], visao: VisaoPartida, seq) => void`.
- `server/src/tempoReal/acoes.ts`: emite também `visaoDoJogador(novo, jogador.id)`.
- `web/src/socket.ts` e `stores/partidas.ts`: trocam a visão e acumulam os eventos (log e último lote).
- Testes do socket ajustados, com a conferência da visão recebida.

### 9.2 Geometria pré-calculada ✅
- `packages/web/scripts/gerar-geografia.mjs`: projeção Miller com `rotate([-11,0])` e o `fitExtent` do protótipo; porta o `init()` e o `terrBox()` do `Tabuleiro.html`, usando `d3.geoContains` no lugar de `isPointInFill`.
- Saída `src/mapa/geografia.json`, mais `src/mapa/geografia.ts`, que tipa e carrega o JSON.
- Ids, continentes, CEs e fronteiras vêm do engine, e o script falha se o mapa não bater com eles.

### 9.3 Componentes do tabuleiro ✅
São os componentes do sistema de design; ler o README de cada um no artifact antes de mexer.
- `Tabuleiro`: moldura, radar, territórios, fronteiras, rotas, rótulos, bases e zoom. Os estados visuais são selecionado, marcado, opção e esmaecido.
- `MarcadorTerritorio`, `BaseAerea`, `Dado`, `CartaTroca` (com `DefsDoJogo`), `CartaObjetivo`, `Modal` e `Abas`.
- Ainda falta: abaixo de 860px, o mapa ocupar 62vh com o painel embaixo. Isso entra no layout da 9.5.

### 9.4 Estado de UI, envio de ações e pré-visualização ✅
- `jogo/enviarAcao.ts` (`enviarAcao`, `useEnviarAcao`). Com `ESTADO_DESATUALIZADO`, só avisa, porque o servidor já reenviou o estado.
- `jogo/previa.ts`: pseudo-estado a partir da visão e uma RNG que interrompe no primeiro sorteio. Nenhuma regra é reescrita no front.
- `stores/jogo.ts`: a interação, zerada a cada vez.

### 9.5 Tela da partida e HUD ⏳
- `paginas/Partida.tsx` passa a abrir `TelaDoJogo` (nova) no lugar de `PartidaEmAndamento`, que é apagado.
- Remover a vitrine `/dev/vitrine` (`VitrineDev.tsx` e a entrada em `rotas.tsx`).
- O `Layout` ganha uma variante larga para `/partidas/:id` com o jogo em andamento: sem `max-w-5xl` e com o mapa ocupando a largura.
- Abaixo de 860px, o mapa ocupa 62vh e o painel vai para baixo.
- O fundo segue `COMPOSICOES.partida`.
- Montar `DefsDoJogo` e carregar a geografia com `carregarGeografia()`, mostrando `Carregando` enquanto isso.
- Chamar `useJogo.abrirPartida(id, seq)` e `sincronizarVez(chaveDaVez(rodada, vez, etapa))`.
- **Painel lateral** de 340px, no formato de `InfoTerritorio`, com blocos de título `secao`:
  - **Vez:** jogador da vez (cor e nome), rodada e etapa da 1ª rodada, fase e presença.
  - **Ação atual:** controles da fase (ver 9.6), dica e erro.
  - **Território selecionado:** `InfoTerritorio` com nome, tag CE, "Inclui: …", continente, dono e vizinhos ("(marítima)", "(volta do mapa)").
  - **Recebimento:** livres e bônus por continente pendentes (`pendenteDeRecebimento`).
  - **Mesa:** jogadores em ordem, com cor, territórios, exércitos, quantidade de cartas, bombardeiros na base e na caixa, e marcação de eliminado ou vencedor.
  - **Minhas cartas:** a mão como `CartaTroca`, marcáveis.
  - **Meu objetivo:** `CartaObjetivo`.
  - **Continentes:** `TabelaContinentes` com os bônus de `parametros.bonusContinentes`.
  - **Log da partida:** um texto por tipo de evento, em `ui/textosEventos.ts` com `satisfies Record<TipoEvento, …>`; o último no topo.
- Botões "Ver cartas e dados" e "Regras do jogo" abrem os modais da 9.7.

### 9.6 Interações por fase ⏳
Os controles só aparecem para o jogador da vez (`euSouDaVez`). Os outros veem "Aguardando {nome}". Os destaques no mapa vêm das consultas de `previa.ts`.
- **`PREP_ESCOLHA_5J`:** escolher entre pegar um CE extra (`preparacao.centrosExtras`) ou ocupar dois vagos (`inicioDoisVagos`/`parceirosDoisVagos`).
- **`PREP_OCUPACAO`:** clique num território de `territoriosOcupaveis` e envio de `ocupar`.
- **`RECEBER`:** clique num território próprio, quantidade (até `maximoPosicionar`) e `posicionar`; depois "Encerrar recebimento".
- **`ATACAR`, ataque terrestre:**
  - Escolher a origem, depois o alvo (destacados), depois os dados (1 a `maximoDados`) e enviar `atacar`.
  - O evento `ataqueTerrestre` é animado: ataque × defesa em pares, com as perdas escritas.
  - Com `turno.conquistaPendente`, um painel bloqueante pede quantos exércitos entram (1 a `maximo`) e envia `moverAposConquista`.
- **`ATACAR`, ataque aéreo:**
  - Escolher o alvo (`alvosAereos`), `daBase` e, opcionalmente, uma carta do alvo mais numéricas (respeitando `somarBaseECaixa`), e enviar `iniciarAtaqueAereo`.
  - Cada `cicloAereo` é animado.
  - Com `turno.ataqueAereo`, aparecem "Continuar" e "Encerrar". O ataque aéreo nunca conquista.
- **`ATACAR`:** "Encerrar ataques" leva ao deslocamento; "Encerrar jogada" também está disponível.
- **`DESLOCAR`:** origem, destino (vizinhos e aerotransporte CE→CE), quantidade até `maximoDeslocar` e `deslocar`; depois "Encerrar jogada".
- **Cartas** (em `RECEBER`, `ATACAR` e `DESLOCAR`):
  - reforço: `territoriosParaReforco`;
  - transporte: `paresDeTransporte` e `maximoTransportar`;
  - descarte.

  Com `maoAcimaDoLimite`, o resto fica bloqueado com a explicação.
- **`FIM`:** tela de vitória com o logotipo ferrugem (sem o cromado na mesma tela), o vencedor, o objetivo revelado e o link para a lista de partidas.
- **Animações:** curtas e puláveis. Respeitam `prefers-reduced-motion`. Usam `ultimos`/`seqEventos` contra `seqAnimado` e não bloqueiam ações depois que a visão nova chega.

### 9.7 Galeria e guia de regras em React ⏳
- **Galeria:** `Modal` com as `Abas` "Cartas de troca (61)", "Objetivos (20)" e "Dados".
  - Cartas a partir de `CARTAS_DE_TROCA`, com filtros e legenda "No mapa: …" ou `qty`.
  - Objetivos a partir do engine.
  - Faces dos dados a partir dos parâmetros da partida (`facesAtaqueAereo`, `facesAntiaereo`).
- **Guia:** as 12 seções de `RULES()` do `Tabuleiro.html`, por volta das linhas 992-1152, convertidas para JSX.
  - As seções são visão, peças, mapa, preparo, turno, receber, terrestre, aéreo, deslocar, cartas, objetivos e CI.
  - Usam `NavegacaoGuia`, `Caixa` (`ex`/`note`/`warn`), `Fluxo` e ilustrações com `Dado` e `CartaTroca`.
  - Os botões "ver no mapa" fecham o modal e selecionam o território.
- **Calculadora e simuladores** (componente `Simulador`):
  - a calculadora usa `calcularRecebimento` e o `minimoRecebimento` da partida, em vez do mínimo 3 fixo do HTML;
  - os simuladores usam as faces dos `parametros`, com sorteio local só ilustrativo.
- Sem cores soltas: o CSS do HTML vira os tokens do `index.css`.

### 9.8 Documentação ⏳
- `PLANO-WARII-ONLINE.md`: marcar a etapa 9 como concluída, com "Entregue" e "Decidido".
- `CLAUDE.md`, nestes pontos:
  - Status;
  - Front: tela do jogo, `jogo/`, `mapa/geografia.json` e o script, novo formato do evento `eventos`, cuidado com as variáveis literais do Tailwind;
  - regra de sincronia: mudanças em `WARII.md` também vão para o guia do front.
- Apagar este `ETAPA-9.md`, ou incorporá-lo ao plano.

## Verificação final
- `pnpm typecheck`, `pnpm lint` (sem avisos), `pnpm test` e `pnpm test:simulacao`.
- **No navegador:**
  - Conferir antes se já há instâncias nas portas 5173 e 3000. Se a instância for subida aqui, derrubá-la no fim.
  - Usar as contas de `USUARIOS-TESTE.md`, cada jogador num contexto de navegador separado: navegador embutido, Chrome e uma janela anônima.
  - Percorrer uma partida com 3 jogadores:
    - ocupação;
    - 1ª rodada só de recebimento;
    - ataque terrestre com conquista;
    - ataque aéreo com ciclos;
    - deslocamento e aerotransporte;
    - cartas: compra, reforço, transporte e descarte;
    - recusa mostrada no painel;
    - recarga da página (reconexão);
    - eliminação e vitória.
  - Conferir que ninguém vê objetivo nem cartas alheios, nem no painel nem nas mensagens do socket.
  - Conferir a galeria, o guia, o zoom, o layout abaixo de 860px e `prefers-reduced-motion`.
