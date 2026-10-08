-- Aplicada no banco em 18/09/2026 (UTC), registrada lá como
-- "slugs_reservados_no_banco". O cabeçalho anterior deste arquivo dizia que a
-- aplicação tinha acontecido em 15/09 — não tinha: o commit entregou só a
-- metade do código, e o banco ficou sem a função e sem a constraint por três
-- dias. Só conferir a lista de migrations do projeto revela esse tipo de
-- diferença; o arquivo sozinho não prova nada.
--
-- ⚠️ Esta migration foi aplicada com um erro e é corrigida pela seguinte,
-- `20260918023012_criar_salao_com_convite_sem_dono_email.sql`: o INSERT abaixo
-- ainda grava em `salons.dono_email`, coluna que já tinha sido removida do
-- banco quando o e-mail do dono passou a vir de `auth.users` por `dono_id`.
-- PL/pgSQL só resolve nome de coluna em tempo de execução, então a criação da
-- função passou sem reclamar e o erro só apareceria ao cadastrar a próxima
-- barbearia. Fica registrado como aconteceu, não como deveria ter sido.
--
-- A lista de slugs reservados só existia no frontend (src/utils/slug.js). Quem
-- chamasse a RPC direto, ou trocasse o link pelo update de `salons` do
-- onboarding, gravava `admin` ou `login` sem tropeçar em nada — e a barbearia
-- nascia inacessível, porque a rota fixa do App.jsx ganha de `/:slug`.
--
-- A lista fica repetida aqui de propósito: constraint de banco precisa de
-- função IMMUTABLE, e ler de uma tabela não é immutable. Rota nova no App.jsx
-- entra nos dois lugares.

create or replace function public.slug_reservado(p_slug text)
returns boolean
language sql
immutable
set search_path to 'pg_catalog', 'pg_temp'
as $fn$
  select lower(btrim(coalesce(p_slug, ''))) = any (array[
    'login', 'cadastro', 'cadastro-cliente', 'esqueci-senha', 'redefinir-senha',
    'quero-meu-salao', 'termos', 'privacidade', 'admin', 'onboarding', 'minha-conta',
    'api', 'app', 'assets', 'www', 'suporte', 'ajuda', 'entrar', 'sair', 'planos'
  ])
$fn$;

revoke execute on function public.slug_reservado(text) from public, anon;
grant  execute on function public.slug_reservado(text) to authenticated;

-- A trava que vale de verdade: pega a criação pela RPC e a troca de link pelo
-- update do onboarding, que passa direto pela policy salons_owner_alteracao.
alter table public.salons
  add constraint salons_slug_nao_reservado check (not public.slug_reservado(slug));

-- ===== As duas portas, com resposta melhor que erro de constraint =====

-- O campo do onboarding consulta esta função enquanto a pessoa digita: slug
-- reservado passa a responder "indisponível" no mesmo caminho de slug tomado.
create or replace function public.slug_disponivel(p_slug text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select not public.slug_reservado(p_slug)
     and not exists (select 1 from salons s where s.slug = p_slug)
$fn$;

-- Na criação, `slug_reservado` vira errcode próprio em vez de estourar na
-- constraint: a tela traduz a chave e pede outro nome.
create or replace function public.criar_salao_com_convite(
  p_nome              text,
  p_slug              text,
  p_codigo            text,
  p_whatsapp          text        default null,
  p_termos_aceitos_em timestamptz default null,
  p_termos_versao     text        default null
)
returns public.salons
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_codigo  text := upper(btrim(coalesce(p_codigo, '')));
  v_convite public.convites%rowtype;
  v_slug    text;
  v_salon   public.salons%rowtype;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if exists (select 1 from salons s where s.dono_id = v_uid) then
    raise exception 'ja_tem_salao' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome_obrigatorio' using errcode = 'P0001';
  end if;

  v_slug := nullif(btrim(coalesce(p_slug, '')), '');
  if v_slug is null then
    raise exception 'slug_obrigatorio' using errcode = 'P0001';
  end if;

  if public.slug_reservado(v_slug) then
    raise exception 'slug_reservado' using errcode = 'P0001';
  end if;

  -- `for update` segura a linha até o fim desta transação: em dois cadastros
  -- simultâneos com o mesmo código, o segundo espera e encontra `usado_por`.
  select * into v_convite from convites c where c.codigo = v_codigo for update;

  if not found or v_convite.usado_por is not null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;

  if v_convite.expira_em <= now() then
    raise exception 'convite_expirado' using errcode = 'P0001';
  end if;

  if exists (select 1 from salons s where s.slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  insert into salons (nome, slug, whatsapp, dono_email, dono_id,
                      termos_aceitos_em, termos_versao)
  values (btrim(p_nome), v_slug,
          nullif(btrim(coalesce(p_whatsapp, '')), ''),
          v_email, v_uid,
          coalesce(p_termos_aceitos_em, now()),
          p_termos_versao)
  returning * into v_salon;

  update convites
     set usado_por = v_uid, usado_em = now(), salon_id = v_salon.id
   where codigo = v_codigo;

  return v_salon;
end
$fn$;
