-- Aplicada no banco em 11/09/2026. Registrada aqui para a pasta de migrations
-- nao ficar mais fora de sincronia do que ja esta.
--
-- O agendamento feito pelo cliente no link nascia 'pendente'. Nada no produto
-- confirmava: nao existe tela para isso, o StatusBadge mostrava "confirmado"
-- de qualquer jeito, e o financeiro filtra status='confirmado' -- entao todo
-- agendamento online ficava invisivel no caixa, para sempre.
--
-- A tela do cliente ja diz "Agendamento confirmado" ao terminar. O produto nao
-- tem etapa de aprovacao; 'pendente' era rotulo errado. Passa a nascer
-- 'confirmado', que e tambem o default da coluna.
--
-- Corpo identico ao anterior, trocando apenas o literal do insert. O limite de
-- 2 futuros por cliente e a checagem status in ('pendente','confirmado') ficam
-- como estavam -- a segunda continua tolerando linhas antigas.

CREATE OR REPLACE FUNCTION public.criar_agendamento_cliente(p_salon_id uuid, p_servico_id uuid, p_data_hora timestamp with time zone, p_nome text, p_telefone text, p_observacoes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_cliente   uuid;
  v_nome_serv text;
  v_preco     numeric;
  v_futuros   int;
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado para agendar' using errcode = 'P0001';
  end if;

  if p_data_hora is null or p_data_hora <= now() then
    raise exception 'A data do agendamento tem de ser futura' using errcode = 'P0001';
  end if;

  select s.nome, s.preco into v_nome_serv, v_preco
  from servicos s
  where s.id = p_servico_id and s.salon_id = p_salon_id and s.ativo;

  if v_nome_serv is null then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  if not exists (select 1 from salons where id = p_salon_id and ativo) then
    raise exception 'Barbearia indisponível' using errcode = 'P0001';
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

-- Linhas que ja nasceram com o rotulo errado.
update agendamentos set status = 'confirmado' where status = 'pendente';
