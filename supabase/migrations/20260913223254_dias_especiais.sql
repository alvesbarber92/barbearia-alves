-- Dias especiais: o dono fecha uma data (feriado, folga) ou dá a ela um horário
-- diferente do da semana, pelo calendário em Configurações > Horários.
--
-- Aplicada no banco em 13/09/2026 pelo conector (registrada lá como
-- "dias_especiais"). Antes, conferido que criar_agendamento_cliente no banco
-- tinha a mesma lógica de 20260911034500, de onde o corpo abaixo parte.
--
-- Precedência do horário de um dia, igual no banco e nas telas:
--   1. linha em dias_especiais para a data (fechado, ou abertura/fechamento)
--   2. linha em horarios para o dia da semana (ativo ou não)
--   3. padrão 09:00–18:00
--
-- Fechar um dia NÃO cancela o que já estava marcado nele (decisão do Ricardo,
-- 13/09/2026): a tela avisa quantos agendamentos ficam e eles continuam.
--
-- criar_agendamento_cliente passa a recusar dia fechado e horário fora do
-- expediente. Até aqui o horário de funcionamento era só filtro de tela.
-- Datas e horas são lidas em America/Sao_Paulo.

create table public.dias_especiais (
  id uuid default gen_random_uuid() not null primary key,
  salon_id uuid not null references public.salons(id) on delete cascade,
  data date not null,
  fechado boolean default true not null,
  abertura time without time zone,
  fechamento time without time zone,
  criado_em timestamp with time zone default now() not null,
  constraint dias_especiais_salon_id_data_key unique (salon_id, data),
  constraint dias_especiais_horario_check check (
    (fechado and abertura is null and fechamento is null)
    or (not fechado and abertura is not null and fechamento is not null and fechamento > abertura)
  )
);

alter table public.dias_especiais enable row level security;

create policy dias_especiais_isolamento on public.dias_especiais as PERMISSIVE for ALL to authenticated
  using ((salon_id = get_salon_id()))
  with check ((salon_id = get_salon_id()));

-- Mesma regra de horarios: o link de agendamento lê sem login.
create policy dias_especiais_vitrine_leitura on public.dias_especiais as PERMISSIVE for SELECT to anon, authenticated
  using (salao_ativo(salon_id));

grant select on public.dias_especiais to anon;
grant select, insert, update, delete on public.dias_especiais to authenticated;


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
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado para agendar' using errcode = 'P0001';
  end if;

  if p_data_hora is null or p_data_hora <= now() then
    raise exception 'A data do agendamento tem de ser futura' using errcode = 'P0001';
  end if;

  -- Serviço tem de pertencer a este salão e estar ativo. É o que impede
  -- preço forjado e agendamento de serviço de outra barbearia.
  select s.nome, s.preco, coalesce(s.duracao, 30) into v_nome_serv, v_preco, v_duracao
  from servicos s
  where s.id = p_servico_id and s.salon_id = p_salon_id and s.ativo;

  if v_nome_serv is null then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  if not exists (select 1 from salons where id = p_salon_id and ativo) then
    raise exception 'Barbearia indisponível' using errcode = 'P0001';
  end if;

  -- Expediente do dia, na precedência do cabeçalho.
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
      v_ativo := true;
      v_abertura := '09:00';
      v_fechamento := '18:00';
    end if;
    v_fechado := not v_ativo;
  end if;

  -- As mensagens são lidas pelo AgendarPage: mudar o texto quebra o aviso.
  if v_fechado then
    raise exception 'A barbearia não abre neste dia' using errcode = 'P0001';
  end if;

  -- Serviço sem duração conta 30 min, como no trigger de conflito. A tela usa
  -- 60, então o banco nunca recusa um horário que a tela ofereceu.
  if v_local < v_dia + v_abertura
     or v_local + make_interval(mins => v_duracao) > v_dia + v_fechamento then
    raise exception 'Horário fora do expediente da barbearia' using errcode = 'P0001';
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
    and a.data_hora > now();

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
$function$;
