# War II — Especificação de Regras

Documento de referência das regras do jogo de tabuleiro **War II** (Grow), escrito como base para implementar uma versão online.

> **Fonte principal:** manual oficial de regras do War II (PDF digitalizado pela Table Games) — https://tablegames.com.br/wp-content/uploads/2019/03/war_II_manual_table_games.pdf> **Fontes complementares:** vídeo "Aprenda a Jogar WAR II – Regras Completas e Explicadas Passo a Passo!", canal VemKaJogar — https://www.youtube.com/watch?v=hHbcT_GkAV4 ; ficha do produto em lojas — https://www.baraodistribuidor.com.br/jogo-war-ii-grow/p ; resumo de regras no Scribd — https://pt.scribd.com/document/98259059/Regras-WAR-2-Manual-WAR-II
>
> Quando o vídeo e o manual divergem, a divergência fica registrada com **📘 MANUAL × VÍDEO**. Por decisão de projeto, valem as regras **do vídeo** para: escolha na preparação com 5 jogadores (4.3), ataque aéreo (7.3: origem dos bombardeiros, interrupção, retorno à base e faces dos dados aéreos) e mudanças automáticas de objetivo (10.2). Nos demais pontos, **vale o manual**.
> Os itens marcados com **⚠ A CONFIRMAR** continuam sem resposta nas fontes. Trate-os como **parâmetros configuráveis** no código.

---

## 1. Visão geral

| Item | Valor |
|---|---|
| Jogadores | **3 a 6** (manual). A mecânica também funciona com 2, ver seção 4.2 |
| Idade | 12+ |
| Duração estimada | ~120 min |
| Tipo | Estratégia territorial com objetivos secretos |
| Diferencial em relação ao War clássico | **Centros estratégicos (CE)**, **bombardeiros** (ataque aéreo), **aerotransporte**, **cartas de troca** com uso direto (reforço, ataque aéreo ou transporte) e a variante **Centro de Informações** |

Cada jogador recebe um **objetivo secreto**. Vence o primeiro a cumprir o seu.

---

## 2. Componentes

| Componente | Detalhes |
|---|---|
| Tabuleiro | Mapa com 6 continentes divididos em territórios. **12 territórios** com o símbolo de **Centro Estratégico (CE)**. Traz impressas **4 tabelas** de "maiorias" e "totalidades" dos continentes e **6 áreas de base aérea** |
| Conjuntos de peças | 6 caixas, uma por cor (azul, amarelo, vermelho, branco, preto, verde) |
| Fichas de exército | Pequena = 1 exército; grande = 10 exércitos (só representação visual) |
| Bombardeiros | **10 por jogador** (limite físico: base aérea + caixa + em combate) |
| Centro de Informação (CI) | 1 por jogador, usado só na variante da seção 12 |
| Cartas-objetivo | **20 cartas** |
| Cartas de troca | **61 cartas**: **28 numéricas** e **33 de território/continente** (isolados ou agrupados), das quais **12 são de CE** |
| Dados vermelhos (3) | Ataque terrestre, d6 comum |
| Dados amarelos (3) | Defesa terrestre, d6 comum |
| Dado de ataque aéreo (1) | Azul. 3 faces com **fichas de exército** (a peça redonda do jogo) em quantidade **1, 2, 3** = exércitos abatidos, e 3 faces lisas |
| Dado de defesa antiaérea (1) | Azul. 3 faces com **peças de avião** (a peça triangular do jogo) = bombardeiros abatidos (**1, 1, 2**, versão do vídeo), e 3 faces lisas |

Total: 8 dados.

---

## 3. Mapa

### 3.1 Continentes e centros estratégicos

Há **6 continentes** e **12 centros estratégicos** (territórios marcados no mapa com um pino). O tabuleiro tem ainda **6 bases aéreas**, uma por cor, nas bordas:

| Continente | Centros estratégicos |
|---|---|
| América do Norte | 2 |
| América do Sul | 1 |
| Europa | 3 |
| África | 2 |
| Ásia | 3 |
| Oceania / Austrália | 1 |
| **Total** | **12** |

### 3.2 Territórios por continente

Lista lida na foto do tabuleiro (frame do vídeo). Os nomes entre parênteses são regiões agrupadas no mesmo território, escritas em letra menor no mapa. ★ = centro estratégico, marcado com um pino no mapa.

| Continente | Qtde | Territórios |
|---|---|---|
| América do Norte | 10 | Alasca, Mackenzie, Groenlândia, Vancouver, Ottawa ★, Labrador, Califórnia, Nova York ★, México, Cuba |
| América do Sul | 4 | Venezuela (Colômbia), Peru (Bolívia, Chile), Brasil ★, Argentina (Uruguai) |
| Europa | 7 | Islândia, Inglaterra ★, Suécia, Moscou ★, Alemanha ★, França (Portugal, Espanha, Itália), Polônia (Iugoslávia) |
| África | 6 | Argélia (Nigéria), Egito ★, Sudão, Congo, África do Sul ★, Madagascar |
| Ásia | 12 | Oriente Médio ★, Aral, Omsk, Dudinka, Sibéria, Vladivostok, Tchita, Mongólia, China ★, Índia, Vietnã, Japão ★ |
| Oceania | 4 | Sumatra, Bornéu, Nova Guiné, Austrália ★ |
| **Total** | **43** | |

> ⚠ A CONFIRMAR (o manual não traz o mapa):
> - **Cuba** como território próprio. O nome aparece no Caribe, e a tabela pede "6 ou +" para maioria na América do Norte, o que só fecha com 10 territórios.
> - O 3º centro da Europa (pino entre Inglaterra e Alemanha). Atribuí à **Alemanha** porque o vídeo a cita como centro.
> - O centro da Ásia junto ao rótulo Mongólia/China. Atribuí à **China**, também citada no vídeo e num exemplo do manual (ataque aéreo com carta da China, seção 9.3).
> - As regiões entre parênteses, que estão em letra pequena na foto.

### 3.3 Fronteiras

- Dois territórios são vizinhos quando se tocam no mapa **ou** quando estão ligados por uma **linha pontilhada** (manual).
- O mapa "dá a volta": há uma linha ligando **Alasca ↔ Vladivostok** pelas bordas do tabuleiro.

**Rascunho de adjacências.** Montei a lista pela foto, que tem resolução limitada, e pelo mapa clássico do War. ⚠ CONFERIR cada ligação no tabuleiro.

```text
# América do Norte
Alasca-Mackenzie, Alasca-Vancouver, Alasca-Vladivostok*
Mackenzie-Vancouver, Mackenzie-Ottawa, Mackenzie-Groenlândia*
Vancouver-Ottawa, Vancouver-Califórnia
Ottawa-Labrador, Ottawa-Nova York, Ottawa-Califórnia
Labrador-Nova York, Labrador-Groenlândia*
Califórnia-Nova York, Califórnia-México
Nova York-México, Nova York-Cuba*, México-Cuba*, México-Venezuela
Groenlândia-Islândia*

# América do Sul
Venezuela-Peru, Venezuela-Brasil, Peru-Brasil, Peru-Argentina, Brasil-Argentina
Brasil-Argélia*

# África
Argélia-Egito, Argélia-Sudão, Argélia-Congo, Egito-Sudão, Sudão-Congo,
Sudão-África do Sul, Congo-África do Sul, África do Sul-Madagascar*, Sudão-Madagascar*
Argélia-França*, Egito-França*, Egito-Polônia*, Egito-Oriente Médio

# Europa
Islândia-Inglaterra*, Islândia-Suécia*, Inglaterra-Suécia*, Inglaterra-França*
França-Alemanha, França-Polônia, Alemanha-Polônia
Suécia-Moscou, Polônia-Moscou, Polônia-Oriente Médio
Moscou-Omsk, Moscou-Aral, Moscou-Oriente Médio

# Ásia
Oriente Médio-Aral, Oriente Médio-Índia
Aral-Omsk, Aral-China, Aral-Índia
Omsk-Dudinka, Omsk-Mongólia, Omsk-China
Dudinka-Sibéria, Dudinka-Tchita, Dudinka-Mongólia
Sibéria-Tchita, Sibéria-Vladivostok
Tchita-Mongólia, Tchita-China, Tchita-Vladivostok
Mongólia-China, China-Índia, China-Vietnã, China-Vladivostok, China-Japão*
Índia-Vietnã, Vladivostok-Japão*

# Oceania
Índia-Sumatra*, Vietnã-Bornéu*, Sumatra-Austrália*, Bornéu-Nova Guiné*, Bornéu-Austrália*, Nova Guiné-Austrália*
```
`*` = ligação por linha (rota marítima) visível ou provável na foto.

> A ligação **México–Venezuela** é confirmada por um exemplo de deslocamento do manual (Brasil → Venezuela → México como territórios contíguos em sequência).

- Na implementação, modele o mapa como um **grafo não direcionado** de adjacências.
- **Aerotransporte** (seção 8.2): todos os centros estratégicos de um mesmo jogador formam uma "rede" à parte, só para deslocamento.

---

## 4. Preparação

A ordem abaixo é a do manual. 📘 MANUAL × VÍDEO: no vídeo os objetivos são sorteados **antes** dos centros estratégicos; no manual, **depois** que todos os territórios foram ocupados.

### 4.1 Cores e distribuidor
1. Cada jogador escolhe uma cor, por sorteio ou de comum acordo. As cores sem jogador saem do jogo.
2. Cada jogador rola um dado. O maior valor vira o **distribuidor**. Em caso de empate no maior valor, só os empatados rolam de novo (prática comum; o manual não trata do empate).

### 4.2 Distribuição dos centros estratégicos
1. O distribuidor separa as **12 cartas de CE**, embaralha e distribui uma a uma, **começando por si próprio** e seguindo pelo jogador à sua esquerda.
2. Cada jogador coloca **2 exércitos em cada CE recebido**.
3. Algumas cartas de CE trazem mais de um território: os exércitos vão **só no território marcado como CE**.
4. Com 2, 3, 4 ou 6 jogadores a divisão é exata (6, 4, 3 ou 2 centros por jogador).

### 4.3 Caso especial: 5 jogadores
1. Distribuem-se só **10 cartas de CE** (2 para cada um). Os jogadores colocam os 2 exércitos em cada CE recebido, como acima.
2. Depois, cada jogador, **na sua vez**, escolhe uma opção:
   - **(a)** pegar uma das **2 cartas de CE restantes** e colocar **2 exércitos** nesse território; ou
   - **(b)** escolher **2 territórios vagos** que **não sejam CE** e **não estejam no mesmo continente**, colocando **1 exército em cada**.
3. Quando as 2 cartas de CE extras acabam, os jogadores seguintes ficam obrigatoriamente com a opção (b).
4. Resultado típico: 2 jogadores ficam com 3 centros e 3 jogadores ficam com 2 centros + 2 territórios comuns ocupados.

> 📘 MANUAL × VÍDEO: o manual acrescenta que, depois que **3 jogadores** escolheram (b), só resta a opção (a), o que garante que as 2 cartas extras sempre sejam distribuídas. O vídeo não tem essa restrição: se 4 ou 5 jogadores escolherem (b), sobram cartas de CE sem dono, e esses CE são ocupados na fase seguinte (4.4) como territórios vagos. Adotada a versão do vídeo; a restrição do manual fica como opção.

> ⚠ A CONFIRMAR: o manual diz "cada jogador, na sua vez", sem dizer quem começa. Use a mesma ordem da distribuição (a partir do distribuidor).

### 4.4 Ocupação dos demais territórios
1. As cartas de CE voltam e são **embaralhadas com as outras 49 cartas** do maço (numéricas e territórios), formando o **monte de compra**, com a face para baixo.
2. O distribuidor coloca **1 exército** num território vago à sua escolha; depois o jogador à sua esquerda, e assim por diante, **até que todos os territórios estejam ocupados**.
3. A fase acaba quando o último território vago é ocupado. Não há exércitos iniciais além desses.
4. **Nenhum território pode ficar vazio** em momento algum do jogo.

### 4.5 Sorteio dos objetivos
1. Com menos de 6 jogadores, **retire as cartas-objetivo** ligadas às cores que não estão em jogo.
2. Cada jogador recebe **1 objetivo** entre os 20 (ou os que sobraram), lê e **não revela** aos adversários.
3. Para iniciantes, o manual recomenda ler todos os objetivos possíveis antes do sorteio.

### 4.6 Primeiro jogador
O **primeiro jogador** é o seguinte (à esquerda) ao que ocupou o último território na seção 4.4. A ordem segue para a esquerda (sentido horário).

---

## 5. Estrutura do turno

### 5.1 Primeira rodada (especial)
A primeira rodada se divide em **duas etapas**, cada uma dando a volta completa na mesa:

- **Etapa 1:** todos os jogadores, em ordem, recebem e colocam **exércitos e bombardeiros** (territórios, CE, maiorias e totalidades).
- **Etapa 2:** todos os jogadores, em ordem, **atacam → deslocam → recebem cartas**, se tiverem direito.

O manual explica que isso serve para equilibrar as forças no início do jogo.

### 5.2 Turno normal (a partir da 2ª rodada)
Cada jogador, na sua vez, sem esperar os adversários colocarem peças, executa **nesta ordem**:

1. **Recebe exércitos** e os coloca em territórios seus (seção 6.1 a 6.4)
2. **Recebe bombardeiros** e os coloca na base aérea (seção 6.5)
3. **Ataca**, se quiser: terrestre e aéreo, em qualquer ordem e quantidade (seção 7)
4. **Desloca** exércitos, se quiser: terrestre e/ou aerotransporte (seção 8)
5. **Recebe cartas**, se conquistou pelo menos 1 território no turno (seção 9.2). Depois da compra, o turno **acaba**.

As cartas de troca podem ser usadas **em qualquer momento da própria jogada** (seção 9.3), fora da ordem acima.

---

## 6. Fase de recebimento

Calcule e aplique:

### 6.1 Exércitos por territórios
```
exercitos = max(3, floor(total_de_territorios_do_jogador / 2))
```
Exemplos do manual: 8 territórios dão 4 exércitos; 11 territórios dão 5.
**Mínimo de 3**, mesmo com menos de 6 territórios.
Esses exércitos podem ser colocados em **qualquer território do jogador**, todos no momento do recebimento.

> O mínimo de 3 vale para esta parcela (territórios). Os bônus de continente e CE são somados a ela.

### 6.2 Bônus por continente (tabela de recebimento)
Para cada continente há **dois níveis de bônus**, verificados **no início da vez** do jogador:

| Condição | Bônus |
|---|---|
| **Totalidade**: dominar **todos** os territórios do continente | bônus "totalidade" |
| **Maioria**: dominar **mais da metade** dos territórios do continente | bônus "maioria" (menor) |

- Vale só um dos dois níveis, o maior que se aplicar.
- Os exércitos de bônus vão **obrigatoriamente em territórios do próprio continente**, todos juntos ou espalhados.
- Valores lidos na tabela impressa no tabuleiro:

| Continente | Territórios | Maioria (mínimo) | Bônus maioria | Bônus totalidade |
|---|---|---|---|---|
| Oceania | 4 | 3 | 2 | 3 |
| América do Sul | 4 | 3 | 2 | 3 |
| África | 6 | 4 | 3 | 4 |
| Europa | 7 | 4 | 5 | 7 |
| América do Norte | 10 | 6 | 5 | 7 |
| Ásia | 12 | 7 | 7 | 10 |

> Os mínimos da tabela batem com "mais da metade" (`floor(n/2) + 1`). Os exemplos do manual confirmam: 3 territórios da Oceania dão 2; a América do Sul inteira dá 3.

### 6.3 Exércitos por centro estratégico
- **+1 exército para cada CE** que o jogador tem no início da vez, colocado **no próprio CE**.

### 6.4 Exemplo do manual
19 territórios (3 deles CE), sendo a **América do Sul inteira** (4) e a **maioria da Oceania** (3):

```
19 / 2 = 9  (territórios)
      + 3   (CE, um em cada CE)
      + 3   (totalidade da América do Sul, na América do Sul)
      + 2   (maioria da Oceania, na Oceania)
      = 17 exércitos
```

### 6.5 Bombardeiros
- **+1 bombardeiro para cada CE** que o jogador tem no início da vez, colocado na **base aérea**.
- Os bombardeiros saem da **caixa** do jogador. O total físico é **10**: se a caixa estiver vazia, o jogador não recebe mais.

> ⚠ A CONFIRMAR: o manual não diz explicitamente o que acontece quando a caixa tem menos bombardeiros que o devido. A leitura natural é receber só os que existem.

---

## 7. Fase de ataques

O jogador pode atacar **quantas vezes quiser**, alternando ataques terrestres e aéreos à vontade. A fase termina quando ele declara que parou.

### 7.1 Ataque terrestre

**Requisitos**
- O território de origem pertence ao atacante e tem **pelo menos 2 exércitos**. Sempre fica 1 **exército de ocupação**, que não ataca.
- O território alvo é **vizinho** da origem (fronteira comum ou linha pontilhada) e pertence a outro jogador.

**Declaração**
Antes de cada ataque, o atacante indica **de qual território** parte e **contra qual**. Exemplo: "México ataca Nova York com 3". Terminado um ataque, pode iniciar outro, da mesma origem ou de outra, contra o mesmo alvo ou outro.

**Quantidade de dados**
| Lado | Dados | Regra |
|---|---|---|
| Atacante (vermelhos) | 1 a 3 | No máximo `min(3, exercitos_na_origem − 1)` |
| Defensor (amarelos) | 1 a 3 | `min(3, exercitos_no_alvo)`. O exército de ocupação **também defende** |

Cada lado rola um dado por exército participante.

**Resolução**
1. Ambos rolam e **ordenam os dados do maior para o menor**.
2. Compare par a par: maior com maior, segundo com segundo, e assim por diante. Dados sem par são ignorados.
3. Em cada par, o lado que perde tira **1 exército**. **Empate favorece a defesa.**

**Exemplos do manual**
| Situação | Ataque | Defesa | Resultado |
|---|---|---|---|
| 4 × 3 exércitos, 3 × 3 dados | 5, 4, 1 | 6, 3, 1 | Atacante perde 2, defensor perde 1. Fica 2 × 2 |
| 3 × 1 exércitos, 2 × 1 dados | 3, 2 | 6 | Só um par: atacante perde **1** |
| 10 × 4 exércitos, 3 × 3 dados | 6, 3, 2 | 5, 4, 2 | Atacante perde 2, defensor perde 1. Fica 8 × 3 |
| em seguida, 3 × 3 dados | 5, 3, 2 | 4, 2, 1 | Defensor perde 3 e o território é conquistado |

### 7.2 Conquista de território
- Quando o alvo fica com **0 exércitos**, o atacante conquista o território.
- O atacante **deve mover** de **1 até N exércitos** da origem para o território conquistado, sendo **N = número de exércitos que participaram do último ataque**. Exemplo: com 2 dados no último ataque, move 1 ou 2.
- O território conquistado nunca fica vazio, e a origem mantém pelo menos 1 exército.
- A partir do território recém-conquistado, o atacante **pode fazer novos ataques** no mesmo turno.

### 7.3 Ataque aéreo (bombardeio)

O ataque aéreo serve para **enfraquecer** as forças inimigas e facilitar um ataque terrestre depois. Ele **nunca conquista**.

**Requisitos**
- O alvo pode estar **em qualquer lugar do mapa**, contíguo ou não a um território do atacante.
- O alvo deve ter **pelo menos 2 exércitos**.
- Os bombardeiros podem vir de duas origens, **que podem ser somadas no mesmo ataque**:
  - **(a) Base aérea (sem cartas):** qualquer quantidade dos bombardeiros que estão na base naquele instante.
  - **(b) Caixa (com cartas):** os bombardeiros vêm da **caixa** do jogador, na quantidade dada pelas cartas (seção 9.3 B). A caixa precisa ter bombardeiros suficientes.
  - Limite: o total de bombardeiros do jogador (base + caixa + em combate) nunca passa de **10**.
- Dica do manual: coloque os bombardeiros ao redor do território atacado para controlar o ataque.

> 📘 MANUAL × VÍDEO: o manual descreve as duas origens como **formas diferentes** de atacar e limita cada ataque ao que existe "na base aérea **ou** na caixa". Adotada a versão do vídeo, que **soma** as duas; a regra do manual fica como opção.

**Dados**
| Dado | Quem rola | Faces (padrão: versão do vídeo) |
|---|---|---|
| Defesa antiaérea | Defensor | `[0, 0, 0, 1, 1, 2]`: 3 lisas, 2 com 1 avião e 1 com 2 aviões (bombardeiros abatidos) |
| Ataque aéreo | Atacante | `[0, 0, 0, 1, 2, 3]`: 3 lisas e 3 com fichas de exército (1, 2, 3 exércitos abatidos) |

> 📘 MANUAL × VÍDEO: o vídeo fala em faces de 1 **ou 2** bombardeiros abatidos; uma foto do dado mostra uma face com 2 aviões. O manual fala em "três faces indicando quantos bombardeiros foram atingidos (1 bombardeiro atingido)", ou seja, `[0,0,0,1,1,1]`. Adotada a versão do vídeo. A distribuição 1, 1, 2 entre as 3 faces com aviões foi uma escolha de projeto, já que o vídeo não a detalha. A versão do manual fica como opção. O dado de ataque aéreo não diverge: `[0,0,0,1,2,3]` nas duas fontes.

**Resolução (repete em ciclos)**
1. O atacante designa quantos bombardeiros atacam e qual território.
2. **O defensor rola o dado antiaéreo.** Face lisa: nada. Face com aviões: o atacante retira esse número de bombardeiros. Se o número passa do que está em combate, saem todos.
3. Se ainda restam bombardeiros, **o atacante rola o dado de ataque aéreo**. Face lisa: nada. Face com fichas de exército: o defensor retira esse número de exércitos, **sem nunca deixar menos de 1** no território (o excesso se perde).
4. Se o alvo ainda tiver **≥ 2 exércitos** e restarem bombardeiros, o atacante escolhe **continuar** (volta ao passo 2) ou **encerrar** o ataque.
5. O ataque termina obrigatoriamente quando:
   - todos os bombardeiros em combate são abatidos; **ou**
   - resta só **1 exército** no território atacado.
6. Bombardeiros abatidos e exércitos destruídos vão para a **caixa** do respectivo jogador.
7. **Bombardeiros que sobraram voltam para a base aérea**, venham da base ou da caixa (por cartas), e **podem ser usados de novo no mesmo turno**.

> 📘 MANUAL × VÍDEO:
> - O manual diz que "esse procedimento continua até que" uma das duas condições do passo 5 aconteça, ou seja, o ataque **não pode ser interrompido**. Adotada a versão do vídeo, em que o atacante pode encerrar entre ciclos.
> - Na regra padrão do manual, os sobreviventes voltam para a **caixa**; o retorno à **base aérea** aparece lá como variante oficial ("aumenta a capacidade ofensiva da força aérea" e encurta o jogo). Adotada a versão do vídeo (retorno à base); o retorno à caixa fica como opção.

**Outras regras**
- O mesmo território pode ser atacado por ar **quantas vezes** o atacante tiver condições, a partir da base ou da caixa.
- O jogador pode fazer **tantos ataques aéreos** quanto quiser e puder.
- O número de bombardeiros em cada ataque não depende de quantos dados se rolam: o dado de ataque aéreo é rolado uma vez por ciclo, e os bombardeiros funcionam como "vidas" contra a antiaérea.

**Opção: regra padrão do manual**
Com `bombersReturnToBase = false`, os sobreviventes voltam para a **caixa**: ficam disponíveis para ataques com cartas, mas não para ataques "da base" até serem recebidos de novo (seção 6.5). O padrão deste documento é `true` (versão do vídeo).

---

## 8. Fase de deslocamento

Depois de encerrar os ataques, o jogador pode reposicionar seus exércitos.

### 8.1 Deslocamento terrestre
- Mover exércitos entre **territórios próprios contíguos**.
- Em cada território fica sempre **pelo menos 1 exército de ocupação**, que nunca se desloca.

### 8.2 Aerotransporte
- Mover exércitos de **um CE próprio para outro CE próprio**, mesmo que não sejam contíguos.
- Vale a mesma regra: a origem mantém pelo menos 1 exército.

### 8.3 Regra de movimento único
- **Cada exército se move no máximo uma vez por turno.**
- Exemplo do manual: com Brasil, Venezuela e México, o jogador pode levar exércitos do Brasil para a Venezuela, mas não pode levar **esses mesmos** exércitos da Venezuela para o México no mesmo turno.
- Não vale combinar aerotransporte com deslocamento terrestre para o mesmo exército:
  - CE → CE e depois para um território adjacente: proibido;
  - território → CE adjacente e depois CE → outro CE: proibido.
- Implementação: controle por turno, em cada território, quantos exércitos "chegaram", e só permita mover `exercitos − chegados − 1`.

> ⚠ A CONFIRMAR: se exércitos que entraram num território por conquista (seção 7.2) podem se mover na fase de deslocamento. O manual não fala disso. No War clássico não podem.

---

## 9. Cartas de troca

### 9.1 Composição do baralho
| Tipo | Qtde | Descrição |
|---|---|---|
| Território / continente | 33 | Território isolado, territórios agrupados ("Alemanha e Polônia") ou continente inteiro ("Oceania"). Ao usar uma carta com mais de um território, o jogador escolhe **um só** |
| … dos quais de CE | 12 | Usadas na preparação (seção 4.2). Depois viram cartas de território comuns. Numa carta agrupada, só o território marcado é o CE |
| Numérica | 28 | Número que soma exércitos ou bombardeiros a uma carta de território |
| **Total** | **61** | |

**Lista das cartas** (extraída da ajuda online do gametrack.com.br, `Ajuda do jogo WAR II - JOGUE ONLINE AGORA!.html`). Cada CE aparece em exatamente uma carta, e a soma dos territórios das 27 cartas de território dá os 43 do mapa.

*Cartas de CE (12):* as que contêm um CE (seção 3.2). Na carta agrupada, o CE é só o território marcado ★.

| Carta | Territórios |
|---|---|
| Nova York | Nova York ★ |
| Labrador, Ottawa, Mackenzie | Ottawa ★, Labrador, Mackenzie |
| Brasil | Brasil ★ |
| França, Inglaterra | Inglaterra ★, França |
| Alemanha, Polônia | Alemanha ★, Polônia |
| Moscou | Moscou ★ |
| Egito | Egito ★ |
| África do Sul | África do Sul ★ |
| Oriente Médio | Oriente Médio ★ |
| China | China ★ |
| Japão | Japão ★ |
| Austrália, Nova Guiné | Austrália ★, Nova Guiné |

*Cartas de território sem CE (15):* Alasca · Califórnia, Vancouver · Groenlândia · México, Cuba · Venezuela (Colômbia) · Peru, Argentina (a ajuda chama de "Argentina Bolívia") · Islândia, Suécia · Argélia · Congo, Sudão, Madagascar · Aral, Omsk · Dudinka, Sibéria · Mongólia, Tchita · Vladivostok · Índia, Vietnã · Bornéu, Sumatra

*Cartas de continente (6):* África · América do Norte · América do Sul · Ásia · Europa · Oceania

*Cartas numéricas (28):*

| Valor | Qtde |
|---|---|
| +2 | 10 |
| +3 | 8 |
| +4 | 6 |
| +5 | 4 |

> ⚠ A CONFIRMAR: na carta de continente, presume-se que o jogador escolhe **um território qualquer** daquele continente, como na carta agrupada.

### 9.2 Compra
- No **fim do turno**, depois dos deslocamentos, quem **conquistou pelo menos 1 território** compra **3 cartas**, seja qual for o número de conquistas.
- **Limite de 5 cartas na mão**: com 3 cartas na mão, compra só 2.
- Sem conquista no turno, não compra nada.
- Depois da compra, o turno acaba.
- O conteúdo das cartas é **secreto** até a troca.
- O jogador pode **descartar cartas** quando quiser, sem precisar usá-las.

### 9.3 Uso
Em **qualquer momento da própria jogada**, o jogador pode usar cartas para **uma** destas finalidades. Cada carta serve para **uma e só uma** finalidade.

**A) Recebimento de exércitos**, quando o território da carta é **do jogador**
- Carta de território sozinha: +1 exército naquele território.
- Com cartas numéricas, **em qualquer quantidade**: 1 + soma das numéricas. Exemplo do manual: Califórnia + numérica 3 = 4 exércitos na Califórnia.

**B) Bombardeiros para ataque aéreo**, quando o território da carta é **de um adversário**
- Carta de território sozinha: 1 bombardeiro **vindo da caixa** para atacar aquele território.
- Com cartas numéricas, em qualquer quantidade: 1 + soma das numéricas. Exemplo do manual: China + numérica 2 + numérica 3 = **6 bombardeiros** contra a China.
- A caixa precisa ter bombardeiros suficientes. Às vezes é preciso esperar que bombardeiros voltem para a caixa, o que acontece quando são abatidos.
- Os bombardeiros das cartas podem se juntar aos da base no mesmo ataque, respeitando o limite de 10.
- Os sobreviventes vão para a **base aérea** do jogador. O ataque segue a seção 7.3.

**C) Transporte de exércitos**
- Descarte **2 cartas de território** de **quaisquer territórios do jogador**.
- Ganha o direito de transportar **qualquer número** de seus exércitos **de um desses territórios para o outro**, a qualquer distância (mantendo 1 de ocupação na origem).

> ⚠ A CONFIRMAR: se um exército transportado por cartas conta para a regra de movimento único (seção 8.3).

Uma carta numérica **não pode** ser usada sozinha: ela sempre acompanha uma carta de território.

### 9.4 Descarte
- As cartas usadas vão para um **monte de descarte**, separado.
- Quando o descarte chega a **10 cartas ou mais**, ele volta para o monte de compra e é **reembaralhado**.

---

## 10. Objetivos

### 10.1 As 20 cartas-objetivo
Transcritas da ajuda online do gametrack.com.br (imagens `obj_01` a `obj_20`).

| # | Objetivo |
|---|---|
| 1–6 | **Destruir totalmente os exércitos** AZUIS / AMARELOS / BRANCOS / VERDES / PRETOS / VERMELHOS. Texto da carta: "se é você quem possui os exércitos [cor] ou se o jogador que o possui for eliminado por um outro jogador, o seu objetivo passa a ser automaticamente conquistar 24 territórios" |
| 7 | Conquistar na totalidade a **América do Norte** e a **África** |
| 8 | Conquistar na totalidade a **Ásia** e a **África** |
| 9 | Conquistar na totalidade a **América do Norte** e a **Oceania** |
| 10 | Conquistar na totalidade a **Ásia** e a **maioria** dos territórios da **Europa** e da **África** |
| 11 | Conquistar na totalidade a **Ásia** e a **América do Sul** |
| 12 | Conquistar na totalidade a **Europa**, a **Oceania** e **outro continente qualquer** |
| 13 | Possuir **50 exércitos no Oriente Médio** |
| 14 | Conquistar **24 territórios** quaisquer |
| 15 | Conquistar **8 centros estratégicos** quaisquer |
| 16 | Conquistar a **maioria** dos territórios da **Europa**, da **Ásia** e da **América do Norte** |
| 17 | Conquistar na totalidade a **América do Sul** e a **Europa** e ter no mínimo **20 exércitos na Alemanha** |
| 18 | Conquistar a **maioria** dos territórios em **4 continentes** quaisquer |
| 19 | Conquistar **5 centros estratégicos** e ter no mínimo **10 exércitos em cada um** |
| 20 | Possuir **20 exércitos em Nova York e no Japão** |

"Maioria" segue a tabela da seção 6.2 (mais da metade dos territórios do continente).

> ⚠ A CONFIRMAR: no objetivo 20, presume-se 20 exércitos **em cada** um dos dois territórios (e não 20 somados).

### 10.2 Mudanças automáticas de objetivo
- Se **outro jogador** eliminar o último exército da cor X, o objetivo "Destruir cor X" **não está cumprido**: ele passa a ser **"Conquistar 24 territórios"**.
- Se o jogador receber o objetivo de destruir **a própria cor**, o objetivo vira **"Conquistar 24 territórios"** desde o início.

> 📘 MANUAL × VÍDEO: essas duas regras vêm do vídeo e não aparecem no manual, mas estão **impressas nas próprias cartas** de destruir cor (seção 10.1), o que as confirma. O manual traz outra: se um jogador ficar reduzido a **1 único território**, seu objetivo passa a ser **"Conquistar 3 Centros Estratégicos quaisquer"**. Adotada a versão do vídeo; a regra dos 3 CE fica como opção, desligada por padrão.
> ⚠ A CONFIRMAR (se a opção dos 3 CE for ligada): se o jogador volta ao objetivo original ao recuperar territórios. A leitura natural do manual ("passa automaticamente") é que a troca é definitiva.

### 10.3 Vitória
- O jogo termina quando um jogador **atinge seu objetivo**. Ele **mostra a carta-objetivo** para comprovar.
- Se um jogador destrói outro e isso era seu objetivo, ele **ganha o jogo** na hora.

> ⚠ A CONFIRMAR: se a vitória vale a qualquer momento, inclusive no turno de outro jogador (por exemplo, quando o objetivo é cumprido pela ação de um terceiro), ou só no próprio turno.

---

## 11. Eliminação de jogadores
- Um jogador sem nenhum território é eliminado.
- Se a eliminação não era o objetivo de quem eliminou (nesse caso ele já teria vencido), o eliminador **recebe as cartas de troca** do eliminado. Pode usá-las na hora, sozinhas ou com as suas, ou guardá-las, desde que **não fique com mais de 5 cartas** na mão (descarta o excesso).
- Bombardeiros, CI e objetivo do eliminado saem do jogo.

---

## 12. Variante: Centro de Informações (CI) e espionagem

Variante opcional do manual, para deixar o jogo mais ágil. Implementar como **módulo opcional**.

### 12.1 Colocação
- Cada jogador tem **1 CI**, que deve ser colocado num território seu na **1ª ou, no máximo, na 2ª rodada**.
- Enquanto o CI não está no tabuleiro, o dono não pode espionar.
- O CI **não é exército de ocupação**, não ataca, não pode ser atacado e **não pode ser destruído**.
- Como os exércitos, o CI só se move na fase de deslocamento (ou por cartas, ver 12.4).

> ⚠ A CONFIRMAR: o que acontece se o jogador não colocar o CI até o fim da 2ª rodada (perde o CI?).

### 12.2 Captura de um CI adversário
Para capturar um CI, conquiste o território onde ele está. Quem captura:
1. Pode **ver as cartas** do dono do CI, sem mostrá-las aos outros.
2. Pode **ver o objetivo** do dono do CI, sem mostrá-lo aos outros.
3. Fica com o CI até ele ser **reconquistado** pelo dono ou capturado por outro adversário, que ganha os mesmos direitos.
4. Pode **movimentar** o CI capturado, seguindo as regras de movimento.

> ⚠ A CONFIRMAR: se os itens 1 e 2 valem uma vez, no momento da captura, ou sempre que o captor quiser enquanto tiver o CI.

### 12.3 Espionagem
- Quem tem o **próprio CI** no tabuleiro e sob seu domínio pode, **na sua vez**, pedir **todas as cartas de troca** (não o objetivo) de **um** adversário e olhá-las em segredo.
- Só **1 adversário por jogada**.
- Quem teve o CI capturado **não espiona** até recuperá-lo.
- Se o jogador comprar cartas ou declarar a jogada encerrada sem espionar, perde a espionagem naquela rodada.

### 12.4 Transporte do CI por cartas
- Descarte **2 cartas de território** de territórios do jogador para levar o CI de um território seu para outro, a qualquer distância.
- As cartas vão para o monte de descarte.

### 12.5 Deslocamento e aerotransporte do CI
- Depois dos ataques, o CI pode ir para **1 território contíguo**, uma única vez por turno (sem encadear).
- O CI pode ir **de um CE para outro CE** por via aérea, com as mesmas proibições de encadeamento da seção 8.3.

---

## 13. Notas para a implementação online

### 13.1 Modelo de dados sugerido
```text
Game        { id, status, players[], currentPlayerIdx, round, phase, firstRoundStage, deck[], discard[], options, log[] }
Player      { id, color, objectiveId, originalObjectiveId, cards[], basePlanes, boxPlanes, eliminated,
              ciTerritoryId, ciHolderId, spiedThisTurn }
Territory   { id, name, continentId, isStrategicCenter, ownerId, armies, arrivedThisTurn }
Continent   { id, name, majorityThreshold, majorityBonus, fullBonus }
Adjacency   { a, b }                     // grafo não direcionado
Card        { id, type: TERRITORY|MULTI|CONTINENT|NUMERIC, territoryIds[], strategicCenterId, value }
Objective   { id, type, params }         // ex.: { type: "DESTROY_COLOR", color: "green" }
AirStrike   { attackerId, targetId, planesFromBase, planesFromBox, planesInCombat, cycles[] }
```

### 13.2 Máquina de estados do turno
```text
SETUP_COLORS → SETUP_DEALER → SETUP_STRATEGIC_CENTERS → [SETUP_5P_CHOICE]
→ SETUP_FILL_TERRITORIES → SETUP_OBJECTIVES
→ ROUND1_RECEIVE (todos) → ROUND1_ACTIONS (todos)
→ loop: RECEIVE_ARMIES → RECEIVE_BOMBERS → ATTACK → MOVE → DRAW_CARDS → próximo jogador
(uso de cartas e espionagem permitidos em qualquer fase da própria jogada)
(verificar vitória e as mudanças automáticas de objetivo após cada mudança de posse)
```

### 13.3 Regras a validar no servidor (servidor autoritativo)
- Território nunca fica com 0 exércitos, exceto no instante da conquista.
- Recebimento: `max(3, floor(territorios/2))` + bônus de continente (no continente) + 1 por CE (no CE); bombardeiros = nº de CE, limitado ao que há na caixa.
- Ataque terrestre: alvo vizinho, origem com ≥ 2 exércitos, dados = `min(3, origem−1)` × `min(3, alvo)`; na conquista, mover de 1 até o nº de dados do último ataque.
- Ataque aéreo: alvo com ≥ 2 exércitos, bombardeiros da base e/ou da caixa (via cartas), total ≤ 10, bombardeio nunca deixa menos de 1, atacante pode encerrar entre ciclos, sobreviventes para a base aérea.
- Movimento único por exército, por turno, sem combinar terra e aerotransporte.
- Cartas: cada carta para uma só finalidade; numéricas só com carta de território; compra só com conquista, 3 cartas, mão ≤ 5; descarte reembaralhado ao chegar a 10.
- Objetivos secretos: o servidor nunca envia a carta-objetivo de um jogador aos outros clientes, exceto ao captor de um CI (variante).
- Dados: gerados **no servidor**, com log auditável.

### 13.4 Parâmetros configuráveis
| Parâmetro | Padrão |
|---|---|
| Faces do dado antiaéreo | `[0,0,0,1,1,2]` (manual: `[0,0,0,1,1,1]`) |
| Faces do dado de ataque aéreo | `[0,0,0,1,2,3]` |
| Tabela de bônus por continente | seção 6.2 |
| Mínimo de recebimento | 3 |
| Bombardeiros por jogador | 10 |
| Cartas compradas por conquista | 3 |
| Limite de cartas na mão | 5 |
| Tamanho do descarte para reembaralhar | 10 |
| 5 jogadores: após 3 escolhas (b), só resta (a) (manual) | desligado |
| Sobreviventes do ataque aéreo voltam para | base aérea (manual: caixa) |
| Somar base + caixa no mesmo ataque aéreo | sim (manual: não) |
| Interromper ataque aéreo entre ciclos | sim (manual: não) |
| Objetivo substituto de "destruir cor" | conquistar 24 territórios (ligado) |
| Objetivo de quem fica com 1 território (manual) | conquistar 3 CE (desligado); a troca é definitiva (§10.2 ⚠) |
| Exércitos que entraram por conquista podem se deslocar (§8.3 ⚠) | não |
| Transporte por cartas conta para o movimento único (§9.3 ⚠) | sim |
| Vitória a qualquer momento, inclusive na vez de outro (§10.3 ⚠) | sim (empate: prioridade ao jogador da vez, depois a ordem da mesa) |
| Variante Centro de Informações | desligada |

Leituras adotadas sem parâmetro: caixa com menos bombardeiros que o devido entrega só os que existem (§6.5 ⚠); carta de continente vale qualquer território do continente (§9.1 ⚠); objetivo 20 exige 20 exércitos em cada território (§10.1 ⚠); empate no dado do distribuidor, só os empatados rolam de novo (§4.1); com 5 jogadores, as escolhas seguem a ordem a partir do distribuidor (§4.3 ⚠).

### 13.5 Propriedade intelectual
"War" e "War II" são marcas da Grow, e o mapa, a arte e os textos das cartas são protegidos. Regras e mecânicas em si não costumam ser protegidas. Para publicar a versão online, use **nome, mapa, arte e textos próprios** e mantenha as mecânicas descritas aqui.
