-- Pausa (almoço): o barbeiro tira um intervalo no dia e ninguém consegue marcar
-- nele pelo link.
--
-- Dois níveis, como o expediente:
--   * padrão, em `horarios` (pausa_inicio + pausa_minutos por dia da semana).
--     A tela grava o mesmo valor nos 7 dias; a coluna por dia deixa espaço para
--     um padrão diferente por dia sem migration nova.
--   * do dia, em `pausas_dia`: o dono muda só aquela data ("hoje vou às 12:00,
--     meia hora"). Linha com início nulo quer dizer "sem pausa neste dia".
-- `pausa_do_dia` resolve a precedência: data, depois padrão, depois nenhuma.
--
-- Onde a pausa vale:
--   * `horarios_ocupados` devolve a pausa como se fosse um agendamento. É a
--     função que a tela do cliente já usa para esconder horário ocupado, então
--     o horário do almoço some sem mudança na tela do cliente.
--   * `criar_agendamento_cliente` recusa agendamento que encoste na pausa,
--     para quem chamar a API direto.
--   * `gerar_agendamentos_fixos` pula a data do fixo que cair na pausa.
-- O dono, gravando pela agenda, não é travado pelo banco: a tela dele esconde
-- a pausa, mas ele continua podendo encaixar alguém se quiser.
--
-- Só acrescenta: duas colunas que aceitam nulo, uma tabela nova e uma função
-- nova. As três funções existentes que mudam, sem nenhuma pausa cadastrada, se
-- comportam exatamente como antes.

-- ===== PAUSA PADRÃO =====

alter table public.horarios add column pausa_inicio time;
alter table public.horarios add column pausa_minutos integer;
alter table public.horarios add constraint horarios_pausa_check check (
  (pausa_inicio is null and pausa_minutos is null)
  or (pausa_inicio is not null and pausa_minutos is not null and pausa_minutos between 5 and 480)
);

-- ===== PAUSA DO DIA =====

create table public.pausas_dia (
  id        uuid        not null default gen_random_uuid(),
  salon_id  uuid        not null,
  data      date        not null,
  -- Nulo nos dois: "sem pausa neste dia", mesmo havendo padrão
  inicio    time,
  minutos   integer,
  criado_em timestamptz not null default now(),
  constraint pausas_dia_pkey primary key (id),
  constraint pausas_dia_salon_id_data_key unique (salon_id, data),
  constraint pausas_dia_check check (
    (inicio is null and minutos is null)
    or (inicio is not null and minutos is not null and minutos between 5 and 480)
  ),
  constraint pausas_dia_salon_id_fkey foreign key (salon_id)
    references public.salons(id) on delete cascade
);

alter table public.pausas_dia enable row level security;

-- Mesmo desenho de `dias_especiais`: leitura aceita a barbearia observada pelo
-- admin, escrita só a própria.
create policy pausas_dia_leitura on public.pausas_dia as permissive for select to authenticated
  using ((salon_id = get_salon_id()));
create policy pausas_dia_insercao on public.pausas_dia as permissive for insert to authenticated
  with check ((salon_id = get_salon_id_proprio()));
create policy pausas_dia_alteracao on public.pausas_dia as permissive for update to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));
create policy pausas_dia_exclusao on public.pausas_dia as permissive for delete to authenticated
  using ((salon_id = get_salon_id_proprio()));

-- ===== RESOLUÇÃO =====

create or replace function public.pausa_do_dia(p_salon_id uuid, p_dia date,
  out inicio time, out minutos integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  select pd.inicio, pd.minutos into inicio, minutos
  from pausas_dia pd
  where pd.salon_id = p_salon_id and pd.data = p_dia;
  if found then return; end if;

  select h.pausa_inicio, h.pausa_minutos into inicio, minutos
  from horarios h
  where h.salon_id = p_salon_id and h.dia_semana = extract(dow from p_dia)::int;
end $$;

-- ===== HORÁRIOS OCUPADOS: agendamentos + pausa =====

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
  where p.inicio is not null;
$function$
;

-- ===== HORÁRIO FIXO pula a pausa =====

create or replace function public.gerar_agendamentos_fixos(p_salon_id uuid, p_fixo_id uuid default null)
returns table(fixo uuid, dia date, situacao text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  f           record;
  v_exp       record;
  v_pausa     record;
  -- Último dia que `valida_limite_agendamento` aceita
  v_limite    date := ((now() at time zone 'America/Sao_Paulo')::date + interval '3 months')::date;
  v_passo     integer;
  v_dia       date;
  v_inicio    timestamptz;
  v_nome      text;
  v_preco     numeric;
  v_duracao   integer;
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
        select * into v_pausa from public.pausa_do_dia(p_salon_id, v_dia);
        fixo := f.id; dia := v_dia;

        if v_exp.fechado
           or f.hora < v_exp.abertura
           or f.hora + make_interval(mins => v_duracao) > v_exp.fechamento
           or f.hora + make_interval(mins => v_duracao) < f.hora then  -- passou da meia-noite
          situacao := 'fechado';
        elsif v_pausa.inicio is not null
              and f.hora < v_pausa.inicio + make_interval(mins => v_pausa.minutos)
              and f.hora + make_interval(mins => v_duracao) > v_pausa.inicio then
          situacao := 'pausa';
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

-- ===== AGENDAMENTO PELO LINK recusa a pausa =====
--
-- Uma mudança em relação à versão do horário fixo, marcada com "Pausa" abaixo.

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

revoke execute on function public.pausa_do_dia(p_salon_id uuid, p_dia date) from public, anon, authenticated;
