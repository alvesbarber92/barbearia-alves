-- Aplicada no banco em 18/09/2026 (UTC), registrada lá como
-- "vitrine_por_slug_e_ocupados_so_com_login".
--
-- Fecha os dois vazamentos entre barbearias que sobravam depois da correção de
-- privilégio de coluna. Nenhum deles expunha dado privado — preço, horário de
-- funcionamento e agenda cheia/vazia já aparecem na página pública de cada
-- barbearia. O problema era poder varrer a base inteira de uma vez.
--
-- ===== 1. Vitrine sem recorte =====
--
-- As policies `servicos_vitrine_leitura`, `horarios_vitrine_leitura` e
-- `dias_especiais_vitrine_leitura` liberavam leitura de TODAS as barbearias
-- ativas, não só a que está sendo visitada. RLS não resolve isso sozinho: a
-- policy não tem como saber qual barbearia o visitante está olhando. A saída é
-- fechar a tabela e servir a vitrine por função, que recebe o slug.
--
-- ===== 2. horarios_ocupados pública =====
--
-- Qualquer pessoa lia a agenda cheia/vazia de qualquer barbearia, bastando o
-- salon_id — que sai de `salao_publico`. A tela só mostra horário depois do
-- login do cliente, então `anon` não precisa da função. A janela também passa a
-- ter teto: a tela pede um dia por vez, e sem limite alguém puxava um ano numa
-- chamada só.
--
-- O frontend acompanha esta migration no mesmo commit: `AgendarPage` e
-- `SalonPublicPage` passam a chamar as RPCs, e o `userId` entra na chave do
-- efeito de `horarios_ocupados` — sem isso a busca dispararia antes do login,
-- tomaria 403 e não rodaria de novo, deixando o cliente com erro no lugar dos
-- horários.

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

-- Com a vitrine servida por função, a leitura direta das tabelas deixa de ser
-- necessária. O dono continua lendo as suas pelas policies de isolamento, e o
-- cliente logado passa a enxergar a barbearia só pelas funções acima.
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
