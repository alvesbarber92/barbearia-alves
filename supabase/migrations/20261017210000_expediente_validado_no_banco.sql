create or replace function public.valida_expediente_agendamento()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_local timestamp;
  v_dia   date;
  v_fim   timestamp;
  v_exp   record;
  v_pausa record;
begin
  if new.status = 'cancelado' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status <> 'cancelado'
     and new.data_hora is not distinct from old.data_hora
     and new.duracao is not distinct from old.duracao then
    return new;
  end if;

  v_local := new.data_hora at time zone 'America/Sao_Paulo';
  v_dia   := v_local::date;
  v_fim   := v_local + make_interval(mins => new.duracao);

  select * into v_exp from public.expediente_do_dia(new.salon_id, v_dia);
  if v_exp.fechado then
    raise exception 'A barbearia não abre neste dia' using errcode = 'P0001';
  end if;
  if v_local < v_dia + v_exp.abertura or v_fim > v_dia + v_exp.fechamento then
    raise exception 'Horário fora do expediente da barbearia' using errcode = 'P0001';
  end if;

  select * into v_pausa from public.pausa_do_dia(new.salon_id, v_dia);
  if v_pausa.inicio is not null
     and v_local < v_dia + v_pausa.inicio + make_interval(mins => v_pausa.minutos)
     and v_fim > v_dia + v_pausa.inicio then
    raise exception 'Esse horário é o intervalo da barbearia. Escolha outro.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from bloqueios_horario b
    where b.salon_id = new.salon_id
      and b.data = v_dia
      and v_local < v_dia + b.inicio + make_interval(mins => b.minutos)
      and v_fim > v_dia + b.inicio
  ) then
    raise exception 'Esse horário está bloqueado pela barbearia. Escolha outro.' using errcode = 'P0001';
  end if;

  return new;
end $$;

revoke execute on function public.valida_expediente_agendamento() from public, anon, authenticated;

create trigger trg_valida_expediente_agendamento
  before insert or update of data_hora, duracao, status on public.agendamentos
  for each row execute function public.valida_expediente_agendamento();

CREATE OR REPLACE FUNCTION public.criar_agendamento_cliente(p_salon_id uuid, p_servico_id uuid, p_data_hora timestamp with time zone, p_nome text, p_telefone text, p_observacoes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid        uuid := auth.uid();
  v_email      text;
  v_cliente    uuid;
  v_nome_serv  text;
  v_preco      numeric;
  v_duracao    int;
  v_futuros    int;
  v_id         uuid;
  v_local      timestamp;
  v_dia        date;
  v_fechado    boolean;
  v_ativo      boolean;
  v_abertura   time;
  v_fechamento time;
  v_pausa      record;
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado para agendar' using errcode = 'P0001';
  end if;

  if p_data_hora is null or p_data_hora <= now() then
    raise exception 'A data do agendamento tem de ser futura' using errcode = 'P0001';
  end if;

  select s.nome, s.preco, coalesce(s.duracao, 30) into v_nome_serv, v_preco, v_duracao
  from servicos s
  where s.id = p_servico_id and s.salon_id = p_salon_id and s.ativo;

  if v_nome_serv is null then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  if not exists (select 1 from salons where id = p_salon_id and ativo) then
    raise exception 'Barbearia indisponível' using errcode = 'P0001';
  end if;

  begin
    perform public.gerar_agendamentos_fixos(p_salon_id);
  exception when others then
    raise warning 'gerar_agendamentos_fixos falhou para %: %', p_salon_id, sqlerrm;
  end;

  perform pg_advisory_xact_lock(hashtextextended(p_salon_id::text, 0));

  v_local := p_data_hora at time zone 'America/Sao_Paulo';
  v_dia   := v_local::date;

  select de.fechado, de.abertura, de.fechamento into v_fechado, v_abertura, v_fechamento
  from dias_especiais de
  where de.salon_id = p_salon_id and de.data = v_dia;

  if not found then
    select h.ativo, h.abertura, h.fechamento into v_ativo, v_abertura, v_fechamento
    from horarios h
    where h.salon_id = p_salon_id and h.dia_semana = extract(dow from v_dia)::int;

    if not found then
      select p.ativo, p.abertura, p.fechamento into v_ativo, v_abertura, v_fechamento
      from public.horario_padrao(extract(dow from v_dia)::int) as p;
    end if;
    v_fechado := not v_ativo;
  end if;

  if v_fechado then
    raise exception 'A barbearia não abre neste dia' using errcode = 'P0001';
  end if;

  if v_local < v_dia + v_abertura
     or v_local + make_interval(mins => v_duracao) > v_dia + v_fechamento then
    raise exception 'Horário fora do expediente da barbearia' using errcode = 'P0001';
  end if;

  select * into v_pausa from public.pausa_do_dia(p_salon_id, v_dia);
  if v_pausa.inicio is not null
     and v_local < v_dia + v_pausa.inicio + make_interval(mins => v_pausa.minutos)
     and v_local + make_interval(mins => v_duracao) > v_dia + v_pausa.inicio then
    raise exception 'Esse horário é o intervalo da barbearia. Escolha outro.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from bloqueios_horario b
    where b.salon_id = p_salon_id
      and b.data = v_dia
      and v_local < v_dia + b.inicio + make_interval(mins => b.minutos)
      and v_local + make_interval(mins => v_duracao) > v_dia + b.inicio
  ) then
    raise exception 'Esse horário é o intervalo da barbearia. Escolha outro.' using errcode = 'P0001';
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
       set nome = coalesce(p_nome, nome),
           telefone = coalesce(p_telefone, telefone)
     where id = v_cliente;
  end if;

  select count(*) into v_futuros
  from agendamentos a
  where a.cliente_id = v_cliente
    and a.status in ('pendente','confirmado')
    and a.data_hora > now()
    and a.fixo_id is null;

  if v_futuros >= 2 then
    raise exception 'Você já tem 2 horários marcados. Cancele um para marcar outro.'
      using errcode = 'P0001';
  end if;

  insert into agendamentos (
    salon_id, cliente_id, servico_id, servico, data_hora, status, valor, observacoes
  ) values (
    p_salon_id, v_cliente, p_servico_id, v_nome_serv, p_data_hora, 'confirmado', v_preco,
    nullif(btrim(coalesce(p_observacoes, '')), '')
  ) returning id into v_id;

  return v_id;
end;
$function$
;
