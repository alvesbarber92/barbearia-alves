create or replace function public.get_salon_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select id from public.salons
   where dono_id = (select auth.uid())
     and ativo
   limit 1;
$$;
