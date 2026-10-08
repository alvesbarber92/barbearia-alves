-- O Postgres concede EXECUTE a PUBLIC por padrão em toda função criada, então
-- o grant explícito a `authenticated` não excluía o `anon`. A guarda de
-- auth.uid() já barrava, mas função de sessão não deve ser alcançável sem sessão.
revoke execute on function public.criar_agendamento_cliente(uuid, uuid, timestamptz, text, text, text) from public, anon;
revoke execute on function public.meus_agendamentos(uuid)        from public, anon;
revoke execute on function public.cancelar_meu_agendamento(uuid) from public, anon;

-- Estas duas são públicas de propósito: a vitrine e o cadastro precisam delas
-- sem login, no mesmo padrão de horarios_ocupados e modulo_liberado.
grant execute on function public.salao_publico(text)   to anon, authenticated;
grant execute on function public.slug_disponivel(text) to anon, authenticated;
