create table if not exists public.convites (
  codigo     text primary key,
  nota       text,
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null,
  criado_por uuid references auth.users(id) on delete set null,
  usado_em   timestamptz,
  usado_por  uuid references auth.users(id) on delete set null,
  salon_id   uuid references public.salons(id) on delete set null
);

alter table public.convites enable row level security;

revoke all on table public.convites from anon, authenticated;

create or replace function public.admin_gerar_convite(p_nota text default null, p_minutos int default 5)
returns public.convites
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_alfabeto  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo    text;
  v_i         int;
  v_tentativa int := 0;
  v_minutos   int := greatest(1, least(coalesce(p_minutos, 5), 1440));
  v_row       public.convites%rowtype;
begin
  if not eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  loop
    v_codigo := '';
    for v_i in 1..8 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    v_codigo := substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4);

    exit when not exists (select 1 from convites c where c.codigo = v_codigo);

    v_tentativa := v_tentativa + 1;
    if v_tentativa > 20 then
      raise exception 'nao_foi_possivel_gerar_codigo' using errcode = 'P0001';
    end if;
  end loop;

  insert into convites (codigo, nota, expira_em, criado_por)
  values (v_codigo,
          nullif(btrim(coalesce(p_nota, '')), ''),
          now() + make_interval(mins => v_minutos),
          auth.uid())
  returning * into v_row;

  return v_row;
end
$fn$;

create or replace function public.admin_listar_convites(p_limite int default 30)
returns table(codigo text, nota text, criado_em timestamptz, expira_em timestamptz,
              usado_em timestamptz, usado_por_email text, salao_nome text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select c.codigo, c.nota, c.criado_em, c.expira_em, c.usado_em,
         u.email::text, s.nome
  from convites c
  left join auth.users u on u.id = c.usado_por
  left join salons    s on s.id = c.salon_id
  where eh_admin()
  order by c.criado_em desc
  limit greatest(1, least(coalesce(p_limite, 30), 200))
$fn$;

create or replace function public.convite_valido(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select exists (
    select 1 from convites c
    where c.codigo = upper(btrim(coalesce(p_codigo, '')))
      and c.usado_por is null
      and c.expira_em > now()
  );
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

drop policy if exists salons_owner on public.salons;

create policy salons_owner_leitura on public.salons
  for select to authenticated
  using (dono_id = (select auth.uid()));

create policy salons_owner_alteracao on public.salons
  for update to authenticated
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()));

create policy salons_owner_exclusao on public.salons
  for delete to authenticated
  using (dono_id = (select auth.uid()));

revoke execute on function public.admin_gerar_convite(text, int) from public, anon;
grant  execute on function public.admin_gerar_convite(text, int) to authenticated;

revoke execute on function public.admin_listar_convites(int) from public, anon;
grant  execute on function public.admin_listar_convites(int) to authenticated;

revoke execute on function public.criar_salao_com_convite(text, text, text, text, timestamptz, text) from public, anon;
grant  execute on function public.criar_salao_com_convite(text, text, text, text, timestamptz, text) to authenticated;

grant  execute on function public.convite_valido(text) to anon, authenticated;
