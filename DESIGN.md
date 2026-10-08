# DESIGN — Oficina

Guia operacional do visual. Leia antes de mexer em qualquer tela. A fonte da verdade
dos valores é [frontend/src/index.css](frontend/src/index.css); aqui ficam os papéis e as regras.

## Conceito

Concreto cinza-quente, filete de latão de 1px como matéria e **uma única luz fria**, que
aparece 2 ou 3 vezes por tela. Só modo escuro: não existe tema claro nem toggle.

- A seleção **nunca preenche**: marca com barra de 3px na base (`.marca`).
- **Um único bloco de cor por tela**: o botão primário.

## Tokens e papéis

Paleta calibrada em AA. **Não recalcular e não ajustar no olho.** Valor novo só depois
de rodar o cálculo de contraste (WCAG) e, para derivados, `color-mix(in oklab)`.

| Token (`@theme`) | Hex | Papel |
|---|---|---|
| `concreto` | `#151412` | fundo de página |
| `bancada` | `#232120` | card, campo |
| `elevado` | `#2E2B26` | hover, o que sobe da bancada |
| `junta` | `#403B33` | borda de card, divisória |
| `junta-forte` | `#726C61` | contorno e filete de controle |
| `latao` / `latao-fraco` | `#B0894C` / `#7D6538` | filete de 1px e contorno |
| `cal` / `cal-2` / `cal-3` | `#F0ECE4` / `#B0A99E` / `#9A9285` | texto primário / secundário / terciário |
| `gelo` | `#5FC4DC` | **cor fixa da marca** |
| `piche` | `#121110` | texto sobre acento claro |
| `ok` / `ok-fundo` | `#86C08E` / `#1E2A20` | sucesso |
| `warn` / `warn-fundo` | `#E3B26A` / `#2E2617` | atenção sem gravidade |
| `danger` / `danger-fundo` | `#E08B77` / `#33201C` | erro |
| `danger-solido` | `#B4472F` | ação destrutiva preenchida |

Viram utilitário do Tailwind: `bg-bancada`, `text-cal-2`, `border-junta`...

**Regras que saíram do cálculo, não do gosto:**
1. `cal-3` é proibido sobre `elevado`. Ali, o terciário vira `cal-2`.
2. Campo em foco não troca de fundo. Foco = filete de acento embaixo.
3. Latão é filete de 1px e contorno. Nunca preenchimento, nunca texto.

## Cor da marca × cor do barbeiro

- **`--color-gelo`** é a marca do produto e não muda nunca. Use-a onde não há uma
  barbearia em contexto: favicon, página de captação, textos legais, cadastro.
- **`--cor-primaria`** é o acento da barbearia exibida. O padrão é o gelo e o valor vem
  de `salons.cor_primaria`, via `useAccent(cor)`. Só uma tela é dona por vez (pilha).
- Tudo que é acento **deriva de `--cor-primaria`**, nunca de um hex:
  `--accent-marca` (o acento como barra, filete e interruptor), `--accent-hover`,
  `--accent-soft`, `--accent-line`, `--accent-ink` (texto na cor do acento), `--ring`
  (anel de foco), `--aresta` (base do botão primário).
- `useAccent` também grava `--cor-primaria-ink`, o texto **sobre** o acento (piche ou cal,
  o que contrastar mais), e `--cor-primaria-contra`, o oposto dela, para onde o hover anda.
  Texto sobre preenchimento de acento é sempre `var(--cor-primaria-ink)` /
  `text-sobre-acento`, **nunca `white`**.
- Utilitários do acento: `bg-acento`, `bg-acento-hover`, `text-acento-texto`,
  `border-acento-filete`, `bg-acento-marca` / `border-acento-marca` /
  `accent-acento-marca`, `text-sobre-acento`.
- **Preenchimento × marca.** `bg-acento` é só preenchimento com texto em cima (botão,
  avatar), e o texto é `text-sobre-acento`. Barra de seleção, filete de foco, interruptor
  ligado, spinner e checkbox usam `acento-marca`.
- **Acento escuro.** Um acento escuro (a Alves usa `#151d29`) some sobre o concreto: barra
  e ícone ficavam em 1,1:1. O `useAccent` calcula `--mix-ink` e `--mix-marca`, a
  porcentagem do acento na mistura oklab com cal, e só desce do teto (78% e 100%) quando
  a mistura não passa: `--accent-ink` ≥ 4,5 e `--accent-marca` ≥ 3 contra concreto,
  bancada e elevado (o cálculo usa 4,6 e 3,1 de folga para o arredondamento). O gelo e as
  cores do onboarding ficam no teto e saem idênticos. Quando o próprio preenchimento não
  passa de 3 contra os fundos, o botão primário ganha um filete de 1px em
  `--accent-marca` (`--acento-contorno`); nas outras cores ele é transparente.
- Limite: com duas tintas, um acento de luminância perto de 0,17 não passa de ~4:1 com
  nenhuma delas. O seletor do onboarding só oferece cores que passam. O campo livre de
  Configurações aceita qualquer hex; o texto, as marcas e o contorno se ajustam.

## Tipografia

Chivo + Chivo Mono (Google Fonts, carregadas em `index.html` só nos pesos 400/600/700).

| Utilitário | Tamanho / entrelinha | Uso |
|---|---|---|
| `text-micro` | 11.5 / 1.3 | legenda mínima |
| `text-apoio` | 13 / 1.45 | rótulo, texto de apoio |
| `text-corpo` | 15 / 1.55 | corpo (padrão do body) |
| `text-card` | 19 / 1.25 | título de card |
| `text-tela` | 26 / 1.15, −0.01em | título de tela |
| `text-grande` | 34 / 1.05, −0.01em | número ou título de destaque |

- Pesos: **400** corpo, **600** ênfase, **700** só display (`.font-display`). Nada no
  meio: `font-medium` cai para 400, porque `--font-weight-medium: 400` está no
  `@theme`. Sem esse override ele valeria 500 e ninguém perceberia.
- **Mono (`.num`) tem um trabalho só: hora, valor, data, duração e telefone.**
  Não use em URL, hex, código de convite, slug ou rótulo. O alias `.tnum` não existe mais.
- **`.num` nunca anda com `.font-display`.** O Chivo Mono só carrega 400 e 600; o 700
  do display sairia como negrito falso. Em número que precisa de peso, use `font-semibold`.

## Forma

- **Raios com significado:** `rounded-chapa` 2px (tag, monograma) · `rounded-controle`
  6px (botão, campo, chip) · `rounded-superficie` 10px (card) · 0 em faixa de página.
  `rounded-full` só em ponto de status e avatar.
- **Sombra:** card não tem. Só o que flutua (modal, toast) usa `shadow-flutua`: aresta
  dura + poço escuro. Nunca borrão cinza.
- **Textura:** o grão de concreto do `body::after`, e a foto de barbearia
  (`public/login-fundo.jpg`), dessaturada e escurecida, como fundo de três lugares: login
  (`.login-foto` + `.login-veu`, que abre no centro), telas do dono e agendamento
  (`<FundoFoto />`, véu uniforme `.veu-denso` de 84%). Onde há texto solto sobre a foto,
  o véu é o denso: com menos, `cal-2` e `cal-3` perdem AA nas lâmpadas. Quem usa
  `<FundoFoto />` põe o conteúdo em `relative z-10` e sem fundo próprio. Nenhuma outra
  textura.
- **Movimento:** firme, sem overshoot. `.anim-pop` é uma subida de 6px.
- **Interruptor é de oficina, não de iOS:** trilho `rounded-controle`, cursor
  `rounded-chapa`. Nada de pílula com bolinha branca.

## Classes

| Classe | O que é |
|---|---|
| `.btn-primary` | acento, texto `--cor-primaria-ink`, aresta de 2px na base. Hover troca o fundo; active afunda 2px. Sem opacity. Com acento escuro, filete de 1px em `--accent-marca`. |
| `.btn-secondary` | contorno `junta-forte`; no hover o contorno vira latão. |
| `.input-base` | fundo bancada, sem caixa, filete embaixo que vira acento no foco (box-shadow). |
| `.card` | bancada, borda junta, raio superfície, sem sombra. |
| `.btn-destrutivo` | vermelho preenchido, mesma mecânica do primário. Existe porque pintar `.btn-primary` de vermelho deixava a aresta da base derivada do **acento**, não do vermelho. |
| `.regua` | rótulo de seção + filete de latão que esvai. Substitui a antiga `.eyebrow`, que foi removida. |
| `.marca` | barra de 3px na base, em `--accent-marca`, que aparece com `aria-pressed="true"` ou `aria-checked="true"`. As telas já setam esses atributos: dá para marcar seleção sem tocar em lógica. |
| `.num` | mono tabular. |

As classes de componente ficam em `@layer components`, **abaixo** dos utilitários:
`card p-8` usa o `p-8`.

## A ponte acabou

Os nomes herdados do SalaoApp (`--bg-body`, `--text-1/2/3`, `--border-md`,
`--radius-sm`, `--shadow-2`, `.tnum`, `.bg-canvas`, `.text-ink`…) **não existem
mais**. Um `grep` por qualquer um deles em `frontend/src` volta vazio, e o bloco
`PONTE` saiu do `index.css`.

- Cor em tela é **utilitário**, nunca `style={{}}` nem `var(--…)` solto.
- Sobrou `style` em cinco lugares, todos com valor que utilitário não expressa:
  a cor escolhida pelo barbeiro (Configurações e Onboarding), o `clamp()` do valor
  no `StatCard` e o `gridTemplateColumns` do Financeiro, nas duas linhas da visão
  mensal. Qualquer `style` novo além desses é dívida.
- A largura da última coluna do Financeiro é dimensionada pelo **pior caso real**,
  não por estimativa: o `CHECK` de preço para em `99999.99`, então `R$ 99.999,99`
  é o número mais largo que o banco aceita, e a coluna cabe ele. `truncate` não
  serviria — dinheiro cortado não é melhor que dinheiro vazando.
- **Atenção ao mexer no `@theme`:** em Tailwind v4 o namespace `--text-*` é
  **tamanho de fonte**. Não crie tokens de cor com esse prefixo.

## Campo e teclado

A regra de 16px em `(pointer: coarse)` fica **fora de qualquer `@layer`**, de
propósito. O iOS dá zoom sozinho ao focar um campo com menos de 16px e o corpo é
15; dentro de `@layer components` um `text-sm` qualquer derrubava a regra —
utilitário vence componente — e o zoom voltava sem ninguém notar. Fora de camada
ela vence todos. A alternativa comum, `maximum-scale=1` no viewport, mata o
pinça-zoom da página inteira e reprova em WCAG 1.4.4.

## Casca, altura e área segura

O painel no celular é uma **casca de altura fixa que não rola**: `h-[100dvh]` com
`overflow-hidden`, em coluna. Quem rola é o `main`; a barra de baixo é o último
item da casca, e não `fixed`. Isso resolve de uma vez o endereço do Safari
aparecendo e sumindo, que com `100vh` deixava a barra flutuando fora da tela.
No computador a casca se desfaz (`md:h-auto md:overflow-visible`) e a rolagem
volta a ser da página.

`dvh`, não `vh`. No Safari do iPhone, `vh` é a tela **com as barras escondidas** —
maior que a área visível. Um cartão de `90vh` não cabe nos `100dvh` da casca, e o
que sobra sai por baixo, justamente onde fica o rodapé do modal.

A área segura entra em três pontos, e cada um por um motivo: `padding-top` na
casca (o recorte da câmera), `padding-bottom` na barra de baixo (o indicador do
iPhone, e é o que faz a barra pintar também a faixa atrás do gesto do Safari) e
`padding-bottom` na camada do modal.

**Todo modal se apoia em `CamadaModal`**, que é um portal para o `body`. Não é
capricho de organização: o `main` é `relative z-10`, ou seja, um contexto de
empilhamento. Dentro dele o `z-50` da camada só vale entre irmãos — para o resto
da página o modal inteiro continua valendo 10, o mesmo da barra de baixo, que vem
depois no DOM e ganha o desempate. O toque no rodapé do modal ia para a barra, e
o "Agendar" não respondia. Fora, no `body`, o `z-50` volta a valer.

Modal novo não repete `fixed inset-0 z-50`: usa `CamadaModal`.

## Vocabulário e copy

- Barbearia, barbeiro, cliente, horário, corte, serviço. Nunca "salão", "beleza",
  "suas clientes". Cliente e dono vão no masculino ("o cliente", "clientes inativos",
  "Bem-vindo"); barbearia segue feminina ("barbearia cadastrada", "Ativa").
- "Salão" saiu de todo texto visível em 14/09/2026 e o feminino, em 15/09/2026, a
  pedido do Ricardo. Nomes técnicos (`salons`, `salon_id`, `salao_publico`, a rota
  `/quero-meu-salao`, as chaves `ABA.inativas`) e comentários ficaram.
- Frases curtas e diretas, sem exclamação, emoji ou diminutivo.
- Botão diz a ação: "Marcar horário", "Confirmar", "Salvar". Não use "Clique aqui" nem "OK".
- Números no formato brasileiro e em mono: `09:30`, `R$ 45` (redondo sem centavos; com centavos, `R$ 79,90`), `12/09`, `40 min`.

## Proibido

- Modo claro, `dark:` ou toggle de tema.
- Hex solto em tela (fora do `@theme`) ou cor nova sem cálculo de contraste.
- Preencher seleção com o acento. Mais de um bloco de cor por tela.
- Latão como fundo ou texto. `cal-3` sobre `elevado`.
- `color: white` / `text-white` sobre acento.
- Sombra em card; sombra cinza borrada; `opacity` como hover ou active.
- Mono fora de hora, valor, data, duração e telefone. Mono junto de `.font-display`.
- Peso 500, 800 ou 900.
- Textura além do grão e da foto de fundo. Foto com véu mais fraco que o `.veu-denso`
  onde houver texto solto. Overshoot, quique ou `scale` em hover.
- Mexer em queries, hooks de dados, RLS, rotas, cálculo de horário, financeiro ou
  validações por causa de design. Se o design exigir, pare e pergunte.

## O que ainda incomoda

Nada disto bloqueia, mas está mapeado:

- **Data por extenso** no recibo do agendamento não leva mono, mas o nome do
  serviço na mesma tabela também não: as duas linhas declaram `mono: false`. Se
  entrar linha nova no recibo, decida explicitamente.
- **Lint limpo desde 15/09/2026** (era 7 erros e 5 avisos), conferido de novo em
  25/09/2026. O que carrega é deduzido do dado que já chegou — `salonInfo` no
  contexto, `carregadoDe` em Clientes, `dadosMes` no Financeiro —, e efeito não
  chama função que guarda estado. Mantenha assim: `npm run lint` tem de sair em
  zero.
- **A barra de baixo tem rótulo curto próprio** (`curto` em `navItems`):
  "Agenda" e "Ajustes". Item novo com nome longo precisa do seu, senão o
  `truncate` corta a palavra.