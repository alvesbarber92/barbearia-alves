-- Aplicada no banco em 18/09/2026 (UTC), registrada lá como
-- "salao_atual_enxerga_barbearia_bloqueada".
--
-- Corrige `salao_atual`, criada minutos antes na migration anterior. Ela
-- resolvia a barbearia por `get_salon_id()`, que filtra `ativo` — de propósito,
-- porque barbearia desativada não deve responder dado nenhum pelas policies.
--
-- Só que o contexto do frontend usa esta função para saber QUAL é a barbearia
-- da sessão, inclusive para decidir se mostra a tela de bloqueio. Com o filtro,
-- o dono de uma barbearia desativada recebia `salon = null` e via um painel
-- vazio no lugar do aviso — a alavanca comercial da plataforma virava um bug
-- silencioso.
--
-- Aqui a barbearia é resolvida sem o filtro de `ativo`: a tela precisa saber
-- que ela existe e está desativada. Isso não afrouxa nada — quem barra leitura
-- de dado continua sendo `get_salon_id()`, que não mudou.

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
