alter table public.agendamentos add column duracao integer;

update public.agendamentos a
   set duracao = coalesce(
         (select s.duracao from public.servicos s where s.id = a.servico_id),
         30)
 where a.duracao is null;

alter table public.agendamentos
  alter column duracao set not null,
  add constraint agendamentos_duracao_positiva check (duracao > 0);

create or replace function public.preenche_duracao_agendamento()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.duracao is null then
    select s.duracao into new.duracao
    from servicos s where s.id = new.servico_id;
    new.duracao := coalesce(new.duracao, 30);
  end if;
  return new;
end;
$function$;

create trigger trg_agendamento_preenche_duracao
  before insert on public.agendamentos
  for each row execute function public.preenche_duracao_agendamento();

revoke execute on function public.preenche_duracao_agendamento() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.valida_conflito_agendamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status = 'cancelado' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.salon_id::text, 0));

  if exists (
    select 1
    from agendamentos a
    where a.salon_id = new.salon_id
      and a.id <> new.id
      and a.status <> 'cancelado'
      and a.data_hora < new.data_hora + make_interval(mins => new.duracao)
      and a.data_hora + make_interval(mins => a.duracao) > new.data_hora
  ) then
    raise exception 'Horario indisponivel: ja existe um agendamento nesse intervalo'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger trg_valida_conflito_agendamento on public.agendamentos;
create trigger trg_valida_conflito_agendamento
  before insert or update of data_hora, status, servico_id, duracao on public.agendamentos
  for each row execute function public.valida_conflito_agendamento();

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
    and a.data_hora < p_fim;
$function$;
