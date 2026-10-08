# Schema do banco

O problema que esta pasta resolve: até 8 de setembro de 2026 o schema existia
**apenas** no painel do Supabase. Código e banco não viajavam juntos, então um
commit podia chegar exigindo uma coluna que não existia — ou, ao contrário, uma
alteração no banco podia quebrar o código que estava no repositório, sem que
nada no Git registrasse a causa.

## O que é cada coisa

| Arquivo | Papel |
| --- | --- |
| `schema.sql` | **Fonte de verdade.** Retrato completo do schema atual: tabelas, constraints, índices, funções, triggers, event trigger, RLS, policies, privilégios e a publicação de realtime |
| `migrations/` | Alterações incrementais, em ordem de versão. Nomes no padrão da CLI do Supabase: `<timestamp>_<nome>.sql` |

## A regra

**Alteração no banco entra no mesmo commit que o código que depende dela.**

1. Escreva o SQL num arquivo novo em `migrations/`, com timestamp UTC:
   `YYYYMMDDHHMMSS_descricao_curta.sql`
2. Aplique no projeto.
3. Regenere `schema.sql` (abaixo).
4. Commite o arquivo de migration, o `schema.sql` e o código do frontend juntos.

O passo 4 é o que evita a quebra. Migration commitada sem o código deixa o banco
à frente; código commitado sem a migration deixa o repositório à frente.

## Arquivo de migration não é prova de que foi aplicada

Aconteceu em 15/09/2026 e só foi descoberto em 18/09: o commit
`1a4adc8` entregou `20260915234441_slugs_reservados_no_banco.sql` com um
cabeçalho afirmando "Aplicada no banco em 15/09/2026". Não tinha sido. O banco
passou três dias sem a função `slug_reservado` e sem a constraint, com a trava
valendo só na tela — exatamente o furo que o commit dizia ter fechado.

**Como conferir**, antes de confiar no que o arquivo diz:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Se o nome não estiver nessa lista, não foi aplicada. Vale também o caminho
inverso — procurar o objeto direto no catálogo (`pg_proc`, `pg_constraint`) —
porque o registro de migration pode existir sem o efeito, quando alguém aplica
o SQL pelo painel sem passar pela CLI.

## O que o banco tem e nenhuma migration conta

Parte do schema foi feita à mão pelo painel e não aparece em migration nenhuma:
`salon_modulos`, `plataforma_admins`, `auditoria_admin`, `eh_admin` e as funções
`admin_*`.

O caso mais caro dessa lista: **`salons.dono_email` foi removida pelo painel**,
sem migration, quando o e-mail do dono passou a vir de `auth.users` por
`dono_id`. A mudança foi acertada — um e-mail só, num lugar só, e é assim que
`admin_listar_saloes` funciona hoje. Mas, como nenhum arquivo registrou,
`criar_salao_com_convite` continuou no repositório inserindo numa coluna que já
não existia. Reaplicar aquele arquivo em 18/09 recolocou o erro no banco, e
**PL/pgSQL não valida nome de coluna na criação da função, só na execução**:
nada reclamou. Quem descobriria seria a próxima barbearia, no meio do cadastro.
A correção está em `20260918023012_criar_salao_com_convite_sem_dono_email.sql`.

A lição prática: alteração feita pelo painel **precisa** virar arquivo no mesmo
dia, senão o repositório passa a carregar SQL que destrói o banco quando alguém
confia nele.

## Por que `schema.sql` é o retrato, e não a soma das migrations

Além das mudanças de painel acima, as migrations mais antigas foram superadas —
as primeiras policies identificavam a cliente pelo `telefone` do JWT, mecanismo
que não existe mais. E `20260909030342_criacao_de_salao_exige_convite.sql`, que
veio na cópia do SalaoApp, tem a versão antiga de `criar_salao_com_convite`,
com o `dono_email`.

Consequência prática: **replayar `migrations/` num banco vazio não reproduz este
banco.** Para criar um ambiente novo, aplique `schema.sql`. As migrations servem
para ler o que mudou e quando, e para aplicar uma alteração num banco que já
existe.

## Ordem dentro do `schema.sql`

O arquivo é aplicável de cima para baixo. Uma armadilha já corrigida: a
constraint `salons_slug_nao_reservado` é uma CHECK que chama
`public.slug_reservado()`, então ela **não** pode ficar no bloco de constraints,
que vem antes das funções. Ela tem um bloco próprio logo depois de `FUNCOES`.
Qualquer constraint nova que dependa de função vai no mesmo lugar.

## Como regenerar `schema.sql`

Com a CLI ligada ao projeto (precisa da senha do banco, que não está no
repositório):

```
npx supabase db dump --db-url "postgresql://postgres:SENHA@db.<id-do-projeto>.supabase.co:5432/postgres" -f supabase/schema.sql
```

O `<id-do-projeto>` é o que aparece em `VITE_SUPABASE_URL`, no `frontend/.env`. O projeto do
SalaoApp é outro: não apontar nenhum comando para ele.

**Nunca rode `supabase db push`.** A pasta `migrations/` tem arquivos antigos que
o banco não registra, e o push tentaria reaplicá-los.

O `schema.sql` atual **não** foi gerado por `pg_dump` — foi montado por
introspecção do `pg_catalog`, porque a senha do banco não estava disponível. Ele
cobre o schema `public` inteiro, mas não traz extensões nem o schema `auth` do
Supabase, que o `pg_dump` incluiria. Na primeira vez que rodar o comando acima,
o arquivo tende a ficar mais completo — o que é bom, e a diferença esperada.

Quando regerar por introspecção, confira as contagens contra o banco antes de
commitar: 15 tabelas, 62 constraints, 15 índices fora os de constraint, 41
funções, 5 triggers, 1 event trigger e 40 policies, em 25/09/2026.

⚠️ E confira a seção **PRIVILEGIOS DE TABELA**. Introspecção de `pg_catalog`
como a de 18/09 não traz `GRANT`/`REVOKE` de tabela por conta própria, e é
justamente ali que mora a trava que impede o dono de reativar a própria
barbearia (`salons.ativo`) e de liberar módulo pago (`salon_modulos.disponivel`).
Perder essa seção numa regeneração reabre os dois furos em silêncio, sem que
nada no schema pareça diferente. `pg_dump` traz esses comandos; introspecção,
não.

## Ambiente novo, do zero

1. Crie o projeto no Supabase.
2. Aplique `schema.sql`.
3. Insira a si mesmo em `plataforma_admins` para ter acesso a `/admin`.
4. Semeie um convite em `convites` — sem ele não há como criar a primeira
   barbearia pela tela.
5. Aponte `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do frontend para ele.

Hoje o projeto usa **um banco só para desenvolvimento e produção**. Separar é
pendência conhecida (seção 12 da documentação); este arquivo é o que torna a
separação viável, porque agora existe como recriar o schema.

## Resolvido

- **Seis pares de índices duplicados** (`idx_agendamentos_cliente` e
  `idx_agendamentos_cliente_id` eram o mesmo índice com dois nomes, e o mesmo
  valia para `clientes(auth_user_id)`, `clientes(salon_id)`, `estoque(salon_id)`,
  `salons(dono_id)` e `servicos(salon_id)`). Saíram do banco: hoje há um índice
  por coluna, e o `schema.sql` de 18/09 já retrata isso.
