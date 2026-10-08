-- Horário fixo: o cliente que vem toda sexta às 18:00 fica com o horário
-- reservado, e ninguém mais consegue marcar por cima.
--
-- A regra mora em `horarios_fixos`, mas o que reserva a agenda são linhas de
-- verdade em `agendamentos`, uma por data, até o limite de 3 meses que a agenda
-- já tem. Assim a trava de conflito (`valida_conflito_agendamento`) protege o
-- horário sem mudar nada, e Agenda, Dashboard e Financeiro enxergam cada data
-- como um atendimento comum: concluído, faltou, receita no dia certo.
--
-- A janela de 3 meses anda um dia por dia. As datas novas são criadas por
-- `gerar_agendamentos_fixos`, chamada em dois lugares:
--   * `criar_agendamento_cliente`, ANTES de gravar o agendamento do link. É o
--     que fecha a brecha: no dia em que uma sexta nova entra na janela, o
--     cliente do link não consegue pegá-la antes do fixo.
--   * a tela de Agenda do dono, ao abrir (`gerar_meus_horarios_fixos`), para o
--     dono também não marcar por cima.
--
-- Só acrescenta: tabela nova, coluna nova que aceita nulo e funções novas. A
-- única função existente que muda é `criar_agendamento_cliente`, e sem nenhum
-- horário fixo cadastrado ela se comporta exatamente como antes.

-- ===== TABELA =====

create table public.horarios_fixos (
  id                uuid        not null default gen_random_uuid(),
  salon_id          uuid        not null,
  cliente_id        uuid        not null,
  servico_id        uuid,
  -- Primeira data. As seguintes saem dela somando o intervalo, então o dia da
  -- semana é sempre o mesmo. "Mensal" é a cada 4 semanas, não "todo dia 25":
  -- o cliente de sexta continua na sexta.
  data_inicio       date        not null,
  hora              time        not null,
  intervalo_semanas integer     not null,
  observacoes       text,
  ativo             boolean     not null default true,
  -- Até onde as datas já foram criadas. Data cancelada antes disso não volta:
  -- é o dono dizendo "essa sexta ele não vem".
  gerado_ate        date,
  criado_em         timestamptz not null default now(),
  encerrado_em      timestamptz,
  constraint horarios_fixos_pkey primary key (id),
  constraint horarios_fixos_intervalo_check check (intervalo_semanas in (1, 2, 4)),
  constraint horarios_fixos_salon_id_fkey foreign key (salon_id)
    references public.salons(id) on delete cascade,
  constraint horarios_fixos_cliente_id_fkey foreign key (cliente_id)
    references public.clientes(id) on delete cascade,
  constraint horarios_fixos_servico_id_fkey foreign key (servico_id)
    references public.servicos(id) on delete set null
);

create index idx_horarios_fixos_salon on public.horarios_fixos using btree (salon_id) where ativo;

alter table public.horarios_fixos enable row level security;

-- Só leitura direta. Criar, gerar e encerrar passam pelas funções abaixo, que
-- conferem se o cliente e o serviço são da barbearia. Sem policy de escrita, o
-- RLS já recusa; o revoke deixa isso explícito.
create policy horarios_fixos_leitura on public.horarios_fixos as permissive for select to authenticated
  using ((salon_id = get_salon_id()));

revoke insert, update, delete on public.horarios_fixos from anon, authenticated;

-- De qual horário fixo o agendamento veio. Nulo em todo agendamento avulso,
-- que é o que existe hoje.
alter table public.agendamentos add column fixo_id uuid;
alter table public.agendamentos add constraint agendamentos_fixo_id_fkey foreign key (fixo_id)
  references public.horarios_fixos(id) on delete set null;
create index idx_agendamentos_fixo on public.agendamentos using btree (fixo_id) where fixo_id is not null;

-- ===== FUNÇÕES INTERNAS =====

-- Expediente de um dia: data especial, linha da semana, padrão. A mesma
-- precedência de `criar_agendamento_cliente` e da tela.
create or replace function public.expediente_do_dia(p_salon_id uuid, p_dia date,
  out fechado boolean, out abertura time, out fechamento time)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_ativo boolean;
begin
  select de.fechado, de.abertura, de.fechamento into fechado, abertura, fechamento
  from dias_especiais de
  where de.salon_id = p_salon_id and de.data = p_dia;
  if found then return; end if;

  select h.ativo, h.abertura, h.fechamento into v_ativo, abertura, fechamento
  from horarios h
  where h.salon_id = p_salon_id and h.dia_semana = extract(dow from p_dia)::int;
  if not found then
    select p.ativo, p.abertura, p.fechamento into v_ativo, abertura, fechamento
    from public.horario_padrao(extract(dow from p_dia)::int) as p;
  end if;
  fechado := not coalesce(v_ativo, false);
end $$;

-- Cria as datas que faltam dos horários fixos ativos de uma barbearia, até o
-- limite de 3 meses. Devolve o que aconteceu com cada data nova:
--   marcado  -> virou agendamento
--   ocupado  -> já havia alguém nesse horário; a data é pulada, ninguém perde
--               o horário que já tinha
--   fechado  -> a barbearia não abre, ou o serviço não cabe no expediente
create or replace function public.gerar_agendamentos_fixos(p_salon_id uuid, p_fixo_id uuid default null)
returns table(fixo uuid, dia date, situacao text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  f         record;
  v_exp     record;
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  -- Último dia que `valida_limite_agendamento` aceita
  v_limite  date := ((now() at time zone 'America/Sao_Paulo')::date + interval '3 months')::date;
  v_passo   integer;
  v_dia     date;
  v_inicio  timestamptz;
  v_nome    text;
  v_preco   numeric;
  v_duracao integer;
begin
  -- Mesma trava do trigger de conflito: duas gerações simultâneas (dois
  -- clientes marcando ao mesmo tempo) não criam a mesma data duas vezes.
  perform pg_advisory_xact_lock(hashtextextended(p_salon_id::text, 0));

  for f in
    select h.* from horarios_fixos h
    where h.salon_id = p_salon_id
      and h.ativo
      and (p_fixo_id is null or h.id = p_fixo_id)
      and (h.gerado_ate is null or h.gerado_ate < v_limite)
    for update
  loop
    select s.nome, s.preco, coalesce(s.duracao, 30) into v_nome, v_preco, v_duracao
    from servicos s where s.id = f.servico_id;
    -- Serviço apagado: o fixo para de gerar, mas as datas já criadas ficam.
    continue when v_nome is null;

    v_passo := 7 * f.intervalo_semanas;
    v_dia := f.data_inicio;
    if f.gerado_ate is not null and f.gerado_ate >= v_dia then
      -- Primeira data depois da última já gerada
      v_dia := f.data_inicio + ((f.gerado_ate - f.data_inicio) / v_passo + 1) * v_passo;
    end if;

    while v_dia <= v_limite loop
      v_inicio := (v_dia + f.hora) at time zone 'America/Sao_Paulo';
      if v_inicio > now() then
        select * into v_exp from public.expediente_do_dia(p_salon_id, v_dia);
        fixo := f.id; dia := v_dia;

        if v_exp.fechado
           or f.hora < v_exp.abertura
           or f.hora + make_interval(mins => v_duracao) > v_exp.fechamento
           or f.hora + make_interval(mins => v_duracao) < f.hora then  -- passou da meia-noite
          situacao := 'fechado';
        elsif exists (
          select 1 from agendamentos a
          where a.salon_id = p_salon_id
            and a.status <> 'cancelado'
            and a.data_hora < v_inicio + make_interval(mins => v_duracao)
            and a.data_hora + make_interval(mins => a.duracao) > v_inicio
        ) then
          situacao := 'ocupado';
        else
          insert into agendamentos (salon_id, cliente_id, servico_id, servico, data_hora,
                                    status, valor, observacoes, duracao, fixo_id)
          values (p_salon_id, f.cliente_id, f.servico_id, v_nome, v_inicio,
                  'confirmado', v_preco, f.observacoes, v_duracao, f.id);
          situacao := 'marcado';
        end if;
        return next;
      end if;
      v_dia := v_dia + v_passo;
    end loop;

    update horarios_fixos set gerado_ate = v_limite where id = f.id;
  end loop;
end $$;

-- ===== FUNÇÕES DO DONO =====

create or replace function public.criar_horario_fixo(p_cliente_id uuid, p_servico_id uuid,
  p_data_inicio date, p_hora time, p_intervalo_semanas integer, p_observacoes text default null)
returns table(fixo uuid, dia date, situacao text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_salon uuid := public.get_salon_id_proprio();
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_id    uuid;
begin
  if v_salon is null then
    raise exception 'Sem permissão' using errcode = 'P0001';
  end if;
  if p_intervalo_semanas is null or p_intervalo_semanas not in (1, 2, 4) then
    raise exception 'Repetição inválida' using errcode = 'P0001';
  end if;
  if p_data_inicio is null or p_hora is null then
    raise exception 'Informe a data e o horário' using errcode = 'P0001';
  end if;
  if p_data_inicio < v_hoje then
    raise exception 'A primeira data não pode ser no passado' using errcode = 'P0001';
  end if;
  if p_data_inicio > (v_hoje + interval '3 months')::date then
    raise exception 'agendamento permitido até 3 meses à frente' using errcode = 'P0001';
  end if;
  if not exists (select 1 from clientes c where c.id = p_cliente_id and c.salon_id = v_salon) then
    raise exception 'Cliente não encontrado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from servicos s where s.id = p_servico_id and s.salon_id = v_salon and s.ativo) then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  insert into horarios_fixos (salon_id, cliente_id, servico_id, data_inicio, hora,
                              intervalo_semanas, observacoes)
  values (v_salon, p_cliente_id, p_servico_id, p_data_inicio, p_hora, p_intervalo_semanas,
          nullif(btrim(coalesce(p_observacoes, '')), ''))
  returning id into v_id;

  return query select * from public.gerar_agendamentos_fixos(v_salon, v_id);

  -- Nenhuma data livre: desfaz tudo em vez de deixar um fixo que não reserva nada
  if not exists (select 1 from agendamentos a where a.fixo_id = v_id) then
    raise exception 'Nenhuma data livre para esse horário fixo' using errcode = 'P0001';
  end if;
end $$;

-- Encerra o fixo e libera as datas futuras. As passadas ficam como estão:
-- são histórico e receita.
create or replace function public.encerrar_horario_fixo(p_fixo_id uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_salon uuid := public.get_salon_id_proprio();
  v_canceladas integer;
begin
  update horarios_fixos
     set ativo = false, encerrado_em = now()
   where id = p_fixo_id and salon_id = v_salon and ativo;
  if not found then
    raise exception 'Horário fixo não encontrado' using errcode = 'P0001';
  end if;

  update agendamentos
     set status = 'cancelado'
   where fixo_id = p_fixo_id
     and salon_id = v_salon
     and status in ('pendente', 'confirmado')
     and data_hora > now();
  get diagnostics v_canceladas = row_count;
  return v_canceladas;
end $$;

-- Chamada pela tela de Agenda ao abrir. Admin observando não tem barbearia
-- própria: não gera nada, e a observação continua somente leitura.
create or replace function public.gerar_meus_horarios_fixos()
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_salon uuid := public.get_salon_id_proprio();
  v_marcados integer;
begin
  if v_salon is null then return 0; end if;
  select count(*) into v_marcados
  from public.gerar_agendamentos_fixos(v_salon) g
  where g.situacao = 'marcado';
  return v_marcados;
end $$;

-- ===== AGENDAMENTO PELO LINK =====
--
-- Duas mudanças, marcadas com "Horário fixo" abaixo. O resto é idêntico à
-- versão anterior.

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

-- ===== PRIVILÉGIOS =====

revoke execute on function public.expediente_do_dia(p_salon_id uuid, p_dia date) from public, anon, authenticated;
revoke execute on function public.gerar_agendamentos_fixos(p_salon_id uuid, p_fixo_id uuid) from public, anon, authenticated;

revoke execute on function public.criar_horario_fixo(p_cliente_id uuid, p_servico_id uuid, p_data_inicio date, p_hora time, p_intervalo_semanas integer, p_observacoes text) from public, anon;
grant  execute on function public.criar_horario_fixo(p_cliente_id uuid, p_servico_id uuid, p_data_inicio date, p_hora time, p_intervalo_semanas integer, p_observacoes text) to authenticated;
revoke execute on function public.encerrar_horario_fixo(p_fixo_id uuid) from public, anon;
grant  execute on function public.encerrar_horario_fixo(p_fixo_id uuid) to authenticated;
revoke execute on function public.gerar_meus_horarios_fixos() from public, anon;
grant  execute on function public.gerar_meus_horarios_fixos() to authenticated;
