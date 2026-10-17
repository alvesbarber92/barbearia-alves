create or replace function public.vitrine_servicos(p_slug text)
returns table (id uuid, nome text, preco numeric, duracao integer)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select sv.id, sv.nome, sv.preco, sv.duracao
  from servicos sv
  join salons s on s.id = sv.salon_id
  where s.slug = p_slug and s.ativo and sv.ativo
  order by sv.nome
$fn$;

create or replace function public.vitrine_horarios(p_slug text)
returns table (dia_semana integer, abertura time, fechamento time, ativo boolean)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select h.dia_semana, h.abertura, h.fechamento, h.ativo
  from horarios h
  join salons s on s.id = h.salon_id
  where s.slug = p_slug and s.ativo
  order by h.dia_semana
$fn$;

create or replace function public.vitrine_dias_especiais(p_slug text, p_desde date default null)
returns table (data date, fechado boolean, abertura time, fechamento time)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select de.data, de.fechado, de.abertura, de.fechamento
  from dias_especiais de
  join salons s on s.id = de.salon_id
  where s.slug = p_slug and s.ativo
    and de.data >= coalesce(p_desde, current_date)
  order by de.data
$fn$;

revoke execute on function public.vitrine_servicos(text)                from public;
revoke execute on function public.vitrine_horarios(text)                from public;
revoke execute on function public.vitrine_dias_especiais(text, date)    from public;
grant  execute on function public.vitrine_servicos(text)                to anon, authenticated;
grant  execute on function public.vitrine_horarios(text)                to anon, authenticated;
grant  execute on function public.vitrine_dias_especiais(text, date)    to anon, authenticated;

drop policy if exists servicos_vitrine_leitura       on public.servicos;
drop policy if exists horarios_vitrine_leitura       on public.horarios;
drop policy if exists dias_especiais_vitrine_leitura on public.dias_especiais;

revoke execute on function public.horarios_ocupados(uuid, timestamptz, timestamptz) from public, anon;

create or replace function public.horarios_ocupados(
  p_salon_id uuid, p_inicio timestamptz, p_fim timestamptz
)
returns table (data_hora timestamptz, duracao integer)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select a.data_hora, a.duracao
  from agendamentos a
  where a.salon_id = p_salon_id
    and a.status <> 'cancelado'
    and a.data_hora >= p_inicio
    and a.data_hora < least(p_fim, p_inicio + interval '31 days');
$fn$;

revoke execute on function public.horarios_ocupados(uuid, timestamptz, timestamptz) from public, anon;
grant  execute on function public.horarios_ocupados(uuid, timestamptz, timestamptz) to authenticated;
