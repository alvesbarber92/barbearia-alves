-- Desativar um salão no /admin passa a valer no banco, não só na interface.
--
-- Antes desta migration o bloqueio era só de tela: SalaoAtivoRoute trocava o
-- painel pelo aviso, mas as tabelas do salão continuavam respondendo pela API a
-- quem chamasse `/rest/v1/` direto. `get_salon_id()` é a base de isolamento de
-- agendamentos, clientes, servicos, horarios, estoque e vendas — devolvendo nulo
-- para salão inativo, as seis negam de uma vez, sem tocar em policy nenhuma.
--
-- `salons_owner` NÃO usa esta função (filtra por dono_id), então a dona continua
-- lendo a própria linha de `salons`. Isso é proposital e necessário: é assim que
-- o front descobre `ativo = false` e sabe mostrar o aviso de bloqueio. Sem isso
-- ela cairia no onboarding, como se não tivesse salão.

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
