create or replace function public.salao_publico(p_slug text)
returns table (id uuid, slug text, nome text, cor_primaria text, logo_url text)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select s.id, s.slug, s.nome, s.cor_primaria, s.logo_url
  from salons s
  where s.slug = p_slug
    and s.ativo
$$;

create or replace function public.slug_disponivel(p_slug text)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select not exists (select 1 from salons s where s.slug = p_slug)
$$;

grant execute on function public.salao_publico(text)   to anon, authenticated;
grant execute on function public.slug_disponivel(text) to anon, authenticated;

drop view public.salons_public;
