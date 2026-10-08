-- As três são funções de trigger: nada as chama por nome, o disparo é feito
-- pelo próprio Postgres, que não verifica EXECUTE no momento do disparo (o
-- privilégio é conferido na criação do trigger). Deixá-las abertas em
-- /rest/v1/rpc/ só oferecia superfície: seed_modulos_novo_salao e
-- valida_conflito_agendamento quebram sem contexto de trigger, mas
-- salons_resolve_dono_id lê auth.users como SECURITY DEFINER.
revoke execute on function public.seed_modulos_novo_salao()      from public, anon, authenticated;
revoke execute on function public.valida_conflito_agendamento()  from public, anon, authenticated;
revoke execute on function public.salons_resolve_dono_id()       from public, anon, authenticated;
