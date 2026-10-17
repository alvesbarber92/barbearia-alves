create or replace function public.gerar_agendamentos_fixos(p_salon_id uuid, p_fixo_id uuid default null)
returns table(fixo uuid, dia date, situacao text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  f           record;
  v_exp       record;
  v_pausa     record;
  v_limite    date := ((now() at time zone 'America/Sao_Paulo')::date + interval '3 months')::date;
  v_passo     integer;
  v_dia       date;
  v_inicio    timestamptz;
  v_nome      text;
  v_preco     numeric;
  v_duracao   integer;
begin
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
    continue when v_nome is null;

    v_passo := 7 * f.intervalo_semanas;
    v_dia := f.data_inicio;
    if f.gerado_ate is not null and f.gerado_ate >= v_dia then
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
           or f.hora + make_interval(mins => v_duracao) < f.hora then
          situacao := 'fechado';
        elsif v_pausa.inicio is not null
              and f.hora < v_pausa.inicio + make_interval(mins => v_pausa.minutos)
              and f.hora + make_interval(mins => v_duracao) > v_pausa.inicio then
          situacao := 'pausa';
        elsif exists (
          select 1 from bloqueios_horario b
          where b.salon_id = p_salon_id
            and b.data = v_dia
            and f.hora < b.inicio + make_interval(mins => b.minutos)
            and f.hora + make_interval(mins => v_duracao) > b.inicio
        ) then
          situacao := 'bloqueado';
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
