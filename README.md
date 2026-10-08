# SaaS Barbearia — Documentação

**Sistema de gestão e agendamento online para barbearias** · atualizado em 25 de setembro de 2026

> Este documento descreve o sistema **como ele funciona hoje**, apurado no código de `frontend/src`
> e no banco do projeto Supabase da barbearia. O que ainda não existe está marcado como
> pendência, não como funcionalidade.
>
> **Sobre os nomes:** o projeto nasceu de uma base de sistema para salões. A tela já é toda de
> barbearia; o que ficou do nome antigo são os **identificadores técnicos** — tabela `salons`,
> coluna `salon_id`, funções como `salao_publico`, a rota `/quero-meu-salao` — que ninguém vê.
> Onde aparece `salons` / `salon_id`, leia "barbearia" (ver 12.4).

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack](#2-stack)
3. [Estrutura do projeto](#3-estrutura-do-projeto)
4. [Perfis de acesso](#4-perfis-de-acesso)
5. [Funcionalidades](#5-funcionalidades)
6. [Rotas](#6-rotas)
7. [Banco de dados](#7-banco-de-dados)
8. [Regras de negócio](#8-regras-de-negócio)
9. [Segurança](#9-segurança)
10. [Como rodar localmente](#10-como-rodar-localmente)
11. [Deploy](#11-deploy)
12. [Pendências conhecidas](#12-pendências-conhecidas)

---

## 1. Visão geral

Plataforma web **multi-tenant**: um único código e um único banco atendem várias barbearias, cada
uma com seus dados isolados **no próprio banco de dados** (Row Level Security do Postgres), e não
apenas na interface.

Cada barbearia tem um endereço próprio identificado por um *slug* — por exemplo
`/barbearia-do-ze` — que serve de vitrine e de link de agendamento para os clientes.

O sistema atende três públicos:

- **Dono da barbearia** — agenda, clientes, financeiro, serviços e horários de funcionamento
- **Cliente** — vê a vitrine, cria conta, marca e cancela horários
- **Administrador da plataforma** — emite convites, ativa/bloqueia barbearias e libera módulos

**Um profissional por barbearia.** Ainda não existe cadastro de barbeiros: a agenda é única por
barbearia, sem divisão por profissional, comissão ou escala individual.

---

## 2. Stack

### Frontend

| Tecnologia | Versão | Uso |
| --- | --- | --- |
| [React](https://react.dev) | 19.2 | Interface (JavaScript + JSX, sem TypeScript) |
| [Vite](https://vite.dev) | 8.0 | Servidor de desenvolvimento e build |
| [Tailwind CSS](https://tailwindcss.com) | 4.3 | Estilos, via plugin `@tailwindcss/vite` e tokens CSS próprios |
| [React Router](https://reactrouter.com) | 7.15 | Rotas da SPA (`react-router-dom`) |
| [supabase-js](https://supabase.com/docs/reference/javascript) | 2.106 | Auth, consultas, RPC e realtime |
| [lucide-react](https://lucide.dev) | 1.16 | Ícones |
| [react-hot-toast](https://react-hot-toast.com) | 2.6 | Notificações na tela |
| [ESLint](https://eslint.org) | 10.4 | Lint, com regras de React Hooks e React Refresh |
| TanStack Query | 5.100 | **Instalado, mas não utilizado** no código |

**Tipografia:** Bricolage Grotesque (títulos) e Instrument Sans (texto), carregadas do Google
Fonts em `frontend/index.html`.

### Backend — Supabase

Não há servidor próprio: o frontend conversa direto com o Supabase.

| Serviço | Uso |
| --- | --- |
| **PostgreSQL 17** | Dados, regras de negócio em funções `SECURITY DEFINER`, triggers e RLS |
| **Supabase Auth** | Login por e-mail e senha para donos, clientes e administradores |
| **PostgREST** | API automática das tabelas (`/rest/v1/`) e das funções (`/rest/v1/rpc/`) |
| **Realtime** | Atualização ao vivo da agenda e do dashboard |

Região **sa-east-1 (São Paulo)**.

### Hospedagem

**Vercel**, servindo a pasta `frontend` como SPA (`frontend/vercel.json`).

---

## 3. Estrutura do projeto

```
saas-barbearia/
├── docs/                       Documentos de apoio
├── supabase/
│   ├── schema.sql              Retrato do schema, fonte de verdade do banco
│   ├── migrations/             Histórico de alterações de banco
│   └── README.md               Regras de versionamento do banco
└── frontend/
    ├── .env                    Chaves do Supabase (não versionado)
    ├── index.html
    ├── vercel.json             Rewrite de SPA
    └── src/
        ├── main.jsx            Entrada: ErrorBoundary, Router, AuthProvider, Toaster
        ├── App.jsx             Rotas e guardas de acesso
        ├── index.css           Tokens de design da direção "Oficina" e utilitários
        ├── legal.js            Versão vigente dos Termos
        ├── context/
        │   └── AuthContext.jsx Sessão, barbearia do dono e módulos liberados
        ├── lib/
        │   ├── supabase.js     Cliente Supabase
        │   ├── agenda.js       Formatação de data, hora, duração e moeda
        │   └── contato.js      WhatsApp comercial e de suporte
        ├── hooks/
        │   ├── useAccent.js    Cor da marca da barbearia exibida
        │   └── useConfirmacao.js  Confirmação em dois toques
        ├── utils/slug.js       Gera o slug a partir do nome
        ├── components/
        │   ├── layout/DashboardLayout.jsx   Menu lateral e barra inferior
        │   ├── ui/             Modal, StatCard, StatusBadge, EmptyState, Skeleton…
        │   ├── AvisoLegal.jsx  Aviso e aceite dos Termos
        │   └── ErrorBoundary.jsx
        └── pages/
            ├── auth/           Login, cadastro da barbearia, cadastro de cliente
            ├── lead/           Página de interesse ("quero meu sistema")
            ├── onboarding/     Configuração inicial da barbearia
            ├── dashboard/      Painel inicial e tela de bloqueio
            ├── agendamentos/   Agenda
            ├── clientes/       Carteira de clientes
            ├── financeiro/     Receita e indicadores
            ├── configuracoes/  Perfil, serviços, horários e dias especiais
            ├── estoque/        Produtos, entradas e saídas
            ├── public/         Vitrine e agendamento online
            ├── cliente/        Área do cliente
            ├── admin/          Painel da plataforma e convites
            └── legal/          Termos de Uso e Privacidade
```

---

## 4. Perfis de acesso

| Perfil | Como é identificado | O que acessa |
| --- | --- | --- |
| **Administrador da plataforma** | Registro ativo em `plataforma_admins`, verificado pela função `eh_admin()` no banco | `/admin` — convites, barbearias, situação e módulos. **Nunca** dados de clientes |
| **Dono da barbearia** | Conta cujo `id` é o `dono_id` de uma barbearia | Painel da própria barbearia |
| **Cliente** | Conta com `user_metadata.role = 'cliente'` | Vitrine, agendamento online e `/minha-conta` |

Depois do login, o sistema direciona automaticamente: administrador → `/admin`; cliente →
`/minha-conta`; dono → dashboard da barbearia, ou `/onboarding` se ainda não configurou.

Uma mesma conta de cliente serve para **várias barbearias**: ela tem uma ficha separada em cada
barbearia onde agenda, e cada barbearia só enxerga o histórico feito nela.

---

## 5. Funcionalidades

### 5.1 Entrada de novas barbearias

O cadastro **não é aberto**: criar uma barbearia exige um **convite** emitido pelo administrador.

**Página de interesse — `/quero-meu-salao`**
Apresenta o sistema e abre o WhatsApp comercial com uma mensagem pronta, personalizada com o nome
da pessoa e da barbearia (campos opcionais). O número fica em `src/lib/contato.js`.

**Cadastro — `/cadastro`**
- Código do convite no formato `XXXX-XXXX`, conferido enquanto a pessoa digita
- Link pronto `/cadastro?convite=CODIGO` já preenche o campo
- Nome da barbearia, e-mail e senha (mínimo 8 caracteres)
- Aceite obrigatório dos Termos de Uso e da Política de Privacidade, com data e versão gravadas
- A barbearia é criada pela função `criar_salao_com_convite`, que consome o convite

Se a confirmação de e-mail estiver ligada no Supabase, a barbearia é criada no primeiro acesso ao
onboarding, usando o convite guardado na conta.

**Onboarding — `/onboarding`**, em três etapas:

1. **Dados** — nome, link único (slug) e WhatsApp
2. **Visual** — cor da marca (6 sugestões ou cor personalizada), com prévia de como o cliente verá
3. **Serviços** — cadastro do primeiro serviço (nome e preço)

Ao final mostra o link público da barbearia e um botão para compartilhar no WhatsApp.

### 5.2 Painel da barbearia

Todas as telas ficam sob `/:slug/…`, com menu lateral no computador e barra inferior no celular.

#### Dashboard — `/:slug/dashboard`

- Saudação e data do dia
- **Agendamentos hoje** — atendimentos confirmados do dia
- **Receita do dia** — soma do que já foi atendido, com o valor ainda previsto para o resto do dia
- **Estoque baixo** — itens com quantidade no mínimo ou abaixo. Só aparece quando o módulo
  `estoque` está liberado e ativo; desligado, o cartão some e a consulta nem é feita
- **Clientes inativos** — sem agendamento nos últimos 60 dias
- **Link de agendamento** com botão de copiar
- Lista dos atendimentos do dia
- Atualização em tempo real quando entra ou muda um agendamento

#### Agenda — `/:slug/agendamentos`

- Fita com os próximos 7 dias
- Atendimentos do dia: horário, cliente, serviço, valor e telefone clicável
- **Cancelar** atendimento, com confirmação em dois toques
- **Horários livres** em intervalos de 30 minutos, agrupados em Manhã, Tarde e Fim de tarde.
  Só entra na lista o horário em que o serviço **cabe inteiro**: termina até o fechamento e não
  encosta em nenhum atendimento nem no almoço. Sem serviço escolhido, vale o mais curto da
  barbearia — aparece ali o que algum cliente conseguiria marcar pelo link, nem mais nem menos
- **Dia que já passou** não oferece horário livre nem atalho para agendar. O formulário aberto
  num dia passado nasce com a data de hoje
- **Almoço do dia** — muda o intervalo só naquela data (outro horário, outra duração, ou nenhum
  almoço), sem mexer no padrão de Configurações. O almoço entra na conta dos horários livres
  como se fosse um atendimento
- **Novo agendamento** (pelo botão ou tocando num horário livre):
  - nome e telefone do cliente, serviço, data, horário e observações
  - mostra o horário previsto de término
  - procura a ficha do cliente pelo telefone e cria uma se não existir; se o telefone já está
    cadastrado com outro nome, pede confirmação
  - nasce com situação **confirmado**
  - **Repetir** transforma a marcação em **horário fixo** (toda semana, a cada 2 ou a cada 4
    semanas). Exige telefone, porque o fixo fica na ficha do cliente
- **Horário fixo** — o atendimento que veio de um fixo tem atalho para a janela do fixo, com a
  descrição ("toda sexta às 18:00") e o botão de **encerrar**, que libera as datas futuras
- Atualização em tempo real

#### Clientes — `/:slug/clientes`

- Cartões com nome, telefone, e-mail, número de visitas e data da última visita
- Busca por nome ou telefone
- Filtros: **Todos**, **Frequentes** (3 visitas ou mais) e **Inativos** (última visita há mais de 60 dias)
- Cadastrar, editar e excluir cliente
- Atalho para abrir conversa no WhatsApp

#### Financeiro — `/:slug/financeiro`

Todos os números vêm dos agendamentos **confirmados**; não há lançamento manual.

- **Hoje:** receita realizada (+ previsto), atendimentos realizados, ticket médio e total do mês
- **Atendimentos de hoje** com cliente, serviço e valor
- **Visão mensal** com navegação entre meses: total, atendimentos, ticket médio e lista detalhada,
  com os atendimentos futuros marcados como "previsto"
- **Indicadores gerais:** melhor dia da semana e serviço mais realizado (últimos 90 dias), receita
  dos últimos 30 e 90 dias

#### Configurações — `/:slug/configuracoes`

| Aba | O que faz |
| --- | --- |
| **Perfil** | Nome da barbearia e cor da marca (seletor ou código HEX), com prévia ao vivo |
| **Serviços** | Adicionar (nome, preço, duração), editar, ativar/desativar e excluir |
| **Horários** | Para cada dia da semana: aberto ou fechado, horário de abertura e de fechamento. Mais o **almoço padrão** e o calendário de **dias especiais** (abaixo) |

**Almoço padrão** (aba Horários): horário de início e duração do intervalo, o mesmo para todo dia
aberto. Antes de salvar, a tela procura clientes já marcados dentro do almoço novo e pede
confirmação em vez de gravar por cima — dia que tenha almoço próprio (Agenda → Almoço do dia) não
entra nessa conta, porque lá vale o do dia.

**Dias especiais** (aba Horários): calendário do mês com o número de atendimentos por dia. Cada
dia pode seguir a semana, fechar ou ter horário próprio. A escolha é **de vários dias de uma vez**
— tocar marca e desmarca, **Mês todo** pega os dias do mês visível que ainda dão para configurar,
e o salvamento é uma única ida ao banco. A tela avisa quais atendimentos já marcados ficariam de
fora da escolha antes de gravar.

#### Estoque — `/:slug/estoque`

Módulo contratável: o item só aparece no menu quando o módulo `estoque` está **liberado pela
plataforma e ativo**.

- **Lucro do mês** (sobre o total vendido), **parado em estoque** (pelo preço de custo) e
  **abaixo do mínimo**
- **Produtos** com categoria, preço de venda, margem, saldo e mínimo; cadastrar, editar e excluir
- **Entrada** e **saída** por produto, gravadas pelas funções `estoque_entrada` e `estoque_saida`,
  que mexem no saldo e registram a venda na mesma transação
- **Saídas do mês** com data, produto, quantidade, valor e lucro

As categorias são de revenda de barbearia — pomada, gel, shampoo, barba, lâmina, bebida,
vestuário, acessório e outro.

#### Barbearia bloqueada

Quando o administrador desativa a barbearia, o painel inteiro é substituído por um aviso de
acesso suspenso, com botão para falar com o suporte pelo WhatsApp. O bloqueio também vale no
banco: os dados deixam de responder pela API.

### 5.3 Página pública e agendamento online

#### Vitrine — `/:slug`

Página aberta, sem login:

- Nome e monograma da barbearia, com a cor da marca
- Lista de serviços ativos com duração e preço
- Faixa de atendimento (da menor abertura ao maior fechamento da semana)
- Botão **Agendar horário**

Se quem acessa é o próprio dono logado, vai direto para o dashboard. Barbearia desativada ou slug
inexistente mostra "não encontrado".

#### Agendamento — `/:slug/agendar`

1. **Entrar ou criar conta de cliente** na própria página (nome, e-mail, senha, telefone).
   Conta de dono de barbearia é recusada aqui.
2. **Início:** escolher entre *Marcar horário* e *Meus agendamentos*.
3. **Marcar horário**, em três etapas:
   - **Serviço** — lista com duração e preço
   - **Horário** — fita com 14 dias e horários livres. Só aparecem horários em que o serviço
     inteiro cabe antes do fechamento e não colide com outro atendimento
   - **Confirmar** — resumo com serviço, data, horário, duração e valor, e campo de observações
4. Tela de sucesso com o comprovante do agendamento.

O navegador informa **só qual serviço e quando**: o preço e o nome do serviço são buscados no
banco pela função `criar_agendamento_cliente`, e o agendamento nasce como **pendente**. Se outra
pessoa reservou o mesmo horário no mesmo instante, o cliente recebe um aviso e volta para escolher
outro.

*Meus agendamentos* mostra os horários do cliente naquela barbearia: próximos (com opção de
cancelar) e histórico.

### 5.4 Área do cliente — `/minha-conta`

- Agendamentos do cliente em **todas as barbearias** onde ele tem ficha
- Próximos horários, com cancelamento
- Histórico
- Atalho para marcar novo horário na última barbearia usada

O cliente só pode cancelar horários **próprios**, **futuros** e ainda pendentes ou confirmados.

**Cadastro avulso de cliente — `/cadastro-cliente`**: nome, e-mail, senha e WhatsApp.

### 5.5 Painel da plataforma — `/admin`

Exclusivo do administrador, verificado no banco a cada acesso.

**Convites**
- Gerar convite com anotação opcional ("para quem") e validade de 5 minutos, 30 minutos ou 4 horas
- O link `/cadastro?convite=…` é copiado automaticamente para mandar no WhatsApp
- Lista dos últimos convites com contagem regressiva, quem usou e em qual barbearia virou
- Cada código serve **uma única vez**

**Barbearias**
- Cartões com nome, slug, e-mail do dono, situação e indicadores de módulos
- Busca por nome, slug ou e-mail
- Painel de detalhes de cada barbearia:
  - **Abrir o painel desta barbearia:** entra no painel do dono em modo observação (abaixo)
  - **Situação:** desativar (com confirmação) ou reativar
  - **Módulos:** liberar ou retirar cada módulo
  - **Histórico:** as 20 últimas alterações feitas pela plataforma, com data e hora

**Modo observação.** `admin_observar_salao(id)` grava a barbearia observada em `admin_observando`
(uma linha por admin) e o painel do dono passa a abrir com os dados dela — agenda, clientes e
caixa, como o dono vê, inclusive com a barbearia desativada, que é justamente o caso de suporte.
É **somente leitura**, e a garantia está no banco, não na tela: `get_salon_id()` devolve a
barbearia observada e sustenta as policies de SELECT, enquanto as de escrita usam
`get_salon_id_proprio()`, que só conhece a barbearia do próprio dono. Uma tarja fixa no topo diz
quem está sendo observado e leva de volta ao `/admin`, e tanto a entrada quanto a saída entram
em `auditoria_admin`.

Fora do modo observação, o painel **não** mostra clientes, agendamentos nem valores das
barbearias: as funções `admin_*` não devolvem dado de cliente final. A observação é a exceção
deliberada — existe para atender um dono que pediu ajuda, não escreve nada e deixa rastro.

### 5.6 Páginas legais

- `/termos` — Termos de Uso
- `/privacidade` — Política de Privacidade

O dono aceita os termos com checkbox no cadastro (contrato com a plataforma). O cliente recebe um
aviso em texto, sem checkbox: marcar horário é execução de contrato com a barbearia (LGPD, art.
7º, V), e o que se exige ali é transparência. A versão vigente fica em `src/legal.js`.

### 5.7 Recursos gerais

- **Tema único escuro** — a direção "Oficina" não tem modo claro nem botão de troca, por decisão
  de design registrada em [DESIGN.md](DESIGN.md)
- **Cor da marca por barbearia**, aplicada em botões, seleções e destaques (`--cor-primaria`)
- **Layout responsivo:** menu lateral no computador, barra de navegação inferior no celular
- **Confirmação em dois toques** para ações destrutivas, que desarma sozinha após 3,5 segundos
- **Tela de erro amigável** (`ErrorBoundary`) no lugar de página em branco
- **Notificações** de sucesso e erro em todas as ações

---

## 6. Rotas

Definidas em `frontend/src/App.jsx`.

| Rota | Acesso | Tela |
| --- | --- | --- |
| `/` | Pública | Redireciona para `/login` |
| `/login` | Pública | Entrada |
| `/cadastro` | Pública (exige convite) | Cadastro da barbearia |
| `/cadastro-cliente` | Pública | Cadastro de cliente |
| `/quero-meu-salao` | Pública | Página de interesse |
| `/termos` · `/privacidade` | Pública | Páginas legais |
| `/admin` | Administrador | Painel da plataforma |
| `/onboarding` | Dono | Configuração inicial |
| `/:slug` | Pública | Vitrine (ou dashboard, se for o dono) |
| `/:slug/dashboard` | Dono | Dashboard |
| `/:slug/agendamentos` | Dono | Agenda |
| `/:slug/clientes` | Dono | Clientes |
| `/:slug/financeiro` | Dono | Financeiro |
| `/:slug/configuracoes` | Dono | Configurações |
| `/:slug/estoque` | Dono + módulo liberado | Estoque |
| `/:slug/agendar` | Pública; agendar exige conta de cliente | Agendamento online |
| `/minha-conta` | Logado | Área do cliente |

**Guardas de acesso:**

| Guarda | Regra |
| --- | --- |
| `PrivateRoute` | Exige sessão; com `adminOnly`, manda clientes para `/minha-conta` |
| `PlataformaAdminRoute` | Consulta `eh_admin()` no banco; quem não é admin volta para `/` |
| `SalaoAtivoRoute` | Barbearia desativada vê a tela de bloqueio |
| `ModuloRoute` | Só abre a rota com o módulo liberado e ativo |

As rotas fixas (`/admin`, `/termos`, `/quero-meu-salao`…) são declaradas antes de `/:slug`. Por
isso uma barbearia não pode usar esses nomes como slug, o que `slug_reservado()` recusa no cadastro.

---

## 7. Banco de dados

15 tabelas no schema `public`, **todas com RLS ativa**.

### 7.1 Relações

```
salons (barbearias) ──┬── servicos
                      ├── horarios
                      ├── horarios_fixos ── agendamentos (fixo_id)
                      ├── clientes ──── auth.users
                      ├── agendamentos ── (clientes, servicos)
                      ├── salon_modulos
                      ├── convites
                      ├── dias_especiais
                      ├── pausas_dia
                      ├── auditoria_admin
                      ├── admin_observando ── auth.users
                      └── estoque ── vendas ── clientes

plataforma_admins ── auth.users
```

### 7.2 Tabelas

| Tabela | Conteúdo | Campos principais |
| --- | --- | --- |
| `salons` | Barbearias | `slug`, `nome`, `dono_id`, `dono_email`, `cor_primaria` (padrão `#1F2937`), `whatsapp`, `plano`, `ativo`, `termos_aceitos_em`, `termos_versao` |
| `servicos` | Serviços oferecidos | `nome`, `preco`, `duracao` em minutos (padrão 30), `ativo` |
| `horarios` | Funcionamento semanal | `dia_semana` (0 = domingo), `abertura`, `fechamento`, `ativo`, `pausa_inicio` e `pausa_minutos` (almoço padrão) — uma linha por dia |
| `pausas_dia` | Almoço mudado só para uma data (outro horário, outra duração, ou sem almoço) | `data` (única por barbearia), `inicio`, `minutos` — os dois nulos querem dizer "sem almoço neste dia" |
| `horarios_fixos` | Horário fixo de um cliente (toda sexta 18:00, por exemplo). Cria agendamentos de verdade até 3 meses à frente, que a trava de conflito protege | `cliente_id`, `servico_id`, `data_inicio`, `hora`, `intervalo_semanas` (1, 2 ou 4), `ativo`, `gerado_ate` |
| `dias_especiais` | Exceções ao horário semanal (feriado, dia com horário diferente) | `data` (única por barbearia), `fechado`, `abertura`, `fechamento` — fechado não tem horário; aberto tem os dois |
| `clientes` | Ficha do cliente em cada barbearia | `nome`, `telefone`, `email`, `observacoes` (anotação interna), `auth_user_id` |
| `agendamentos` | Atendimentos | `data_hora`, `servico_id`, `servico` (nome copiado), `valor` (preço copiado), `status`, `forma_pag`, `observacoes` |
| `salon_modulos` | Módulos por barbearia | `modulo`, `disponivel` (plataforma decide), `ativo` (dono decide) |
| `convites` | Convites de cadastro | `codigo`, `nota`, `expira_em`, `usado_por`, `usado_em`, `salon_id` |
| `plataforma_admins` | Administradores | `user_id`, `nome`, `ativo` |
| `auditoria_admin` | Histórico do painel | `admin_id`, `salon_id`, `acao`, `detalhe` (JSON) |
| `admin_observando` | Qual barbearia o admin está observando no momento | `admin_id` (chave: uma por admin), `salon_id`, `iniciado_em` |
| `estoque` | Produtos | `nome`, `categoria`, `quantidade`, `quantidade_minima`, `preco_custo`, `preco_venda` |
| `vendas` | Venda de produtos | `produto_id`, `cliente_id`, `quantidade`, `valor_total`, `custo_total`, `data_venda`, `forma_pag` |

**Valores permitidos:**

| Campo | Valores |
| --- | --- |
| `agendamentos.status` | `pendente`, `confirmado`, `concluido`, `cancelado`, `faltou` |
| `agendamentos.forma_pag` | `dinheiro`, `pix`, `cartao` |
| `salon_modulos.modulo` | `agendamento_online`, `estoque`, `financeiro` |
| `estoque.categoria` | `pomada`, `gel`, `shampoo`, `barba`, `lamina`, `outro` |

### 7.3 Funções (RPC)

Todas `SECURITY DEFINER`: rodam com permissão elevada e fazem a própria checagem de quem pode o quê.

| Grupo | Função | O que faz |
| --- | --- | --- |
| **Isolamento** | `get_salon_id()` | Barbearia da sessão, **só se ativa**: a observada pelo admin, ou a do próprio dono. Base das policies de leitura |
| | `get_salon_id_proprio()` | Só a barbearia do próprio dono. Base das policies de **escrita**, e o que torna o modo observação somente leitura |
| | `eh_admin()` | Diz se o usuário é administrador ativo |
| | `salao_atual()` | Barbearia que o painel deve abrir e se é observação |
| **Públicas** | `salao_publico(slug)` | Dados públicos da barbearia ativa: id, slug, nome, cor, logo |
| | `slug_disponivel(slug)` | Diz se o slug está livre (considera barbearias desativadas) |
| | `slug_reservado(slug)` | Diz se o slug bate com nome de rota (`login`, `admin`, `agendar`…) |
| | `salao_ativo(salon_id)` | Diz se a barbearia está ativa; usada nas policies da vitrine |
| | `horarios_ocupados(salon_id, inicio, fim)` | Intervalos ocupados — atendimentos **e o almoço** —, **sem** cliente, serviço ou valor |
| | `vitrine_servicos(slug)` | Serviços ativos da barbearia, para a vitrine |
| | `vitrine_horarios(slug)` | Funcionamento semanal, para a vitrine |
| | `vitrine_dias_especiais(slug, desde?)` | Exceções futuras do calendário, para a vitrine |
| | `modulo_liberado(slug, modulo)` | Diz se o módulo está liberado e ativo |
| | `convite_valido(codigo)` | Diz se o convite existe, não foi usado e está no prazo |
| **Cadastro** | `criar_salao_com_convite(...)` | **Única forma de criar barbearia.** Valida e consome o convite na mesma transação |
| **Cliente** | `criar_agendamento_cliente(...)` | Cria o agendamento com preço do banco, cria/atualiza a ficha, status `pendente`. Recusa horário que encoste no almoço e gera antes as datas de horário fixo que entraram na janela |
| | `meus_agendamentos(salon_id?)` | Agendamentos do próprio cliente; sem parâmetro, de todas as barbearias |
| | `cancelar_meu_agendamento(id)` | Cancela horário próprio, futuro, pendente ou confirmado |
| **Horário** | `expediente_do_dia(salon_id, dia)` | Abertura e fechamento de uma data: dia especial, senão a semana, senão o padrão |
| | `pausa_do_dia(salon_id, dia)` | Almoço de uma data: `pausas_dia`, senão o padrão de `horarios`, senão nenhum |
| | `horario_padrao(dia_semana)` | Funcionamento de fábrica de um dia da semana |
| **Horário fixo** | `criar_horario_fixo(...)` | Cria a regra e já reserva as datas até o limite de 3 meses |
| | `gerar_agendamentos_fixos(salon_id, fixo?)` | Cria as datas que entraram na janela; pula fechado, almoço e horário já ocupado |
| | `gerar_meus_horarios_fixos()` | O mesmo, para a barbearia do dono logado; chamada ao abrir a Agenda |
| | `encerrar_horario_fixo(id)` | Encerra a regra e cancela as datas futuras dela |
| **Estoque** | `estoque_entrada(produto, qtd, custo?)` | Soma ao saldo e atualiza o preço de custo |
| | `estoque_saida(produto, qtd, forma_pag?, cliente?)` | Baixa o saldo e grava a venda, com custo, na mesma transação |
| **Admin** | `admin_gerar_convite(nota, minutos)` | Emite convite (1 min a 24 h; padrão 5 min) |
| | `admin_listar_convites(limite)` | Convites emitidos, com quem usou |
| | `admin_listar_saloes()` | Lista de barbearias com seus módulos |
| | `admin_definir_situacao_salao(id, ativo)` | Ativa ou bloqueia a barbearia, com auditoria |
| | `admin_definir_modulo(id, modulo, disponivel)` | Libera ou retira módulo, com auditoria |
| | `admin_observar_salao(id)` | Entra no modo observação daquela barbearia, com auditoria |
| | `admin_encerrar_observacao()` | Sai do modo observação, com auditoria |
| | `admin_auditoria_salao(id, limite)` | Histórico de alterações da barbearia |
| **Triggers** | `seed_modulos_novo_salao()` | Cria as linhas de módulos quando nasce uma barbearia |
| | `seed_horarios_novo_salao()` | Cria o funcionamento semanal de fábrica |
| | `preenche_duracao_agendamento()` | Copia a duração do serviço para o agendamento — é o que a congela |
| | `valida_conflito_agendamento()` | Impede dois atendimentos no mesmo horário |
| | `valida_limite_agendamento()` | Recusa agendamento a mais de 3 meses à frente |
| | `rls_auto_enable()` | Liga RLS automaticamente em toda tabela nova do schema `public` |

---

## 8. Regras de negócio

**Receita é o que foi confirmado e já aconteceu.** Dashboard e Financeiro somam só agendamentos
`confirmado`. O que tem `data_hora` no passado é **realizado**; no futuro, **previsto**. Os dois
nunca são somados no mesmo número.

**O preço é congelado na marcação.** `agendamentos.valor` recebe o preço do serviço naquele
momento. Reajustar um serviço não altera o faturamento passado.

**A duração também é congelada.** `agendamentos.duracao` é preenchida na marcação pelo trigger
`preenche_duracao_agendamento`, que copia a duração vigente do serviço (30 minutos se não houver).
Mudar a duração de um serviço não mexe mais no término de agendamentos já marcados.

**Não existe horário duplo.** O trigger `valida_conflito_agendamento` trava a agenda da barbearia
durante a gravação, calcula a sobreposição usando a duração do serviço (30 minutos se não houver) e
recusa o segundo agendamento. A garantia está no banco: vale mesmo com dois clientes confirmando no
mesmo instante.

**Situação do agendamento:**

| Situação | Quando nasce | Entra na receita |
| --- | --- | --- |
| `confirmado` | Marcado pelo dono na agenda | Sim |
| `pendente` | Marcado pelo cliente no agendamento online | **Não** (ver 12.1) |
| `cancelado` | Cancelado pelo dono ou pelo cliente | Não |
| `faltou` / `concluido` | Existem no banco, sem botão na interface | Não |

**Horários livres** são gerados em blocos de 30 minutos dentro do horário de funcionamento, e só
entram na lista os blocos em que o **serviço inteiro cabe**: termina até o fechamento e não
encosta em atendimento nem no almoço. É a mesma conta na tela do cliente, na agenda do dono e no
banco — antes a agenda do dono olhava só meia hora e oferecia 09:00 para um corte de uma hora com
cliente marcado às 09:30, que o banco recusava na hora de gravar.

**O funcionamento de uma data tem três camadas**, resolvidas por `expediente_do_dia`: o dia
especial daquela data, senão o dia da semana em `horarios`, senão o padrão de fábrica (9h às 18h).
O almoço segue o mesmo desenho em `pausa_do_dia`: a data em `pausas_dia`, senão o padrão de
`horarios`, senão nenhum.

**O almoço fecha o horário para o cliente, não para o dono.** `horarios_ocupados` devolve a pausa
como se fosse um atendimento, então ela some da tela do cliente, e `criar_agendamento_cliente`
recusa quem chamar a API direto. O dono continua podendo encaixar alguém no próprio almoço pela
agenda.

**Horário fixo reserva com agendamento de verdade.** A regra fica em `horarios_fixos`, mas o que
segura a agenda são linhas em `agendamentos`, uma por data, até o limite de 3 meses. Assim o
trigger de conflito protege o horário sem mudar nada, e Agenda, Dashboard e Financeiro enxergam
cada data como um atendimento comum. A janela anda um dia por dia: as datas novas nascem quando o
dono abre a Agenda e, antes disso, quando um cliente marca pelo link — é o que impede o link de
pegar a sexta que acabou de entrar na janela. Data cancelada não volta a ser criada: é o dono
dizendo "essa sexta ele não vem".

**Agendamento só até 3 meses à frente**, recusado no banco por `valida_limite_agendamento`.

**Visitas do cliente** são contadas pelos agendamentos confirmados. Frequente = 3 ou mais;
inativo = última visita há mais de 60 dias.

**Módulos em dois níveis.** A plataforma decide se o módulo está **disponível** (comercial); o dono
decide se quer usá-lo (**ativo**). Só funciona quando os dois são verdadeiros.

**Convite de uso único.** O convite é travado (`for update`) durante a criação da barbearia: em
dois cadastros simultâneos com o mesmo código, só um passa. A validade curta cobre o código que
vazou antes de ser usado.

---

## 9. Segurança

**Isolamento entre barbearias no banco.** As tabelas da barbearia (`agendamentos`, `clientes`,
`servicos`, `horarios`, `horarios_fixos`, `dias_especiais`, `pausas_dia`, `estoque`, `vendas`)
têm policy por `salon_id` em leitura e escrita. Mesmo com erro na interface, o banco não devolve
nem aceita linha de outra barbearia.

**Leitura e escrita usam funções diferentes.** As policies de SELECT comparam com
`get_salon_id()`, que aceita a barbearia observada pelo admin; as de INSERT, UPDATE e DELETE
comparam com `get_salon_id_proprio()`, que só conhece a barbearia do próprio dono. É daí que sai
a garantia de que o modo observação é somente leitura — não é a tela que se contém, é o banco que
recusa. `horarios_fixos` vai além e não tem policy de escrita nenhuma: só as funções
`criar_horario_fixo` e `encerrar_horario_fixo` gravam ali.

**Bloqueio real.** `get_salon_id()` só devolve barbearia **ativa**. Desativar no `/admin` corta o
acesso a todas as tabelas de uma vez, sem mexer em policy nenhuma.

**O cliente não acessa tabelas.** Todo acesso do cliente passa pelas três funções da seção 7.3.
Assim ele não consegue:
- gravar um preço diferente do cadastrado
- agendar serviço de outra barbearia
- ler ou alterar as anotações internas (`clientes.observacoes`)
- mudar valor ou data ao cancelar

**Vitrine pública controlada.** Visitantes sem login leem apenas serviços ativos e horários de
barbearias ativas, e os dados da barbearia só pela projeção de `salao_publico`.

**Criação de barbearia só por convite.** Não há policy de INSERT em `salons`: a única porta é
`criar_salao_com_convite`.

**Administrador sem acesso amplo.** O painel usa apenas as funções `admin_*`, que conferem
`eh_admin()` e não devolvem dados de clientes. `convites`, `plataforma_admins` e `auditoria_admin`
têm RLS ativa e nenhuma policy, ou seja, ficam fechadas para acesso direto.

**Chaves.** O frontend usa só a chave pública (`anon`). A chave `service_role`, que ignora RLS,
nunca vai para o frontend.

---

## 10. Como rodar localmente

**Pré-requisitos:** Node.js 20.19 ou superior (testado com 24) e acesso ao projeto Supabase.

```bash
cd frontend
npm install
```

Crie o arquivo **`frontend/.env`** — dentro de `frontend/`, e não na raiz, senão o Vite não
encontra as variáveis e a tela fica em branco:

```env
VITE_SUPABASE_URL=https://<id-do-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<chave anon do painel do Supabase>
```

Só essas duas variáveis são usadas. As demais do `.env.example` (Stripe, Resend, Z-API) ainda não
existem no código.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em `http://localhost:5173` |
| `npm run build` | Build de produção em `frontend/dist` |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | Verificação com ESLint |

O Vite só lê o `.env` ao iniciar: depois de alterar o arquivo, reinicie o `npm run dev`.

### Primeiro acesso num banco vazio

Criar barbearia exige convite, e emitir convite exige ser administrador. Para sair desse ciclo, no
SQL Editor do Supabase:

```sql
-- 1. Convite inicial, válido por 1 dia
insert into convites (codigo, expira_em)
values ('PRIM-EIRO', now() + interval '1 day');
```

Crie a conta em `/cadastro?convite=PRIM-EIRO` e depois torne-a administradora:

```sql
-- 2. Tornar a conta administradora da plataforma
insert into plataforma_admins (user_id, nome, ativo)
select id, 'Seu nome', true from auth.users where email = 'seu@email.com';
```

---

## 11. Deploy

- **Vercel**, com *Root Directory* = `frontend`
- Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas no painel da Vercel
- `frontend/vercel.json` redireciona todas as rotas para `index.html`. Sem ele, recarregar uma
  página interna (como `/barbearia-do-ze/agendamentos`) dá erro 404
- Depois do deploy, cadastrar a URL em **Authentication → URL Configuration** (*Site URL* e
  *Redirect URLs*) no Supabase
- Projeto no plano gratuito do Supabase **pausa após 7 dias sem uso**: o site parece quebrado sem
  nada ter mudado. Reativar pelo painel

Repositório: [github.com/RicardoMacarios/saas-barbearia](https://github.com/RicardoMacarios/saas-barbearia)

---

## 12. Pendências conhecidas

Em ordem de impacto.

### 12.1 Agendamento online nunca é confirmado

O cliente agenda como `pendente`, mas a agenda do dono não tem botão para confirmar. Na prática,
esses atendimentos **não entram** na receita, no dashboard nem na contagem de visitas. Além disso,
o selo de situação (`StatusBadge`) mostra `pendente` e `faltou` com o texto "confirmado".

### 12.2 Faltam ações na agenda

Não há como marcar **falta**, **concluído** ou **forma de pagamento**, nem editar o valor de um
atendimento, embora o banco aceite esses dados.

### 12.3 Sem cadastro de barbeiros

A agenda é única por barbearia. Barbearias com mais de um profissional precisam de cadastro de
barbeiros, agenda por profissional e, possivelmente, comissão.

### 12.4 Vocabulário técnico ainda é de salão

O produto inteiro já é barbearia — tela, vocabulário, marca e a direção "Oficina" descrita em
[DESIGN.md](DESIGN.md). O que sobrou é **nome técnico**, que não aparece para ninguém: a tabela
`salons`, a coluna `salon_id`, funções como `salao_publico` e `salao_atual`, a rota
`/quero-meu-salao` e os comentários no código.

A rota **não muda**: rota é escopo travado, porque link já compartilhado quebra. Renomear as
tabelas é possível, mas é uma migration grande em troca de nada que o usuário veja.

### 12.5 Módulos que não restringem nada

Só `estoque` bloqueia rota e cartão de dashboard. `agendamento_online` e `financeiro` existem em
`salon_modulos` e aparecem no `/admin`, mas desligá-los não muda nada na interface — a página
pública de agendamento continua abrindo e o Financeiro continua no menu.

### 12.6 Outros

- **Nenhum teste automatizado**, em especial o de isolamento entre barbearias
- **Textos legais em rascunho**, com campos `[PREENCHER]` (razão social, CNPJ, e-mail, comarca) e
  sem revisão jurídica
- **Fuso horário fixo** (`America/Sao_Paulo` e fuso do navegador); não há fuso por barbearia
- **Proteção contra senha vazada** e **confirmação de e-mail** a decidir no painel de Auth do Supabase
- **TanStack Query** instalado sem uso
- **`schema.sql` montado por introspecção**, não por `pg_dump`: cobre o schema `public` inteiro,
  mas não traz extensões nem o schema `auth`. Ver `supabase/README.md`

### 12.7 Resolvido desde a revisão de 10 de setembro

| Era | Onde está agora |
| --- | --- |
| Tempo real desligado no banco | `agendamentos` entrou na publicação `supabase_realtime` |
| 15 funções internas chamáveis sem login | Os 36 `revoke execute` do schema são `from public` |
| Duração não congelada | `agendamentos.duracao` e o trigger `preenche_duracao_agendamento` |
| Slug podia colidir com nome de rota | `slug_reservado(slug)`, com mensagem própria no cadastro |
| `/admin` com rótulos de módulos inexistentes | Só os três que o banco aceita |
| Tela de Clientes com uma consulta por cliente | Uma leitura paginada da carteira inteira |
| Estoque sem tela | Tela de produtos, entradas, saídas e lucro do mês (ver 5.2) |
| `schema.sql` herdado da base original | Regerado do projeto Supabase em 25/09/2026 |
