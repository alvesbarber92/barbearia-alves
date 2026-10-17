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

alter table public.salons
  add constraint salons_slug_nao_reservado check (not public.slug_reservado(slug));

create or replace function public.slug_disponivel(p_slug text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select not public.slug_reservado(p_slug)
     and not exists (select 1 from salons s where s.slug = p_slug)
$fn$;

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
