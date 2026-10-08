-- A vitrine do salão voltou a ficar vazia para quem não está logado.
--
-- Causa: `servicos_publico_leitura` e `horarios_publico_leitura` valiam para
-- `anon`, mas a condição chamava `get_salon_id()` — e o `anon` perdeu o EXECUTE
-- dessa função quando o acesso direto da cliente foi fechado. O Postgres esbarra
-- na permissão antes de chegar no ramo `auth.uid() is null`, que existia
-- justamente para liberar a visitante. Resultado: 401 em vez de leitura.
--
-- Decisão do produto: preço e horário são públicos (é o que faz a cliente criar
-- conta); AGENDAR continua exigindo login, o que é imposto por
-- `criar_agendamento_cliente` e não por estas policies.
--
-- As policies novas não citam `salons` direto: o `anon` também não tem SELECT
-- nessa tabela, e o subselect falharia pelo mesmo motivo. Daí a função abaixo.

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

-- Serviços: catálogo público do salão ativo. A dona continua enxergando os
-- inativos pela policy `servicos_isolamento`, que não é tocada aqui.
drop policy if exists servicos_publico_leitura on public.servicos;

create policy servicos_vitrine_leitura on public.servicos
  for select to anon, authenticated
  using (ativo = true and public.salao_ativo(salon_id));

-- Horários: mesma regra, sem o filtro de `ativo` da linha (o dia fechado precisa
-- aparecer para a vitrine saber que não abre).
drop policy if exists horarios_publico_leitura on public.horarios;

create policy horarios_vitrine_leitura on public.horarios
  for select to anon, authenticated
  using (public.salao_ativo(salon_id));
