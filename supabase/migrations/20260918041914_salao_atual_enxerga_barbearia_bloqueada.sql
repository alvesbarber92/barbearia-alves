create or replace function public.salao_atual()
returns jsonb
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select jsonb_build_object(
    'salon', (
      select to_jsonb(s) from salons s
       where s.id = coalesce(
         (select o.salon_id
            from admin_observando o
           where o.admin_id = (select auth.uid())
             and public.eh_admin()),
         (select s2.id from salons s2
           where s2.dono_id = (select auth.uid())
           limit 1)
       )
    ),
    'observando', exists (
      select 1 from admin_observando o
       where o.admin_id = (select auth.uid()) and public.eh_admin()
    )
  );
$fn$;
