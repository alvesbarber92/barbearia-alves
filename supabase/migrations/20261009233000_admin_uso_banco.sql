-- Uso do projeto para o painel da plataforma: tamanho do banco, arquivos no
-- storage, contas e as maiores tabelas. E o que o Supabase mede para cobrar;
-- o valor da fatura em si nao fica no banco, so na conta do Supabase.
--
-- Usuarios ativos e aproximado: o Supabase conta MAU por quem usou a sessao no
-- mes, aqui conta quem fez login nos ultimos 30 dias.

create or replace function public.admin_uso_banco()
  returns jsonb
  language plpgsql
  stable security definer
  set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'banco_bytes',          pg_database_size(current_database()),
    'arquivos_bytes',       (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
    'arquivos_qtd',         (select count(*) from storage.objects),
    'usuarios_total',       (select count(*) from auth.users),
    'usuarios_ativos_30d',  (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '30 days'),
    'tabelas', coalesce((
      select jsonb_agg(t order by t.bytes desc)
      from (
        select s.relname::text                    as nome,
               pg_total_relation_size(s.relid)    as bytes,
               s.n_live_tup                       as linhas
        from pg_stat_user_tables s
        where s.schemaname = 'public'
        order by pg_total_relation_size(s.relid) desc
        limit 8
      ) t
    ), '[]'::jsonb)
  );
end
$function$;

revoke execute on function public.admin_uso_banco() from public, anon;
grant  execute on function public.admin_uso_banco() to authenticated;
