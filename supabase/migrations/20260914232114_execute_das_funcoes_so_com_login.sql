-- Aplicada no banco em 14/09/2026 (UTC) pelo conector, registrada lá como
-- "execute_das_funcoes_so_com_login".
--
-- Conferido em 13/09/2026: 21 das 23 funções do public tinham EXECUTE para
-- PUBLIC, o que inclui anon. Nenhuma expunha dado sem login (todas checam
-- auth.uid() ou eh_admin() por dentro), mas a porta ficava aberta à toa e o
-- advisor de segurança acusava as 21.
--
-- Três grupos:
--
-- 1. Só com login. Sai o EXECUTE de PUBLIC e de anon; fica um grant EXPLÍCITO
--    para authenticated. get_salon_id é a armadilha: as policies de RLS do
--    painel e as de storage (logos) a chamam como o usuário logado. Sem o
--    grant para authenticated o painel inteiro e o envio de logo param.

revoke execute on function public.admin_auditoria_salao(uuid, integer)              from public, anon;
revoke execute on function public.admin_definir_modulo(uuid, text, boolean)         from public, anon;
revoke execute on function public.admin_definir_situacao_salao(uuid, boolean)       from public, anon;
revoke execute on function public.admin_gerar_convite(text, integer)                from public, anon;
revoke execute on function public.admin_listar_convites(integer)                    from public, anon;
revoke execute on function public.admin_listar_saloes()                             from public, anon;
revoke execute on function public.eh_admin()                                        from public, anon;
revoke execute on function public.get_salon_id()                                    from public, anon;
revoke execute on function public.cancelar_meu_agendamento(uuid)                    from public, anon;
revoke execute on function public.criar_agendamento_cliente(uuid, uuid, timestamptz, text, text, text) from public, anon;
revoke execute on function public.meus_agendamentos(uuid)                           from public, anon;
revoke execute on function public.criar_salao_com_convite(text, text, text, text, timestamptz, text)   from public, anon;

grant execute on function public.admin_auditoria_salao(uuid, integer)               to authenticated;
grant execute on function public.admin_definir_modulo(uuid, text, boolean)          to authenticated;
grant execute on function public.admin_definir_situacao_salao(uuid, boolean)        to authenticated;
grant execute on function public.admin_gerar_convite(text, integer)                 to authenticated;
grant execute on function public.admin_listar_convites(integer)                     to authenticated;
grant execute on function public.admin_listar_saloes()                              to authenticated;
grant execute on function public.eh_admin()                                         to authenticated;
grant execute on function public.get_salon_id()                                     to authenticated;
grant execute on function public.cancelar_meu_agendamento(uuid)                     to authenticated;
grant execute on function public.criar_agendamento_cliente(uuid, uuid, timestamptz, text, text, text)  to authenticated;
grant execute on function public.meus_agendamentos(uuid)                            to authenticated;
grant execute on function public.criar_salao_com_convite(text, text, text, text, timestamptz, text)    to authenticated;

-- 2. Gatilhos. Ninguém chama por nome; trigger e event trigger disparam sem
--    checar EXECUTE de quem fez a escrita.

revoke execute on function public.seed_modulos_novo_salao()     from public, anon, authenticated;
revoke execute on function public.valida_conflito_agendamento() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()             from public, anon, authenticated;

-- 3. Continuam públicas, sem mudança: salao_ativo, salao_publico,
--    modulo_liberado, horarios_ocupados, slug_disponivel e convite_valido.
--    São a vitrine deslogada e a validação do cadastro.
--
-- Atenção: create or replace mantém estas permissões. Recriar uma destas
-- funções com drop + create devolve o EXECUTE padrão do Supabase para anon;
-- repita o revoke na mesma migration.
