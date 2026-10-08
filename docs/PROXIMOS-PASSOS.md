# Onde este projeto está — 25 de setembro de 2026

Substitui a versão de 11/09, que virou estado velho: quase tudo que ela listava
como pendência já foi resolvido. As pendências de entrada no ar continuam as
mesmas de 18/09 — o que veio depois foi produto, não deploy.

**Projeto Supabase:** o de `VITE_SUPABASE_URL` em `frontend/.env`, região sa-east-1
**Repositório:** github.com/RicardoMacarios/saas-barbearia
**Vercel:** projeto `saas-barbearia`, Root Directory `frontend`,
domínio de produção `saas-barbearia-lovat.vercel.app`

---

## Falta para entrar no ar

### 1. Terminar as variáveis de ambiente na Vercel

Em andamento. As duas variáveis foram apagadas para recomeçar limpo, porque a
chave anônima havia sido colada com um caractere a mais (um `V` deslocado do
nome da variável para dentro do valor — o erro *Invalid API key* na tela vinha
daí, confirmado lendo o bundle publicado).

- **Settings → Environment Variables → Add Environment Variable → Import .env**
- Aponte para `frontend/.env`, que está correto e conferido byte a byte
- *Environments*: Production and Preview
- Depois: **Deployments → `⋯` → Redeploy**, com *Use existing Build Cache*
  **desmarcado** — variável só entra em build novo

Como saber se funcionou, sem depender da tela: baixe o bundle e leia a chave.

```
curl -s https://saas-barbearia-lovat.vercel.app/login | grep -o '/assets/[^"]*\.js'
curl -s https://saas-barbearia-lovat.vercel.app/assets/<arquivo>.js \
  | grep -o 'eyJhbGciOi[A-Za-z0-9_.-]*'
```

O trecho `ImtqbWFja2F2YmNmeGpiZ2R5b2d3` tem de aparecer **sem** um `V` antes do `2`.

### 2. Site URL e Redirect URLs no Supabase

Sem isso, "Esqueci a senha" manda o cliente para `localhost`. O app monta os
links a partir de `window.location.origin`, e o único `redirectTo` do código
está em `EsqueciSenhaPage`, apontando para `/redefinir-senha`.

**Authentication → URL Configuration:**

- **Site URL:** `https://saas-barbearia-lovat.vercel.app` (sem barra no fim)
- **Redirect URLs:**
  ```
  https://saas-barbearia-lovat.vercel.app/**
  http://localhost:5173/**
  ```

Não use o endereço `...-git-main-...vercel.app`: é o alias da branch, não o
domínio de produção.

### 3. Senha do admin

Foi definida dentro de uma conversa com o assistente. Trocar em
**Authentication → Users → Reset password**.

---

## Decisões que só você toma

- **E-mail fica no remetente embutido do Supabase — decidido em 18/09/2026.**
  Não relitigar. O Ricardo optou por seguir sem domínio próprio e sem SMTP por
  enquanto. Consequências conhecidas e aceitas: o remetente é compartilhado,
  libera cerca de **2 e-mails por hora** por projeto, não tem garantia de
  entrega, e o Gmail costuma aplicar greylisting (recusa a primeira tentativa,
  aceita minutos depois) ou mandar para spam. Na prática, "esqueci a senha" de
  cliente pode demorar ou não chegar. Rever quando houver domínio próprio —
  aí o caminho é SPF/DKIM e um SMTP (o `.env` já reserva `RESEND_API_KEY`).
- **Confirmação de e-mail** (Supabase Auth): ligada, depende do remetente acima
  e herda o mesmo limite. Desligada, a pessoa entra direto. O código trata os
  dois casos.
- **Leaked password protection** está desligada. Um clique no painel; confere
  a senha contra bases de vazamento conhecidas.
- **Um banco só para dev e produção.** Com uma barbearia passa; com várias, um
  teste seu mexe em dado de cliente real. Separar agora é viável: o
  `supabase/schema.sql` recria o schema inteiro.
- **Foro de eleição removido dos Termos em 18/09/2026.** Era o último campo
  `[PREENCHER]` e ficava visível a qualquer visitante. Sem foro eleito valem as
  regras de competência da lei. Os textos legais seguem sem revisão jurídica.
- **WhatsApp comercial** em `frontend/src/lib/contato.js` é o número pessoal do
  Ricardo (`16997485859`). É para onde vai quem clica em "Quero meu salão".

---

## Resolvido em 18/09/2026

- **Slug reservado travado no banco.** A migration existia no repositório desde
  15/09 com um cabeçalho afirmando ter sido aplicada — não tinha. A trava valia
  só na tela por três dias. Hoje existem a função `slug_reservado`, a constraint
  `salons_slug_nao_reservado` e a checagem dentro de `criar_salao_com_convite`.
- **`salons.dono_email`.** A coluna tinha sido removida pelo painel, sem
  migration, quando o e-mail do dono passou a vir de `auth.users`. O repositório
  seguia com SQL que inseria nela; reaplicar aquele arquivo recolocou o erro no
  banco e teria quebrado o cadastro da barbearia seguinte. Corrigido.
- **`schema.sql` regenerado.** Estava parado em 09/09, sem `dias_especiais`, sem
  a duração congelada, sem horários padrão e sem os logos.
- **Dois furos de privilégio.** RLS filtra linha, não coluna: o dono conseguia
  `update salons set ativo = true` (desfazendo o bloqueio do `/admin`) e
  `update salon_modulos set disponivel = true` (liberando módulo pago para si).
  Fechados com privilégio de coluna.
- **Vercel Authentication desligada** — antes, o site só abria para quem
  estivesse logado na conta Vercel.
- **Vitrine sem recorte.** As policies deixavam qualquer visitante ler preço e
  horário de **todas** as barbearias ativas numa consulta, não só a que estava
  sendo visitada. A vitrine passou a ser servida por função que recebe o slug
  (`vitrine_servicos`, `vitrine_horarios`, `vitrine_dias_especiais`) e as três
  policies caíram.
- **`horarios_ocupados` deixou de ser pública.** Ela revelava a agenda
  cheia/vazia de qualquer barbearia a quem soubesse o `salon_id`. Agora exige
  login — como a tela já exigia antes de mostrar horário — e a janela tem teto
  de 31 dias, contra quem quisesse puxar um ano numa chamada.

## Chegou entre 19 e 25/09/2026

Nada aqui muda o que falta para entrar no ar; é registro do que o sistema
passou a fazer.

- **Estoque ganhou tela** — produtos, entrada, saída e lucro do mês, com o saldo
  e a venda gravados na mesma transação (`estoque_entrada`, `estoque_saida`).
  Deixou de ser tabela reservada.
- **Horário fixo** (`horarios_fixos`) — o cliente de toda sexta às 18:00 fica com
  as datas reservadas por agendamentos de verdade, até o limite de 3 meses. A
  trava de conflito protege o horário sem mudar nada.
- **Almoço** — padrão por barbearia em `horarios.pausa_*` e exceção por data em
  `pausas_dia`. Some da tela do cliente; o dono ainda pode encaixar alguém.
- **Dias especiais em lote** — dá para marcar vários dias, ou o mês todo, e
  salvar numa ida só. Antes fechar dezembro pedia trinta e um salvamentos.
- **Modo observação do admin** (`admin_observando`) — o `/admin` abre o painel de
  uma barbearia para dar suporte. Somente leitura garantida no banco: a escrita
  passou a checar `get_salon_id_proprio()`, que só conhece a barbearia do
  próprio dono. Entrada e saída ficam em `auditoria_admin`.
- **Agenda do dono** deixou de oferecer horário onde o serviço não cabe inteiro,
  e dia que já passou não abre mais formulário de agendamento.
- **Rodapé do modal alcançável no celular** — todo modal passou a se apoiar em
  `CamadaModal`, um portal para o `body`, com altura em `dvh`. Ver `DESIGN.md`.

Conferido em 25/09: `npm run lint` em zero e `npm run build` sem erro.

## Verificado em 18/09/2026

Isolamento entre barbearias, testado no banco assumindo a identidade de um dono
e tentando alcançar outra barbearia criada na hora (tudo desfeito por rollback):

| Tentativa | Resultado |
| --- | --- |
| Ler clientes de outra barbearia | 0 linhas |
| Alterar clientes de outra | 0 linhas |
| Ler o cadastro de outra | 0 linhas |
| Alterar o cadastro de outra | 0 linhas |
| Ler agendamentos de outra | 0 linhas |
| Inserir agendamento em outra | recusado |
| Ler serviços de outra | 0 linhas — desde 18/09 a vitrine é por função com slug |

---

## Pendências conhecidas, sem urgência

1. **Nenhum teste automatizado.** Não há runner instalado. O roteiro de
   isolamento acima foi rodado à mão: ninguém é avisado se uma alteração futura
   reabrir algum furo. É a pendência mais importante desta lista.
2. **Sem rotina de exportação e exclusão de dados** a pedido (LGPD).
3. **Sem `fuso_horario` por barbearia:** os períodos do Financeiro usam fuso
   fixo no código.
4. **Bundle único de 664 KB** (184 KB gzip), sem code-splitting.
5. **Sem landing page:** `/` redireciona direto para `/login`.

---

## Armadilhas que já custaram tempo

- **Arquivo de migration não prova que foi aplicada.** Confira em
  `supabase_migrations.schema_migrations` antes de confiar no cabeçalho.
- **PL/pgSQL não valida nome de coluna na criação da função**, só na execução.
  Uma função pode ser criada sem erro e quebrar meses depois, no primeiro uso.
- **Alteração feita pelo painel precisa virar arquivo no mesmo dia.** Foi assim
  que o `dono_email` virou uma bomba-relógio no repositório.
- **Regenerar `schema.sql` por introspecção não traz `GRANT`/`REVOKE`.** Perder
  a seção PRIVILEGIOS DE TABELA reabre os dois furos de privilégio em silêncio.
- **O projeto free hiberna após 7 dias sem uso.** O site parece quebrado sem
  nada ter mudado; despausar é no painel.
- **Não mexer no SalaoApp** — nem no código (`d:\Projetos\Saas-Sal-o`), nem no
  banco dele. Achou algo que valeria lá? Avise e deixe a
  decisão com o Ricardo.

## Contas que existem hoje

Em 24/09/2026 o banco foi zerado: foram apagados a barbearia de teste (Alves
Barber Shop), com serviços, clientes, agendamentos, estoque e vendas, além dos
convites, do histórico de auditoria e de todas as contas de login, exceto a do
admin.

| Conta | E-mail | Papel |
| --- | --- | --- |
| Admin | (e-mail do dono da plataforma) | `plataforma_admins` |

Não existe nenhuma barbearia nem conta de dono ou de cliente. Para testar, é
preciso começar por um convite (veja abaixo).

Os 2 arquivos do bucket `logos` no Storage continuam lá. O Supabase não deixa
apagá-los por SQL, então ficam para o painel (Storage → `logos`) ou para a API
de Storage.

⚠️ **Admin e dono precisam de e-mails diferentes.** O `LoginPage` checa admin
antes de barbearia, então uma conta que seja as duas coisas cai sempre no
`/admin` e nunca vê o próprio painel.

Para criar barbearia nova: gere convite no `/admin`, escolha o prazo (5 min,
30 min ou 4 horas — vem em 5 min) e mande o link copiado. Cada código serve
uma vez só.
