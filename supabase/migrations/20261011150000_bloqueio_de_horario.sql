-- Bloqueio de horario: o dono tira um horario avulso do dia para ninguem
-- marcar nele, como "as 10h eu saio, so atendo de novo as 11h".
--
-- Nao e o almoco. O almoco (pausas_dia / horarios.pausa_*) e UM intervalo por
-- dia, com padrao semanal por tras. O bloqueio e avulso: quantos o dono quiser
-- no mesmo dia, so naquela data. Liberar e apagar a linha.
--
-- Vale para todos: o horario some do link e tambem da agenda do dono.
--
-- Onde a regra se impoe, espelhando o almoco:
--   - horarios_ocupados devolve o bloqueio no formato de um agendamento, e a
--     tela do cliente o esconde sem saber o que e;
--   - criar_agendamento_cliente recusa quem tentar pelo link mesmo assim;
--   - o painel desconta na tela.

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

-- A busca e sempre "os bloqueios deste salao nestas datas"
create index bloqueios_horario_salon_data_idx
  on public.bloqueios_horario (salon_id, data);

alter table public.bloqueios_horario enable row level security;

-- Mesmas politicas de pausas_dia: le quem enxerga o salao (inclui o admin
-- observando), escreve so o dono.
create policy bloqueios_horario_leitura on public.bloqueios_horario as permissive for select to authenticated
  using ((salon_id = get_salon_id()));

create policy bloqueios_horario_insercao on public.bloqueios_horario as permissive for insert to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy bloqueios_horario_alteracao on public.bloqueios_horario as permissive for update to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy bloqueios_horario_exclusao on public.bloqueios_horario as permissive for delete to authenticated
  using ((salon_id = get_salon_id_proprio()));

-- O anonimo nunca le a tabela: o que chega ao link passa por horarios_ocupados,
-- que e SECURITY DEFINER.


-- ── A tela do cliente esconde o horario bloqueado ────────────────────────
-- Corpo identico ao que estava no banco, com um union all a mais.

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
  -- Pausa de cada dia da janela, no formato de um agendamento: a tela do
  -- cliente esconde o horário sem precisar saber que é almoço.
  select (d::date + p.inicio) at time zone 'America/Sao_Paulo', p.minutos
  from generate_series(
         (p_inicio at time zone 'America/Sao_Paulo')::date::timestamp,
         (least(p_fim, p_inicio + interval '31 days') at time zone 'America/Sao_Paulo')::date::timestamp,
         interval '1 day') as d
  cross join lateral public.pausa_do_dia(p_salon_id, d::date) as p
  where p.inicio is not null
  union all
  -- Bloqueios avulsos do periodo, tambem no formato de um agendamento.
  select (b.data + b.inicio) at time zone 'America/Sao_Paulo', b.minutos
  from bloqueios_horario b
  where b.salon_id = p_salon_id
    and b.data >= (p_inicio at time zone 'America/Sao_Paulo')::date
    and b.data <= (least(p_fim, p_inicio + interval '31 days') at time zone 'America/Sao_Paulo')::date;
$function$
;


-- ── E o link recusa gravar nesse horario ─────────────────────────────────
-- Corpo identico ao que estava no banco, com a checagem de bloqueio logo
-- depois da checagem da pausa.

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

  -- Horário fixo: cria as datas que entraram na janela de 3 meses ANTES de
  -- gravar este agendamento, para o cliente do link não pegar o horário de
  -- quem é fixo. Se a geração falhar, o agendamento segue: um defeito no fixo
  -- não pode impedir a barbearia de receber cliente.
  begin
    perform public.gerar_agendamentos_fixos(p_salon_id);
  exception when others then
    raise warning 'gerar_agendamentos_fixos falhou para %: %', p_salon_id, sqlerrm;
  end;

  -- Expediente do dia: data especial, linha da semana, padrão.
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
      -- Dia sem linha: não deveria mais acontecer, as linhas nascem com a
      -- barbearia. Vale o mesmo padrão do cadastro.
      select p.ativo, p.abertura, p.fechamento into v_ativo, v_abertura, v_fechamento
      from public.horario_padrao(extract(dow from v_dia)::int) as p;
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

  -- Pausa: o serviço não pode encostar no intervalo do barbeiro. O texto vai
  -- direto para o cliente (AgendarPage mostra a mensagem de P0001).
  select * into v_pausa from public.pausa_do_dia(p_salon_id, v_dia);
  if v_pausa.inicio is not null
     and v_local < v_dia + v_pausa.inicio + make_interval(mins => v_pausa.minutos)
     and v_local + make_interval(mins => v_duracao) > v_dia + v_pausa.inicio then
    raise exception 'Esse horário é o intervalo da barbearia. Escolha outro.' using errcode = 'P0001';
  end if;

  -- Bloqueio avulso: o dono tirou este horario do dia (saida, compromisso).
  -- Mesma forma da pausa, so que pode haver varios no mesmo dia. A mensagem e
  -- a mesma do intervalo de proposito: para quem agenda pelo link, o motivo
  -- nao muda nada, e o AgendarPage ja sabe exibir esse texto.
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

  -- limite de 2 agendamentos futuros por cliente, para evitar que alguém
  -- trave a agenda marcando horário em série.
  -- Horário fixo: as datas do fixo não contam. Foi o dono quem marcou, e com
  -- elas contando o cliente fixo nunca mais marcaria um horário extra.
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
