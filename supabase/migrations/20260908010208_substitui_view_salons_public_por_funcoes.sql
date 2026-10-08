-- A view salons_public era SECURITY DEFINER: aplicava as permissões de quem a
-- criou, contornando a RLS de salons de forma invisível — o único ERROR do
-- linter. Trocar para security_invoker não resolve aqui: a dona e a cliente são
-- as duas o papel `authenticated`, e uma policy de leitura pública em salons
-- entregaria a qualquer usuário logado colunas como dono_email e plano, porque
-- privilégio de coluna não distingue os dois públicos.
--
-- Duas funções explícitas fazem o mesmo trabalho com a projeção declarada no
-- corpo, no mesmo padrão já usado por horarios_ocupados e modulo_liberado.
--
-- Corrige também um defeito que a view tinha: sem filtro por `ativo`, um salão
-- desativado continuava aparecendo publicamente.

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

-- Verificação de slug no cadastro e no onboarding. Considera TODOS os salões,
-- inclusive os desativados: o slug de um salão desativado não pode ser tomado
-- por outro, senão as URLs antigas passariam a apontar para outro lugar.
create or replace function public.slug_disponivel(p_slug text)
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select not exists (select 1 from salons s where s.slug = p_slug)
$$;

grant execute on function public.salao_publico(text)   to anon, authenticated;
grant execute on function public.slug_disponivel(text) to anon, authenticated;

-- Sem cascade de propósito: se algo mais dependesse da view, o drop falha e
-- avisa, em vez de derrubar a dependência em silêncio.
drop view public.salons_public;
