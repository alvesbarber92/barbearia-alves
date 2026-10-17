alter table public.servicos
  add constraint servicos_preco_ate_100k
  check (preco is null or (preco >= 0 and preco <= 99999.99)) not valid;

alter table public.estoque
  add constraint estoque_precos_ate_100k
  check (
    (preco_custo is null or (preco_custo >= 0 and preco_custo <= 99999.99)) and
    (preco_venda is null or (preco_venda >= 0 and preco_venda <= 99999.99))
  ) not valid;

alter table public.agendamentos
  add constraint agendamentos_valor_ate_100k
  check (valor is null or (valor >= 0 and valor <= 99999.99)) not valid;
