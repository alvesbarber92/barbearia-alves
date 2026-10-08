-- Aplicada no banco em 14/09/2026 (UTC) pelo conector, registrada lá como
-- "horarios_padrao_da_barbearia".
--
-- Horário inicial de toda barbearia nova: seg–sex 09–18, sáb 09–14, dom fechado.
-- O dono ajusta em Configurações > Horários; cada barbearia tem os seus
-- (decisão do Ricardo, 14/09/2026; o cadastro inicial não ganha etapa de
-- horários).
--
-- Antes: barbearia recém-criada não tinha linha em `horarios`. A tela de
-- Configurações mostrava um padrão (dom fechado, sáb 14h) que não estava
-- gravado, enquanto o link de agendamento e o banco usavam outro (9–18 todo
-- dia). Agora as 7 linhas nascem junto com a barbearia, como os módulos.
--
-- O padrão mora em um lugar só no banco: horario_padrao(). A cópia do
-- frontend (lib/agenda.js, horarioPadrao) tem de bater com ela.

create or replace function public.horario_padrao(p_dia_semana integer)
 returns table(ativo boolean, abertura time without time zone, fechamento time without time zone)
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select p_dia_semana <> 0,
         time '09:00',
         case when p_dia_semana = 6 then time '14:00' else time '18:00' end
$function$;

create or replace function public.seed_horarios_novo_salao()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into public.horarios (salon_id, dia_semana, ativo, abertura, fechamento)
  select new.id, d, p.ativo, p.abertura, p.fechamento
  from generate_series(0, 6) as d
  cross join lateral public.horario_padrao(d) as p
  on conflict (salon_id, dia_semana) do nothing;
  return new;
end;
$function$;

create trigger salons_seed_horarios
  after insert on public.salons
  for each row execute function public.seed_horarios_novo_salao();

-- Ninguém chama por nome: a de trigger dispara sozinha e horario_padrao só é
-- usada por funções do próprio banco.
revoke execute on function public.seed_horarios_novo_salao() from public, anon, authenticated;
revoke execute on function public.horario_padrao(integer) from public, anon, authenticated;

-- Barbearias que já existem e estão sem algum dia. Dia já salvo não é tocado.
insert into public.horarios (salon_id, dia_semana, ativo, abertura, fechamento)
select s.id, d, p.ativo, p.abertura, p.fechamento
from public.salons s
cross join generate_series(0, 6) as d
cross join lateral public.horario_padrao(d) as p
on conflict (salon_id, dia_semana) do nothing;

-- criar_agendamento_cliente: corpo idêntico ao de dias_especiais, trocando só
-- o dia sem linha, que deixa de valer 9–18 todo dia e passa a usar o padrão.
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
