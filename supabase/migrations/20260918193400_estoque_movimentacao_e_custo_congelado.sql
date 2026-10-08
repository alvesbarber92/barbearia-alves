-- Aplicada no banco em 18/09/2026 (UTC), registrada lá como
-- "estoque_movimentacao_e_custo_congelado".
--
-- O Estoque sai do "em construção". Três coisas:
--
-- 1. Categorias. A lista aceitava só cosmético ('pomada','gel','shampoo',
--    'barba','lamina'). Barbearia também revende camiseta, boné, bebida —
--    tudo isso caía em 'outro' e o filtro por categoria perdia o sentido.
--
-- 2. Custo congelado na venda. `vendas` guardava só `valor_total`. Calcular
--    lucro como (preco_venda − preco_custo) do produto HOJE reescreve o
--    passado: repor estoque mais caro mudaria o lucro de vendas antigas. É a
--    mesma armadilha da duração do serviço, que já custou caro neste projeto.
--    O custo do momento passa a ficar gravado na linha da venda.
--
-- 3. Entrada e saída como função, para o par "mexe na quantidade" + "registra
--    a venda" acontecer junto ou não acontecer.
--
-- As funções são SECURITY INVOKER de propósito — é o padrão, dito em voz alta.
-- Rodando como quem chamou, as policies valem: o dono grava, e o admin da
-- plataforma em modo de observação esbarra na policy de escrita, como em
-- qualquer outra tela. SECURITY DEFINER aqui abriria um buraco no somente
-- leitura que a observação promete.

alter table public.estoque drop constraint if exists estoque_categoria_check;
alter table public.estoque add constraint estoque_categoria_check
  check (categoria is null or categoria = any (array[
    'pomada', 'gel', 'shampoo', 'barba', 'lamina',
    'bebida', 'vestuario', 'acessorio', 'outro'
  ]));

alter table public.vendas add column if not exists custo_total numeric;

comment on column public.vendas.custo_total is
  'Custo do produto no momento da venda, multiplicado pela quantidade. Gravado aqui para o lucro do passado nao mudar quando o preco de custo do produto mudar.';

create or replace function public.estoque_entrada(
  p_produto_id  uuid,
  p_quantidade  integer,
  p_preco_custo numeric default null
)
returns public.estoque
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
declare v_item public.estoque%rowtype;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade_invalida' using errcode = 'P0001';
  end if;

  -- Compra mais cara ou mais barata atualiza o custo do produto dali em
  -- diante. As vendas já feitas não se mexem: o custo delas está congelado.
  update estoque
     set quantidade  = coalesce(quantidade, 0) + p_quantidade,
         preco_custo = coalesce(p_preco_custo, preco_custo)
   where id = p_produto_id
  returning * into v_item;

  if not found then
    raise exception 'produto_nao_encontrado' using errcode = 'P0001';
  end if;

  return v_item;
end
$fn$;

create or replace function public.estoque_saida(
  p_produto_id uuid,
  p_quantidade integer,
  p_forma_pag  text default null,
  p_cliente_id uuid default null
)
returns public.vendas
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_item  public.estoque%rowtype;
  v_venda public.vendas%rowtype;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade_invalida' using errcode = 'P0001';
  end if;

  -- `for update` segura a linha até o fim da transação: duas baixas do mesmo
  -- produto ao mesmo tempo não podem ler o mesmo saldo e vender duas vezes.
  select * into v_item from estoque where id = p_produto_id for update;

  if not found then
    raise exception 'produto_nao_encontrado' using errcode = 'P0001';
  end if;

  if coalesce(v_item.quantidade, 0) < p_quantidade then
    raise exception 'estoque_insuficiente' using errcode = 'P0001';
  end if;

  update estoque
     set quantidade = quantidade - p_quantidade
   where id = p_produto_id;

  if not found then
    raise exception 'sem_permissao' using errcode = 'P0001';
  end if;

  insert into vendas (salon_id, produto_id, cliente_id, quantidade,
                      valor_total, custo_total, forma_pag)
  values (v_item.salon_id, p_produto_id, p_cliente_id, p_quantidade,
          coalesce(v_item.preco_venda, 0) * p_quantidade,
          coalesce(v_item.preco_custo, 0) * p_quantidade,
          nullif(btrim(coalesce(p_forma_pag, '')), ''))
  returning * into v_venda;

  return v_venda;
end
$fn$;

revoke execute on function public.estoque_entrada(uuid, integer, numeric)   from public, anon;
revoke execute on function public.estoque_saida(uuid, integer, text, uuid)  from public, anon;
grant  execute on function public.estoque_entrada(uuid, integer, numeric)   to authenticated;
grant  execute on function public.estoque_saida(uuid, integer, text, uuid)  to authenticated;
