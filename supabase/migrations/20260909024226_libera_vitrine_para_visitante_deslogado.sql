create or replace function public.salao_ativo(p_salon_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from salons s where s.id = p_salon_id and s.ativo);
$$;

revoke execute on function public.salao_ativo(uuid) from public;
grant  execute on function public.salao_ativo(uuid) to anon, authenticated;

drop policy if exists servicos_publico_leitura on public.servicos;

create policy servicos_vitrine_leitura on public.servicos
  for select to anon, authenticated
  using (ativo = true and public.salao_ativo(salon_id));

drop policy if exists horarios_publico_leitura on public.horarios;

create policy horarios_vitrine_leitura on public.horarios
  for select to anon, authenticated
  using (public.salao_ativo(salon_id));
