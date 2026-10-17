create or replace function public.criar_agendamento_cliente(
  p_salon_id    uuid,
  p_servico_id  uuid,
  p_data_hora   timestamptz,
  p_nome        text,
  p_telefone    text,
  p_observacoes text default null
) returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_cliente   uuid;
  v_nome_serv text;
  v_preco     numeric;
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado para agendar' using errcode = 'P0001';
  end if;

  if p_data_hora is null or p_data_hora <= now() then
    raise exception 'A data do agendamento tem de ser futura' using errcode = 'P0001';
  end if;

  select s.nome, s.preco into v_nome_serv, v_preco
  from servicos s
  where s.id = p_servico_id
    and s.salon_id = p_salon_id
    and s.ativo;

  if v_nome_serv is null then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  if not exists (select 1 from salons where id = p_salon_id and ativo) then
    raise exception 'Salão indisponível' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select c.id into v_cliente
  from clientes c
  where c.salon_id = p_salon_id and c.auth_user_id = v_uid;

  if v_cliente is null then
    insert into clientes (salon_id, auth_user_id, nome, telefone, email)
    values (p_salon_id, v_uid, p_nome, p_telefone, v_email)
    returning id into v_cliente;
  else
    update clientes
       set nome     = coalesce(p_nome, nome),
           telefone = coalesce(p_telefone, telefone)
     where id = v_cliente;
  end if;

  insert into agendamentos (
    salon_id, cliente_id, servico_id, servico, data_hora, status, valor, observacoes
  ) values (
    p_salon_id, v_cliente, p_servico_id, v_nome_serv, p_data_hora, 'pendente', v_preco,
    nullif(btrim(coalesce(p_observacoes, '')), '')
  ) returning id into v_id;

  return v_id;
end $$;

create or replace function public.meus_agendamentos(p_salon_id uuid default null)
returns table (
  id uuid, salon_id uuid, servico text, data_hora timestamptz,
  status text, valor numeric, salao_nome text, salao_slug text
)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select a.id, a.salon_id, a.servico, a.data_hora, a.status, a.valor, s.nome, s.slug
  from agendamentos a
  join salons  s on s.id = a.salon_id
  join clientes c on c.id = a.cliente_id
  where c.auth_user_id = auth.uid()
    and (p_salon_id is null or a.salon_id = p_salon_id)
  order by a.data_hora desc
$$;

create or replace function public.cancelar_meu_agendamento(p_agendamento_id uuid)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_afetadas int;
begin
  update agendamentos a
     set status = 'cancelado'
   where a.id = p_agendamento_id
     and a.status in ('pendente', 'confirmado')
     and a.data_hora > now()
     and a.cliente_id in (select c.id from clientes c where c.auth_user_id = auth.uid());

  get diagnostics v_afetadas = row_count;
  if v_afetadas = 0 then
    raise exception 'Agendamento não encontrado ou não pode mais ser cancelado'
      using errcode = 'P0001';
  end if;
end $$;

grant execute on function public.criar_agendamento_cliente(uuid, uuid, timestamptz, text, text, text) to authenticated;
grant execute on function public.meus_agendamentos(uuid)         to authenticated;
grant execute on function public.cancelar_meu_agendamento(uuid)  to authenticated;

drop policy if exists cliente_insert_agendamentos      on public.agendamentos;
drop policy if exists cliente_select_agendamentos      on public.agendamentos;
drop policy if exists cliente_cancela_agendamentos     on public.agendamentos;
drop policy if exists cliente_select_proprio_registro  on public.clientes;
drop policy if exists cliente_insert_proprio_registro  on public.clientes;
drop policy if exists cliente_update_proprio_registro  on public.clientes;
