create table public.bloqueios_horario (
  id uuid default gen_random_uuid() not null primary key,
  salon_id uuid not null references public.salons(id) on delete cascade,
  data date not null,
  inicio time without time zone not null,
  minutos integer not null,
  criado_em timestamp with time zone default now() not null,
  constraint bloqueios_horario_minutos_check check (minutos >= 5 and minutos <= 480),
  constraint bloqueios_horario_unico unique (salon_id, data, inicio)
);

create index bloqueios_horario_salon_data_idx
  on public.bloqueios_horario (salon_id, data);

alter table public.bloqueios_horario enable row level security;

create policy bloqueios_horario_leitura on public.bloqueios_horario as permissive for select to authenticated
  using ((salon_id = get_salon_id()));

create policy bloqueios_horario_insercao on public.bloqueios_horario as permissive for insert to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy bloqueios_horario_alteracao on public.bloqueios_horario as permissive for update to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy bloqueios_horario_exclusao on public.bloqueios_horario as permissive for delete to authenticated
  using ((salon_id = get_salon_id_proprio()));

CREATE OR REPLACE FUNCTION public.horarios_ocupados(p_salon_id uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone)
 RETURNS TABLE(data_hora timestamp with time zone, duracao integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select a.data_hora, a.duracao
  from agendamentos a
  where a.salon_id = p_salon_id
    and a.status <> 'cancelado'
    and a.data_hora >= p_inicio
    and a.data_hora < least(p_fim, p_inicio + interval '31 days')
  union all
  select (d::date + p.inicio) at time zone 'America/Sao_Paulo', p.minutos
  from generate_series(
         (p_inicio at time zone 'America/Sao_Paulo')::date::timestamp,
         (least(p_fim, p_inicio + interval '31 days') at time zone 'America/Sao_Paulo')::date::timestamp,
         interval '1 day') as d
  cross join lateral public.pausa_do_dia(p_salon_id, d::date) as p
  where p.inicio is not null
  union all
  select (b.data + b.inicio) at time zone 'America/Sao_Paulo', b.minutos
  from bloqueios_horario b
  where b.salon_id = p_salon_id
    and b.data >= (p_inicio at time zone 'America/Sao_Paulo')::date
    and b.data <= (least(p_fim, p_inicio + interval '31 days') at time zone 'America/Sao_Paulo')::date;
$function$
;

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
