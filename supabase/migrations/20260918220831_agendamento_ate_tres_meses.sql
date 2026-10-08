-- Agendamento só até 3 meses à frente (inclui o dia inteiro do limite, no
-- horário de Brasília). Vale para todo caminho: painel, RPC do cliente, API.
-- Update que não mexe na data passa, para não travar registros antigos.
create or replace function public.valida_limite_agendamento() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.data_hora is not distinct from old.data_hora then
    return new;
  end if;
  if new.data_hora >= (((now() at time zone 'America/Sao_Paulo')::date
                        + interval '3 months' + interval '1 day')
                       at time zone 'America/Sao_Paulo') then
    raise exception 'agendamento permitido até 3 meses à frente' using errcode = 'check_violation';
  end if;
  return new;
end $$;

revoke execute on function public.valida_limite_agendamento() from public, anon, authenticated;

create trigger trg_valida_limite_agendamento
  before insert or update of data_hora on public.agendamentos
  for each row execute function public.valida_limite_agendamento();
