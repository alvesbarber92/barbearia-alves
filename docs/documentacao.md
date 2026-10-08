# BarberVez — Documentação Técnica

**Como o sistema funciona hoje** · 8 de setembro de 2026

> Este documento descreve o sistema **como ele está construído**. Funcionalidades planejadas
> e ainda não implementadas foram retiradas — o que está escrito aqui existe no banco ou no
> código.
>
> **Herdado do SalaoApp.** Este documento veio na cópia e descreve o sistema como ele
> era na origem. O projeto Supabase citado abaixo é o **do SalaoApp**, não o desta
> barbearia — a apuração não foi refeita aqui.
>
> **Método:** apurado diretamente no projeto Supabase do SalaoApp
> (`information_schema`, `pg_policies`, `pg_proc`, linter de segurança) e no código em
> `frontend/src`.
>
> ⚠️ **Documento histórico. Não use para saber o que o sistema faz hoje.**
> Em 25/9/2026 ele descreve um sistema que já não existe: são 10 tabelas aqui
> contra 15 no banco, e 22 funções contra 41.
>
> **O que mudou desde 8/9/2026,** só o que contradiz o texto abaixo:
> a duração do serviço passou a ser congelada (`agendamentos.duracao`); os slugs
> reservados viraram função no banco; `salons.dono_email` deixou de existir (o
> e-mail do dono vem de `auth.users` por `dono_id`); nasceram `dias_especiais`,
> `pausas_dia` (almoço), `horarios_fixos` (cliente com dia e hora reservados) e
> `admin_observando` (modo observação do admin); estoque e vendas deixaram de
> ser tabelas reservadas e ganharam tela, o que aposenta a seção 10 inteira;
> a escrita passou a checar `get_salon_id_proprio()` em vez de `get_salon_id()`;
> e o tema claro saiu — a direção visual é só escura. A seção 11 lista como
> pendente várias coisas já resolvidas.
>
> **Para o estado atual, leia [o README](../README.md)** — apurado em
> 25/9/2026, cobre banco, telas, regras e segurança. Para o banco em detalhe,
> `supabase/README.md` e `supabase/schema.sql`; para o que falta,
> `docs/PROXIMOS-PASSOS.md`; para o visual, `DESIGN.md`.
>
> **O que ainda tem valor aqui** é o *porquê* de decisões que o README só
> registra: por que a view `salons_public` virou função (4.9), por que o cliente
> não acessa tabela (9.2), por que privilégio de coluna não separava dona de
> cliente, e o roteiro de verificação de segurança de 9.5.

## Sumário

1. Visão geral
2. Perfis de acesso
3. Rotas
4. Modelo de dados
5. Regras de negócio
6. Telas internas
7. Página pública e área da cliente
8. Painel da plataforma
9. Segurança
10. Tabelas reservadas: estoque e vendas
11. Pendências e riscos conhecidos
12. Ambiente e deploy

---

## 1. Visão geral

Plataforma web multi-tenant de gestão para salões de beleza de pequeno porte. Um único código
e um único banco atendem todos os salões, com isolamento garantido no nível do banco de dados.
Cada salão acessa por uma URL própria identificada por um slug.

O sistema tem hoje seis telas internas (Dashboard, Agenda, Clientes, Financeiro,
Configurações e Estoque), uma tela de onboarding, uma vitrine pública, uma página pública de
agendamento, uma área para a cliente logada e um painel da plataforma.

**Um profissional por salão.** O sistema não modela profissionais como entidade: cada salão
opera com um profissional implícito. Não há divisão de agenda, escala individual nem preço por
profissional.

### 1.1 Sistema de design "Camarim"

O frontend tem sistema de design próprio, com referência à luz de espelho de camarim.

- **Fontes:** Bodoni Moda (títulos, preços, horas) e Hanken Grotesk (corpo), carregadas no `index.html`
- **Temas:** Marfim/Porcelana no claro, Backstage no escuro
- **Acento por salão:** `--cor-primaria`, lida do registro do salão e aplicada como variável CSS. Os derivados (`--accent-ink`, `--accent-soft`, `--accent-line`, `--glow-accent`) são calculados por `color-mix`, funcionando com qualquer cor escolhida
- **Tokens** em `src/index.css`, registrados no Tailwind via `@theme inline`; componentes em `src/components/ui/`
- **Assinatura visual:** seleções acendem com brilho quente; arco de espelho nos medalhões e cartões (`--radius-arch`)
- **Utilitários:** `.btn-primary`, `.btn-secondary`, `.day-pill`, `.slot-chip`, `.eyebrow`, `.step-enter`, `.pop-in`

Verificado: não há nenhuma cor de paleta do Tailwind fixa no código (`bg-gray-*`, `text-pink-*`
e equivalentes). Todas as telas consomem os tokens.

---

## 2. Perfis de acesso

| Perfil | Autenticação | Acesso |
| --- | --- | --- |
| Administrador da plataforma | E-mail e senha, registrado em `plataforma_admins` | Painel `/admin`: salões, situação e módulos. Sem acesso a dados de clientes |
| Proprietária | E-mail e senha | Todas as telas do próprio salão |
| Cliente do salão | E-mail e senha | Agendamento público e os próprios horários em `/minha-conta` |

A separação entre proprietária e cliente é feita por `user_metadata.role` no frontend
(`PrivateRoute adminOnly`) e reforçada pelas policies de RLS no banco. O administrador é
verificado pela RPC `eh_admin()`, no banco — nunca só na interface.

---

## 3. Rotas

Definidas em `frontend/src/App.jsx`.

| Rota | Acesso | Tela |
| --- | --- | --- |
| `/` | Pública | Redireciona para `/login` |
| `/login` | Pública | Entrada |
| `/cadastro` | Pública | Cadastro de salão |
| `/cadastro-cliente` | Pública | Cadastro de cliente |
| `/termos` | Pública | Termos de Uso |
| `/privacidade` | Pública | Política de Privacidade |
| `/admin` | `eh_admin()` | Painel da plataforma |
| `/onboarding` | Proprietária | Criação do salão |
| `/:slug` | Pública | Vitrine do salão, ou dashboard se quem acessa é a dona |
| `/:slug/dashboard` | Proprietária | Painel inicial |
| `/:slug/agendamentos` | Proprietária | Agenda |
| `/:slug/clientes` | Proprietária | Clientes |
| `/:slug/estoque` | Proprietária + módulo | Espaço reservado |
| `/:slug/financeiro` | Proprietária | Financeiro |
| `/:slug/configuracoes` | Proprietária | Configurações |
| `/:slug/agendar` | Cliente | Agendamento público |
| `/minha-conta` | Cliente | Área da cliente |

Três guardas controlam o acesso:

- **`PrivateRoute`** — exige sessão; com `adminOnly`, exclui quem tem papel de cliente
- **`PlataformaAdminRoute`** — consulta `eh_admin()` e redireciona em silêncio quem não é administrador
- **`ModuloRoute`** — só monta a rota quando `disponivel and ativo`; sem o módulo, devolve ao dashboard sem mensagem

**Precedência de `/admin`:** a rota é declarada antes de `/:slug`, então tem prioridade. Um
salão cujo slug fosse `admin` ficaria inacessível, sem efeito sobre a segurança do painel.

**Vitrine × dashboard em `/:slug`:** o componente `SalonHome` compara o slug da URL com o do
salão da sessão. Se for a dona, redireciona para o dashboard; caso contrário, mostra a vitrine
pública.

---

## 4. Modelo de dados

Dez tabelas, sem view, todas com RLS ativa.

**O schema está no repositório desde 8 de setembro de 2026**, em `supabase/`:
`schema.sql` é o retrato completo e a fonte de verdade, e `migrations/` guarda as alterações
incrementais. Antes disso o schema existia só no painel do Supabase, e código e banco não
viajavam juntos — um commit podia chegar exigindo coluna inexistente, ou uma alteração no banco
podia quebrar o código do repositório sem que o Git registrasse a causa.

**A história de migrations é incompleta e não dá replay.** `salon_modulos`,
`plataforma_admins`, `auditoria_admin`, `eh_admin` e as funções `admin_*` foram criadas à mão
pelo painel e não estão em migration nenhuma; as mais antigas foram superadas (as primeiras
policies identificavam a cliente pelo `telefone` do JWT). Para criar ambiente novo, aplica-se
`schema.sql`, não o replay. Ver `supabase/README.md`.

### 4.1 Relações

```
salons ──┬── servicos
         ├── clientes ── auth.users
         ├── horarios
         ├── agendamentos ── (cliente, servico)
         ├── salon_modulos
         ├── auditoria_admin
         └── estoque ── vendas ── clientes     (reservadas, sem uso — ver seção 10)

plataforma_admins ── auth.users
```

### 4.2 salons

| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid PK | Identificador |
| slug | text | URL amigável |
| nome | text | Nome de exibição |
| dono_id | uuid | Proprietária; base do isolamento |
| dono_email | text | E-mail da proprietária |
| cor_primaria | text | Cor HEX do tema |
| logo_url | text | Caminho da logo |
| plano | text | Plano contratado |
| whatsapp | text | Contato exibido na vitrine |
| horario_resumo | text | Texto livre de horário, para a vitrine |
| ativo | boolean | Desativação sem perda de histórico |
| termos_aceitos_em | timestamptz | Momento do aceite dos Termos pela proprietária; nulo nos cadastros anteriores à exigência |
| termos_versao | text | Versão do texto legal aceita |
| criado_em | timestamptz | Data de cadastro |

Os módulos habilitados não ficam nesta tabela, e sim em `salon_modulos`.

**Por que a versão fica junto da data:** registrar só que houve aceite prova o clique, não o
texto. Com a versão gravada, é possível dizer depois qual redação a proprietária leu — o que é
o que importa quando uma cláusula é questionada. A versão vive em `frontend/src/legal.js`
(`TERMOS_VERSAO`) e muda a cada alteração de conteúdo das páginas legais.

### 4.3 servicos

| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid PK | Identificador |
| salon_id | uuid FK | Salão |
| nome | text | Nome do serviço |
| duracao | integer | Duração em minutos |
| preco | numeric | Preço vigente |
| ativo | boolean | Desativação lógica |
| criado_em | timestamptz | Data de cadastro |

Serviço não é apagado: agendamentos passados apontam para ele. Desativar tira das listas de
marcação e preserva o histórico.

### 4.4 clientes

| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid PK | Identificador |
| salon_id | uuid FK | Salão |
| auth_user_id | uuid | Conta de acesso; nulo quando a ficha foi criada pelo salão |
| nome | text | Nome |
| telefone | text | Telefone |
| email | text | E-mail |
| observacoes | text | Anotação interna do salão |
| criado_em | timestamptz | Primeiro cadastro |

**A ficha é por salão, a conta é única.** A mesma pessoa que frequenta dois salões tem uma
conta de acesso e uma ficha em cada salão. Cada salão enxerga apenas o histórico feito nele.

### 4.5 agendamentos

| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid PK | Identificador |
| salon_id | uuid FK | Salão |
| cliente_id | uuid FK | Cliente |
| servico_id | uuid FK | Serviço |
| servico | text | Nome do serviço, copiado na marcação |
| data_hora | timestamptz | Início do atendimento |
| status | text | `pendente` \| `confirmado` \| `cancelado` \| `faltou` |
| valor | numeric | Preço congelado no momento da marcação |
| forma_pag | text | Forma de pagamento |
| observacoes | text | Notas do atendimento |
| criado_em | timestamptz | Momento da marcação |

**Não existe coluna de término.** O fim do atendimento é calculado nas consultas, somando
`servicos.duracao` a `data_hora`.

**O valor é congelado na marcação.** O financeiro soma `agendamentos.valor`, nunca o preço
vigente em `servicos` — reajustar um serviço não reescreve o faturamento passado.

### 4.6 horarios

Escala de funcionamento **do salão**, uma linha por dia da semana.

| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid PK | Identificador |
| salon_id | uuid FK | Salão |
| dia_semana | smallint | Dia da semana |
| abertura | time | Início do expediente |
| fechamento | time | Fim do expediente |
| ativo | boolean | Dia sem expediente quando falso |
| criado_em | timestamptz | Data de cadastro |

Não há intervalo de almoço nem bloqueio pontual de período.

### 4.7 salon_modulos

Controla quais módulos estão habilitados em cada salão, em **dois níveis independentes**.

| Campo | Tipo | Quem controla | Significado |
| --- | --- | --- | --- |
| salon_id | uuid FK | — | Salão |
| modulo | text | — | `agendamento_online`, `estoque`, `financeiro` |
| disponivel | boolean | Administrador | O salão contratou ou recebeu acesso |
| ativo | boolean | Proprietária | O salão quer usar agora |
| atualizado_em | timestamptz | — | Última alteração |

A verificação em toda a aplicação é uma só: `disponivel and ativo`.

**Por que dois níveis:** a disponibilidade é decisão comercial e pertence à plataforma; a
ativação é preferência de operação e pertence ao salão. Com um campo só, administrador e
proprietária disputariam o mesmo botão. Separados, a proprietária nunca liga o que não
contratou e a plataforma nunca impõe na tela dela algo que ela não quer usar.

Novos salões recebem as linhas automaticamente, pela função `seed_modulos_novo_salao()`.

### 4.8 plataforma_admins e auditoria_admin

```sql
plataforma_admins (user_id uuid PK, nome text, ativo boolean, criado_em timestamptz)
auditoria_admin   (id uuid PK, admin_id uuid, salon_id uuid, acao text,
                   detalhe jsonb, criado_em timestamptz)
```

Toda alteração feita pelo painel grava uma linha em `auditoria_admin`. O registro é somente de
inserção. As duas tabelas têm RLS ativa e nenhuma policy, o que as fecha para acesso direto:
apenas as funções `SECURITY DEFINER` do painel conseguem lê-las.

### 4.8b convites

```sql
convites (codigo text PK, nota text, criado_em timestamptz, expira_em timestamptz,
          criado_por uuid, usado_em timestamptz, usado_por uuid, salon_id uuid)
```

Criar salão exige um convite emitido no `/admin`. Como `plataforma_admins` e
`auditoria_admin`, a tabela tem RLS ativa e **nenhuma policy** — ninguém a lê nem escreve
direto, tudo passa pelas funções `SECURITY DEFINER`.

Dois mecanismos contra compartilhamento, com finalidades distintas:

- **Uso único.** `usado_por` é gravado na mesma transação que cria o salão, sob
  `select ... for update`. Em dois cadastros simultâneos com o mesmo código, o segundo
  espera o primeiro terminar e encontra o convite consumido. É o que torna inútil um
  código repassado adiante.
- **Validade.** `expira_em` cobre o outro caso — o código que vazou e ainda **não** foi
  usado. O prazo é parâmetro de `admin_gerar_convite` (5 minutos por padrão), então
  afrouxar não exige migration.

O código tem o formato `XXXX-XXXX`, sorteado num alfabeto sem `I`, `O`, `0` e `1`, porque
ele é ditado por telefone e por WhatsApp.

### 4.9 Não há view

Existia uma view `salons_public` com a projeção pública do salão. Ela era `SECURITY DEFINER`,
único ERROR do linter, e foi **removida em 8 de setembro de 2026**, substituída pelas funções
`salao_publico(slug)` e `slug_disponivel(slug)` (ver 4.10 e 9.4).

**Por que não bastou trocar para `security_invoker`:** a projeção precisa ser legível sem login
e também pela cliente logada. Com a view aplicando as permissões de quem consulta, seria
necessária uma policy de leitura pública em `salons` — e como a dona e a cliente são as duas o
papel `authenticated`, essa policy entregaria a qualquer usuário logado colunas como
`dono_email` e `plano`. Privilégio de coluna não separa os dois públicos, porque é concedido
por papel. Função com a projeção declarada no corpo resolve: o que sai está escrito no código
da função.

### 4.10 Funções no banco

Todas `SECURITY DEFINER`.

| Função | Papel |
| --- | --- |
| `get_salon_id()` | Resolve o salão da sessão por `dono_id = auth.uid()` **e `ativo`**. Base do isolamento e do bloqueio: salão desativado devolve nulo, e as seis tabelas do salão negam |
| `eh_admin()` | Verifica se a conta está em `plataforma_admins` e ativa |
| `horarios_ocupados(salon_id, inicio, fim)` | Intervalos ocupados do salão. Chamável sem login |
| `modulo_liberado(slug, modulo)` | Verifica `disponivel and ativo`. Chamável sem login |
| `salao_publico(slug)` | Projeção pública do salão, só se `ativo`. Chamável sem login |
| `slug_disponivel(slug)` | Slug livre para cadastro. Considera também salões desativados. Chamável sem login |
| `salao_ativo(salon_id)` | Diz se o salão está ativo. Existe para as policies de vitrine poderem checar isso sem tocar em `salons`, que o `anon` não lê. Chamável sem login |
| `convite_valido(codigo)` | Diz se o convite existe, não foi usado e está no prazo. Só cortesia da tela de cadastro; quem decide é a função abaixo. Chamável sem login |
| `criar_salao_com_convite(nome, slug, codigo, whatsapp, aceite, versao)` | **Única porta de criação de salão.** Exige convite não usado e no prazo, consome-o na mesma transação, e recusa quem já tem salão |
| `admin_gerar_convite(nota, minutos)` | Emite um código. Exige `eh_admin()` |
| `admin_listar_convites(limite)` | Convites emitidos, com quem usou e em que salão virou. Exige `eh_admin()` |
| `criar_agendamento_cliente(salon_id, servico_id, data_hora, nome, telefone, obs)` | Marcação pela cliente: resolve preço e nome do serviço no servidor, garante a ficha e insere como `pendente` |
| `meus_agendamentos(salon_id)` | Agendamentos da própria cliente, com nome e slug do salão. Sem `salon_id`, traz todos os salões dela |
| `cancelar_meu_agendamento(id)` | Cancelamento pela cliente. Só altera o status |
| `valida_conflito_agendamento()` | Trigger de prevenção de horário sobreposto. `EXECUTE` revogado |
| `seed_modulos_novo_salao()` | Cria as linhas de módulo de um salão novo. `EXECUTE` revogado |
| `salons_resolve_dono_id()` | Resolve o `dono_id` no cadastro do salão. `EXECUTE` revogado |
| `admin_listar_saloes()` | Lista para o painel |
| `admin_definir_modulo(salon_id, modulo, disponivel)` | Liga e desliga módulo, com auditoria |
| `admin_definir_situacao_salao(salon_id, ativo)` | Ativa e desativa salão, com auditoria |
| `admin_auditoria_salao(salon_id, limite)` | Histórico de alterações de um salão |

**Sobre o `EXECUTE` revogado das três últimas:** são funções de trigger, disparadas pelo
Postgres, que não confere `EXECUTE` no momento do disparo — o privilégio é verificado na
criação do trigger. Estavam chamáveis por `anon` em `/rest/v1/rpc/` sem necessidade nenhuma, e
`salons_resolve_dono_id` lê `auth.users`. Verificado com teste que criou salão como
`authenticated`: os dois triggers continuam disparando.

**Sobre o `EXECUTE` das funções da cliente:** o Postgres concede `EXECUTE` a `PUBLIC` por
padrão em toda função criada, então conceder a `authenticated` não exclui o `anon`. As três
funções de sessão têm o privilégio revogado de `public` e de `anon` explicitamente.

---

## 5. Regras de negócio

### 5.1 Reconhecimento de receita

O agendamento entra no financeiro na data em que o atendimento acontece, e não na data em que
foi marcado. Um agendamento criado em 24 de agosto para 10 de setembro soma na receita de
setembro.

Não existe passo manual de conclusão: o sistema apura pelo campo `data_hora`. A proprietária só
age na exceção — marcar falta ou cancelar.

```sql
select coalesce(sum(valor), 0) as receita
from agendamentos
where salon_id = $1
  and status not in ('cancelado', 'faltou')
  and data_hora >= $2
  and data_hora <  $3;
```

**Critério de confiança:** o número exibido tem que bater com o dinheiro do caixa. Agendamento
cancelado ou com falta nunca entra na receita realizada.

### 5.2 Realizado e previsto

| Indicador | Definição |
| --- | --- |
| Realizado | `data_hora` já passada, excluindo cancelados e faltas |
| Previsto | `data_hora` no futuro, excluindo cancelados |

Os dois números não são somados no mesmo total: a separação permite enxergar quanto já entrou e
quanto está marcado adiante, sem confundir expectativa com caixa.

### 5.3 Situação do agendamento

| Situação | Quando ocorre | Conta na receita |
| --- | --- | --- |
| `pendente` | Toda marcação feita pela cliente na página pública | Sim |
| `confirmado` | Marcação feita pelo salão | Sim |
| `cancelado` | Desmarcado pelo salão ou pela própria cliente | Não |
| `faltou` | Cliente não compareceu | Não |

Marcação feita pela cliente nasce **obrigatoriamente** como `pendente` — o valor é escrito pela
função `criar_agendamento_cliente`, não recebido do navegador. Marcação feita pelo salão nasce
`confirmado`.

### 5.4 Prevenção de horário sobreposto

Com marcação por dois canais — interno e link público — duas clientes podem confirmar o mesmo
horário simultaneamente. A garantia está no banco, não no frontend.

O trigger `valida_conflito_agendamento`:

1. Ignora registros com `status = 'cancelado'`
2. Serializa com `pg_advisory_xact_lock` sobre o `salon_id`
3. Resolve a duração por join com `servicos.duracao`, com 30 minutos de padrão
4. Verifica sobreposição e levanta `P0001` com mensagem legível

A segunda transação concorrente falha no banco e a aplicação traduz o erro em mensagem para a
usuária. O advisory lock é **por salão inteiro**: marcações simultâneas em horários diferentes
do mesmo salão se enfileiram.

### 5.5 Cálculo do horário de término

O término é calculado a cada consulta, somando a `duracao` vigente do serviço à `data_hora`.
Como não é congelado, **alterar a duração de um serviço muda retroativamente o término de
agendamentos já marcados**.

---

## 6. Telas internas

Todas sob `/:slug`, dentro do `DashboardLayout` (barra lateral), restritas à proprietária.

### 6.1 Dashboard

Painel inicial. Lê `agendamentos` (do dia, contagens e receita), `clientes` (total) e
`estoque` (alerta de quantidade abaixo do mínimo).

> O alerta de estoque baixo consulta uma tabela que nenhuma tela alimenta — ver seção 10.

### 6.2 Agenda

Tela de uso diário. Lê `agendamentos`, `servicos` e `horarios`; escreve em `agendamentos` e
cria fichas em `clientes` na marcação.

- Agendamentos do dia em ordem cronológica, com horário, cliente, serviço e valor
- Navegação entre dias e indicação dos horários livres
- Novo agendamento, criado como `confirmado`
- Editar valor do agendamento, sem afetar o preço cadastrado do serviço
- Cancelar e marcar falta

### 6.3 Clientes

Cadastro do salão. Lê e escreve `clientes`, e lê `agendamentos` para o histórico de cada
pessoa.

### 6.4 Financeiro

Todos os números derivam de `agendamentos` — não há lançamento manual, e nenhuma outra tabela
é consultada.

- Receita realizada, quantidade de atendimentos e ticket médio por dia, semana e mês
- Receita prevista
- Ranking de serviços por receita gerada no período, com receita e quantidade lado a lado
- Navegação entre meses, sem limite de retrocesso

**O que a tela não faz:** não registra despesa, não calcula comissão e não considera venda de
produto.

### 6.5 Configurações

Lê e escreve `salons` (identidade), `servicos` (cadastro completo) e `horarios` (escala
semanal do salão).

- Nome, cor primária e logo do salão
- Serviços: adicionar, editar nome, valor e duração, e desativar
- Escala de funcionamento por dia da semana

**Regra que protege o histórico:** alterar o preço de um serviço vale só para novos
agendamentos — o valor já foi copiado no ato da marcação. Isso não vale para a duração, que é
recalculada (ver 5.5).

### 6.6 Estoque

Espaço reservado. A rota existe e é guardada pelo módulo `estoque`, mas a tela mostra apenas um
aviso de "em construção", sem cadastro. Ver seção 10.

### 6.7 Onboarding

Fora do `DashboardLayout`, em `/onboarding`. Cria o salão em `salons`, verifica a
disponibilidade do slug por `slug_disponivel()` e cadastra os primeiros `servicos`.

---

## 7. Página pública e área da cliente

### 7.1 Vitrine — `/:slug`

Página pública do salão. Lê `salao_publico()`, `servicos` e `horarios`. Acessível sem login;
quando quem acessa é a dona daquele salão, o `SalonHome` redireciona para o dashboard.

### 7.2 Agendamento — `/:slug/agendar`

Maior tela do projeto. Disponível apenas nos salões com o módulo `agendamento_online` liberado
e ativo.

**Fluxo:** a cliente entra com e-mail e senha, escolhe o serviço, escolhe o dia e vê os
horários livres, e confirma. No primeiro acesso informa nome e telefone, que criam a ficha dela
naquele salão.

**Disponibilidade:** montada a partir de `horarios` (escala do salão) menos os intervalos
devolvidos por `horarios_ocupados`, que retorna apenas intervalos — sem cliente, serviço ou
valor. A página nunca expõe quem tem horário marcado.

**Gravação:** a cliente não escreve em tabela nenhuma. A confirmação chama
`criar_agendamento_cliente`, que resolve o preço e o nome do serviço em `servicos` dentro do
servidor, exige que o serviço pertença àquele salão e esteja ativo, cria a ficha dela no salão
se ainda não existir, e insere o agendamento como `pendente` — tudo na mesma transação. O
navegador informa apenas qual serviço e quando.

### 7.3 Área da cliente — `/minha-conta`

Lê por `meus_agendamentos()`, sem `salon_id`, o que traz os agendamentos dela em todos os
salões onde tem ficha.

- Próximos agendamentos e histórico
- Cancelamento pela própria cliente, por `cancelar_meu_agendamento(id)`

A função de cancelamento altera **apenas** a coluna `status`, e somente em agendamento da
própria cliente que ainda esteja `pendente` ou `confirmado` e no futuro.

---

## 8. Painel da plataforma

Página única em `/admin`, reservada ao administrador. Não faz parte do sistema usado pelos
salões e não dá acesso a dado algum das clientes deles.

### 8.1 Acesso

A rota fica fora do caminho por slug. A verificação é feita no banco, pela RPC `eh_admin()`, e
não na interface. Quem não é administrador é redirecionado em silêncio.

**Por que a permissão fica no banco:** a aplicação é uma página única servida por Vite, sem
servidor intermediário para bloquear a rota, e todo o código do painel viaja no mesmo pacote
que o navegador baixa. Alguém determinado consegue forçar a tela a renderizar — e o que obtém é
uma tela vazia, porque a listagem não carrega e nenhuma alteração é gravada. A rota é uma
porta; a tranca é a política do banco.

**Por que a chave é o identificador da conta, e não o e-mail:** e-mail escrito no código exige
nova implantação a cada alteração e tranca o próprio administrador para fora caso ele troque de
endereço. O identificador da conta é estável.

### 8.2 Conteúdo

Uma linha por salão, com nome, slug, situação e uma chave por módulo. Não há tela de detalhe.
Acionar uma chave altera apenas o campo `disponivel`; o campo `ativo` permanece sob controle da
proprietária.

Sustentado por quatro funções: `admin_listar_saloes()`, `admin_definir_modulo()`,
`admin_definir_situacao_salao()` e `admin_auditoria_salao()`.

### 8.3 O que o painel não faz

Não lista clientes de salão nenhum, não mostra agendamentos, valores ou relatórios
financeiros, não cadastra serviços e não edita dados do salão. Emite convites e liga ou
desliga salões — só isso, além dos módulos.

**Decisão deliberada:** o painel existe para habilitar módulos, e nada além disso. Conceder
leitura ampla desde o início criaria um acesso difícil de retirar depois e transformaria a
plataforma em detentora de dados pessoais de clientes finais sem necessidade. Construído
assim, é possível responder a um salão que pergunte sobre o assunto que o sistema não permite
tal leitura — o que é bem diferente de afirmar que ela não é feita.

### 8.4 Auditoria

Cada acionamento de chave grava uma linha em `auditoria_admin`, com autor, salão, módulo e
momento. Somente inserção. Serve para responder à situação em que um salão relata que um
módulo desapareceu sem que ninguém tenha mexido.

---

## 9. Segurança

### 9.1 Isolamento entre salões

Todas as tabelas têm RLS ativa. O isolamento é aplicado pelo PostgreSQL, não pelo frontend:
mesmo com defeito na interface, o banco não devolve linha de outro salão.

```sql
create or replace function public.get_salon_id()
returns uuid language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select id from public.salons
   where dono_id = (select auth.uid())
     and ativo
   limit 1;
$$;
```

As policies `agendamentos_isolamento` e `clientes_isolamento` aplicam
`salon_id = get_salon_id()` tanto em `using` quanto em `with check`, para o papel
`authenticated`.

O `and ativo` faz o bloqueio do `/admin` valer no banco: com `salons.ativo = false`
a função devolve nulo e agendamentos, clientes, servicos, horarios, estoque e vendas
negam de uma vez, sem alterar policy nenhuma. `salons_owner` não usa esta função —
filtra por `dono_id` — então a dona continua lendo a própria linha, que é como o
frontend descobre o bloqueio e mostra o aviso em vez de mandá-la ao onboarding.

- `WITH CHECK` impede gravar linha em nome de outro salão, não apenas lê-la
- `TO authenticated` impede que a política se aplique ao papel anônimo
- A chave `service_role` ignora RLS por definição e não está no frontend

### 9.2 A cliente não acessa tabela

A cliente é um usuário autenticado, mas não pertence a nenhum salão. Até 8 de setembro de 2026
ela tinha seis policies de acesso direto às tabelas. **Todas foram removidas.** Hoje ela não lê
nem escreve em `clientes` e `agendamentos`: tudo passa por três funções, e as policies restantes
nessas tabelas são as do isolamento por salão, que não a alcançam.

| Função | Substituiu | O que mudou |
| --- | --- | --- |
| `criar_agendamento_cliente(...)` | `cliente_insert_agendamentos` | O preço e o nome do serviço saem de `servicos` no servidor. A policy antiga exigia `pendente`, data futura e ficha própria, mas não olhava `valor` nem a que salão o `servico_id` pertencia |
| `meus_agendamentos(salon_id)` | `cliente_select_agendamentos` e `cliente_select_proprio_registro` | Projeção declarada na função. A policy antiga em `clientes` devolvia a linha inteira, com `observacoes` — a anotação interna do salão sobre a cliente |
| `cancelar_meu_agendamento(id)` | `cliente_cancela_agendamentos` | Só a coluna `status` muda. A policy antiga obrigava `status = 'cancelado'`, mas nada impedia reescrever `valor` ou `data_hora` na mesma operação |

A criação da ficha, que era `cliente_insert_proprio_registro`, acontece dentro de
`criar_agendamento_cliente`, na mesma transação do agendamento.
`cliente_update_proprio_registro` permitia à cliente **reescrever** a anotação do salão sobre
ela; hoje a função atualiza apenas `nome` e `telefone` e não toca em `observacoes`.

**Por que não bastou privilégio de coluna:** a dona e a cliente são as duas o papel
`authenticated`, e `GRANT SELECT (colunas)` vale por papel. Tirar `observacoes` da cliente
tiraria também da dona, que é quem escreve ali.

### 9.3 Acesso do administrador

Nenhuma policy ampla de leitura foi concedida ao administrador. O painel passa somente pelas
quatro funções `admin_*`, que não devolvem dado de cliente final. Administrador autenticado não
é o mesmo que acesso irrestrito ao banco.

### 9.4 Apontamentos do linter de segurança

Última verificação em 8 de setembro de 2026. **Nenhum ERROR.**

| Nível | Apontamento | Situação |
| --- | --- | --- |
| **WARN** | `horarios_ocupados`, `modulo_liberado`, `salao_publico` e `slug_disponivel` executáveis por `anon` | **Intencional** — a vitrine, o agendamento e o cadastro precisam delas sem login |
| **WARN** | Funções `SECURITY DEFINER` executáveis por `authenticated` | **Inerente ao padrão.** Toda RPC do Supabase cai nesta categoria; a verificação de quem pode o quê está dentro de cada função |
| **WARN** | Proteção de senha vazada desativada no Auth | O Supabase pode recusar senhas comprometidas consultando o HaveIBeenPwned. Ajuste de painel, **pendente** |
| INFO | `auditoria_admin` e `plataforma_admins` com RLS ativa e nenhuma policy | Efeito desejado, mas obtido por ausência de policy, não por policy explícita |

O ERROR da view `salons_public` e o WARN das três funções de trigger foram resolvidos em 8 de
setembro (ver 4.9 e 4.10).

### 9.5 Verificação executada

As correções acima foram conferidas com um roteiro que cria um usuário de teste, assume o papel
`authenticated` com o JWT dele e desfaz tudo ao final. Resultado, em 8 de setembro de 2026:

| Tentativa | Esperado | Resultado |
| --- | --- | --- |
| INSERT direto em `agendamentos` com `valor = 1` | Negado | Negado pela RLS |
| `criar_agendamento_cliente` com serviço de R$ 120 | Grava 120 | Gravou 120 |
| `criar_agendamento_cliente` com serviço de outro salão | Negado | Negado |
| SELECT direto em `clientes` | 0 linhas | 0 linhas |
| UPDATE de `observacoes` na própria ficha | 0 linhas afetadas | 0 linhas |
| SELECT direto em `agendamentos` | 0 linhas | 0 linhas |
| `cancelar_meu_agendamento` no próprio | Cancela | Cancelou |
| `cancelar_meu_agendamento` no de outra pessoa | Negado | Negado |
| `anon` chamando `salao_publico` | Devolve o salão | Devolveu |
| `anon` lendo `salons` direto | Sem acesso | Sem privilégio de tabela |
| `anon` chamando `salons_resolve_dono_id` | Negado | Negado |

Não é teste automatizado: é um roteiro avulso, rodado à mão. A pendência de 11.3 continua de pé.

---

## 10. Tabelas reservadas: estoque e vendas

As tabelas `estoque` e `vendas` **existem no banco, com RLS ativa, e estão vazias**. Nenhuma
tela escreve nelas. A única leitura é o alerta de estoque baixo do Dashboard, que consulta
`estoque`; a tabela `vendas` não é lida nem escrita por nenhuma parte da aplicação.

**Ficam deliberadamente no banco.** Tabela vazia com RLS ativa não custa nada e não abre
superfície de risco. Removê-las e recriá-las depois só geraria trabalho, e o desenho já está
correto: as duas têm `salon_id`, então o isolamento da seção 9.1 se aplica sem alteração
nenhuma no dia em que o módulo entrar.

### 10.1 estoque

| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid PK | Identificador |
| salon_id | uuid FK | Salão |
| nome | text | Nome do produto |
| categoria | text | Agrupamento livre |
| quantidade | integer (padrão 0) | Saldo em estoque |
| quantidade_minima | integer (padrão 5) | Limite que dispara o alerta do Dashboard |
| preco_custo | numeric(10,2) | Custo de aquisição |
| preco_venda | numeric(10,2) | Preço ao público |
| criado_em | timestamptz | Data de cadastro |

### 10.2 vendas

| Campo | Tipo | Descrição |
| --- | --- | --- |
| id | uuid PK | Identificador |
| salon_id | uuid FK | Salão |
| produto_id | uuid FK → `estoque.id` | Produto vendido |
| cliente_id | uuid FK → `clientes.id` | Compradora, quando identificada |
| quantidade | integer | Unidades vendidas |
| valor_total | numeric(10,2) | Valor da venda |
| forma_pag | text | Forma de pagamento |
| data_venda | timestamptz | Momento da venda |

`vendas.produto_id` referencia `estoque.id`: é a venda de produto do estoque, não um registro
de venda genérico. Receita de serviço já vem inteiramente de `agendamentos`, e é por isso que
`vendas` existe em separado.

### 10.3 Uso previsto: estoque de loja, não apenas insumo

O módulo não nasce como controle de insumo de bancada — tinta, água oxigenada, toalha. Ele
nasce como **estoque de varejo**: o produto que o estabelecimento revende ao cliente. Camisa de
time e boné na barbearia, cosmético de marca própria, prancha e secador, produto de revenda em
geral.

A distinção muda a tela. Controle de insumo é uma planilha de saldo que a proprietária confere
de vez em quando; estoque de loja é um ponto de venda — escolhe o produto, informa a
quantidade, registra o pagamento e dá baixa. As colunas `preco_venda`, `cliente_id` e
`forma_pag` já apontam para o segundo desenho.

### 10.4 Pendências a resolver antes de implementar

- **Congelamento de preço.** `vendas` guarda apenas `valor_total`, sem preço unitário copiado
  no ato. Pela mesma regra que protege o valor do agendamento (4.5), reajustar
  `estoque.preco_venda` não pode reescrever o histórico — falta uma coluna de preço unitário.
- **Baixa de saldo.** Não existe decremento automático de `estoque.quantidade`. Venda e baixa
  precisam ocorrer na mesma transação, sob pena de saldo divergente; a escolha entre trigger e
  função transacional está em aberto.
- **Efeito no financeiro.** O Financeiro hoje declara que não considera venda de produto. Ligar
  este módulo faz a receita ter duas origens, e o relatório precisa separá-las — senão o número
  deixa de bater com o caixa de serviços.
- **`produto_id` aceita nulo,** o que permitiria venda sem produto vinculado. Definir se é
  intencional (venda avulsa de item não cadastrado) ou se deve virar NOT NULL.

---

## 11. Pendências e riscos conhecidos

Em ordem de gravidade.

### 11.1 Situação `pendente` sem tratamento no financeiro

Agendamentos `pendente` entram na receita realizada, junto com os confirmados. Ou a marcação
pública passa a nascer confirmada, ou o financeiro precisa tratar o estado separadamente.

### 11.2 Duração não congelada

Alterar a duração de um serviço muda retroativamente o horário de término de agendamentos já
marcados (5.5).

### 11.3 Sem testes automatizados

Não há nenhum teste no projeto nem runner instalado. Falta em especial o teste de isolamento:
autenticar como salão A e tentar ler, inserir e atualizar registro do salão B, esperando falha
em toda tentativa.

O roteiro de 9.5 cobre a fronteira da cliente, mas foi rodado à mão em SQL — não roda em CI e
ninguém é avisado se uma alteração futura reabrir algum daqueles furos. É a pendência mais
importante desta lista justamente por isso: as correções de 8 de setembro não têm rede.

### 11.4 Proteção de dados pessoais

**Feito:** páginas `/termos` e `/privacidade`; aceite obrigatório no cadastro do salão, com
data e versão gravadas em `salons`; aviso informativo nos dois cadastros de cliente
(`/cadastro-cliente` e o passo de conta dentro de `/:slug/agendar`).

**Desenho:** a dona do salão marca um checkbox — é contrato comercial com a plataforma. A
cliente recebe um aviso em texto, não um checkbox: marcar horário é execução de contrato com o
salão (LGPD art. 7º, V) e não depende de consentimento; o que a lei exige ali é transparência
sobre o compartilhamento com o salão. Componentes em `src/components/AvisoLegal.jsx`.

**Falta:** rotina de exportação e de exclusão a pedido; os textos legais são rascunho, com
campos `[PREENCHER]` (razão social, CNPJ, e-mail de contato, comarca) e sem revisão jurídica.

### 11.5 Outros

- **Sem landing page:** `/` redireciona direto para `/login`
- **Confirmação de e-mail** no Supabase Auth: decisão de desativar, pendente no painel. Mantê-la em produção exigiria SMTP próprio
- **Validação de palavras reservadas de slug** (`admin`, `api`, `app`, `login`, `agendar`…): o onboarding deixa a proprietária escolher o slug, sem lista de bloqueio
- **Sem `fuso_horario` por salão:** os períodos do financeiro usam fuso fixo no código
- **Branch `dev-ricardo`** atrás da `main`

### 11.6 Resolvido em 8 de setembro de 2026

Quatro itens saíram desta lista. Ficam registrados porque a explicação de por que foram
resolvidos daquele jeito importa mais que o fato de terem sido.

| Era | Como estava | Onde está agora |
| --- | --- | --- |
| O valor do agendamento vinha do navegador | `valor`, `servico` e `servico_id` eram livres na inserção da cliente | `criar_agendamento_cliente` (4.10, 7.2, 9.2) |
| View `salons_public` como `SECURITY DEFINER` | Único ERROR do linter | View removida; `salao_publico` e `slug_disponivel` (4.9) |
| Funções internas expostas a `anon` | Eram três, não duas: também `salons_resolve_dono_id` | `EXECUTE` revogado (4.10) |
| `observacoes` legível **e reescrevível** pela cliente | Duas policies devolviam e aceitavam a linha inteira de `clientes` | Policies removidas; acesso por função (9.2) |

---

## 12. Ambiente e deploy

- **Frontend:** React 19, Vite 8, Tailwind v4, React Router 7, TanStack Query, lucide-react, react-hot-toast — em `frontend/`
- **Banco e autenticação:** Supabase, região sa-east-1 — não apontar comando para o projeto do SalaoApp
- **Deploy:** Vercel, *Root Directory* = `frontend`. O `vercel.json` faz rewrite de SPA — sem ele, recarregar uma rota interna devolve 404
- **Variáveis de ambiente:** apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- **Schema versionado** em `supabase/`: `schema.sql` (retrato, fonte de verdade) e `migrations/`. Regra: alteração de banco entra no mesmo commit que o código que depende dela
- **Um banco só para desenvolvimento e produção** — escolha consciente para este estágio, a separar quando houver o primeiro cliente pagante. O `schema.sql` é o que torna a separação viável, porque agora existe como recriar o schema
- **Repositório:** github.com/RicardoMacarios/saas-barbearia
