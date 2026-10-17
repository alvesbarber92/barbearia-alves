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

revoke execute on function public.seed_modulos_novo_salao()     from public, anon, authenticated;
revoke execute on function public.valida_conflito_agendamento() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()             from public, anon, authenticated;

