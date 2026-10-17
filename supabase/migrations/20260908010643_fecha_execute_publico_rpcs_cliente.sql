revoke execute on function public.criar_agendamento_cliente(uuid, uuid, timestamptz, text, text, text) from public, anon;
revoke execute on function public.meus_agendamentos(uuid)        from public, anon;
revoke execute on function public.cancelar_meu_agendamento(uuid) from public, anon;

grant execute on function public.salao_publico(text)   to anon, authenticated;
grant execute on function public.slug_disponivel(text) to anon, authenticated;
