-- Painel de uso do /admin: quanto do plano Free do Supabase já foi gasto.
--
-- As funções e a tabela de histórico já estavam no banco, sem migration no
-- repositório. Esta migration registra a versão atual e corrige o ciclo de
-- cobrança: a organização vira o ciclo no dia 7 (conferido em Usage,
-- "07 Oct 2026 - 07 Nov 2026").
--
-- Tráfego de saída e a fatura não aparecem aqui: só o painel do Supabase
-- mostra. A tela leva para lá.

create extension if not exists pg_cron;

-- ===== HISTÓRICO DIÁRIO =====

create table if not exists public.uso_historico (
  dia              date primary key,
  banco_bytes      bigint not null,
  arquivos_bytes   bigint not null,
  usuarios_ativos  integer not null,
  usuarios_total   integer not null,
  medido_em        timestamptz not null default now()
);

-- Sem policy: só as funções abaixo leem e gravam.
alter table public.uso_historico enable row level security;
revoke all on table public.uso_historico from anon, authenticated;

-- ===== CICLO DE COBRANÇA =====

create or replace function public.ciclo_cobranca_atual(out inicio date, out fim date)
language sql
stable
set search_path to 'public', 'pg_temp'
as $fn$
  select c.ini, (c.ini + interval '1 month')::date
    from (
      select case when extract(day from h.d) >= 7
                  then date_trunc('month', h.d)::date + 6
                  else (date_trunc('month', h.d) - interval '1 month')::date + 6
             end as ini
        from (select (now() at time zone 'America/Sao_Paulo')::date as d) h
    ) c;
$fn$;

revoke execute on function public.ciclo_cobranca_atual() from public, anon, authenticated;

-- Quem entrou ou renovou a sessão desde o início do ciclo (régua do MAU).
create or replace function public.usuarios_ativos_no_ciclo()
returns bigint
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  with ini as (
    select (c.inicio::timestamp at time zone 'America/Sao_Paulo') as t
      from public.ciclo_cobranca_atual() c
  )
  select count(distinct x.u)
    from (
      select u.id as u from auth.users u, ini where u.last_sign_in_at >= ini.t
      union
      select s.user_id from auth.sessions s, ini
       where greatest(s.refreshed_at at time zone 'UTC', s.updated_at) >= ini.t
    ) x;
$fn$;

revoke execute on function public.usuarios_ativos_no_ciclo() from public, anon, authenticated;

-- ===== USO AGORA =====

create or replace function public.admin_uso_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_ciclo     record;
  v_resultado jsonb;
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  select * into v_ciclo from public.ciclo_cobranca_atual();

  select jsonb_build_object(
    'medido_em',        now(),
    'banco_bytes',      (select sum(pg_database_size(d.datname))::bigint from pg_database d),
    'arquivos_bytes',   (select coalesce(sum((o.metadata->>'size')::bigint), 0)
                           from storage.objects o),
    'arquivos_qtd',     (select count(*) from storage.objects),
    'usuarios_total',   (select count(*) from auth.users),
    'usuarios_ativos',  public.usuarios_ativos_no_ciclo(),
    'ciclo_inicio',     v_ciclo.inicio,
    'ciclo_fim',        v_ciclo.fim,
    'barbearias',       (select count(*) from public.salons),
    'tabelas', (
      select coalesce(jsonb_agg(t order by t.bytes desc), '[]'::jsonb)
        from (
          select c.relname as nome,
                 pg_total_relation_size(c.oid) as bytes,
                 coalesce(s.n_live_tup, 0) as linhas
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            left join pg_stat_user_tables s on s.relid = c.oid
           where n.nspname = 'public' and c.relkind = 'r'
           order by pg_total_relation_size(c.oid) desc
           limit 8
        ) t
    )
  ) into v_resultado;

  return v_resultado;
end
$fn$;

revoke execute on function public.admin_uso_plataforma() from public, anon;
grant  execute on function public.admin_uso_plataforma() to authenticated;

-- ===== GRAVAÇÃO E LEITURA DO HISTÓRICO =====

create or replace function public.registrar_uso_diario()
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  insert into public.uso_historico
    (dia, banco_bytes, arquivos_bytes, usuarios_ativos, usuarios_total, medido_em)
  select (now() at time zone 'America/Sao_Paulo')::date,
         (select sum(pg_database_size(d.datname))::bigint from pg_database d),
         (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
         public.usuarios_ativos_no_ciclo(),
         (select count(*) from auth.users),
         now()
  on conflict (dia) do update
     set banco_bytes     = excluded.banco_bytes,
         arquivos_bytes  = excluded.arquivos_bytes,
         usuarios_ativos = excluded.usuarios_ativos,
         usuarios_total  = excluded.usuarios_total,
         medido_em       = excluded.medido_em;
$fn$;

revoke execute on function public.registrar_uso_diario() from public, anon, authenticated;

create or replace function public.admin_uso_historico(p_dias integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(h) - 'medido_em' order by h.dia), '[]'::jsonb)
      from public.uso_historico h
     where h.dia > (now() at time zone 'America/Sao_Paulo')::date - least(greatest(p_dias, 1), 366)
  );
end
$fn$;

revoke execute on function public.admin_uso_historico(integer) from public, anon;
grant  execute on function public.admin_uso_historico(integer) to authenticated;

-- Todo dia às 03:00 de Brasília. Com o mesmo nome, substitui em vez de duplicar.
select cron.schedule('registrar-uso-diario', '0 6 * * *', 'select public.registrar_uso_diario()');

-- ===== FUNÇÃO ANTIGA =====

-- A tela antiga usava esta; a nova usa admin_uso_plataforma.
drop function if exists public.admin_uso_banco();

-- Regrava a medição de hoje com o ciclo certo.
select public.registrar_uso_diario();
