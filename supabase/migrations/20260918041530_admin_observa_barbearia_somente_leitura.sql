create table if not exists public.admin_observando (
  admin_id    uuid primary key references auth.users(id) on delete cascade,
  salon_id    uuid not null references public.salons(id) on delete cascade,
  iniciado_em timestamptz not null default now()
);

alter table public.admin_observando enable row level security;

create index if not exists idx_admin_observando_salon on public.admin_observando (salon_id);

create or replace function public.get_salon_id_proprio()
returns uuid
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select id from public.salons
   where dono_id = (select auth.uid())
     and ativo
   limit 1;
$fn$;

create or replace function public.get_salon_id()
returns uuid
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select coalesce(
    (select o.salon_id
       from public.admin_observando o
      where o.admin_id = (select auth.uid())
        and public.eh_admin()),
    public.get_salon_id_proprio()
  );
$fn$;

do $$
declare t text;
begin
  foreach t in array array['agendamentos','clientes','dias_especiais','estoque','horarios','servicos','vendas']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_isolamento', t);

    execute format(
      'create policy %I on public.%I as permissive for select to authenticated
         using (salon_id = public.get_salon_id())', t || '_leitura', t);

    execute format(
      'create policy %I on public.%I as permissive for insert to authenticated
         with check (salon_id = public.get_salon_id_proprio())', t || '_insercao', t);

    execute format(
      'create policy %I on public.%I as permissive for update to authenticated
         using (salon_id = public.get_salon_id_proprio())
         with check (salon_id = public.get_salon_id_proprio())', t || '_alteracao', t);

    execute format(
      'create policy %I on public.%I as permissive for delete to authenticated
         using (salon_id = public.get_salon_id_proprio())', t || '_exclusao', t);
  end loop;
end $$;

create policy salons_observacao_leitura on public.salons
  as permissive for select to authenticated
  using (public.eh_admin() and id = public.get_salon_id());

create policy salon_modulos_observacao_leitura on public.salon_modulos
  as permissive for select to authenticated
  using (public.eh_admin() and salon_id = public.get_salon_id());

create or replace function public.admin_observar_salao(p_salon_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare v_slug text;
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  select s.slug into v_slug from salons s where s.id = p_salon_id;
  if v_slug is null then
    raise exception 'barbearia_nao_encontrada' using errcode = 'P0001';
  end if;

  insert into admin_observando (admin_id, salon_id)
  values (auth.uid(), p_salon_id)
  on conflict (admin_id) do update
    set salon_id = excluded.salon_id, iniciado_em = now();

  insert into auditoria_admin (admin_id, salon_id, acao, detalhe)
  values (auth.uid(), p_salon_id, 'observacao_iniciada',
          jsonb_build_object('slug', v_slug));

  return v_slug;
end
$fn$;

create or replace function public.admin_encerrar_observacao()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare v_salon uuid;
begin
  delete from admin_observando where admin_id = auth.uid()
  returning salon_id into v_salon;

  if v_salon is not null then
    insert into auditoria_admin (admin_id, salon_id, acao, detalhe)
    values (auth.uid(), v_salon, 'observacao_encerrada', '{}'::jsonb);
  end if;
end
$fn$;

create or replace function public.salao_atual()
returns jsonb
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select jsonb_build_object(
    'salon', (select to_jsonb(s) from salons s where s.id = public.get_salon_id()),
    'observando', exists (
      select 1 from admin_observando o
       where o.admin_id = (select auth.uid()) and public.eh_admin()
    )
  );
$fn$;

revoke execute on function public.get_salon_id_proprio()          from public, anon;
revoke execute on function public.admin_observar_salao(uuid)      from public, anon;
revoke execute on function public.admin_encerrar_observacao()     from public, anon;
revoke execute on function public.salao_atual()                   from public, anon;
grant  execute on function public.get_salon_id_proprio()          to authenticated;
grant  execute on function public.admin_observar_salao(uuid)      to authenticated;
grant  execute on function public.admin_encerrar_observacao()     to authenticated;
grant  execute on function public.salao_atual()                   to authenticated;
