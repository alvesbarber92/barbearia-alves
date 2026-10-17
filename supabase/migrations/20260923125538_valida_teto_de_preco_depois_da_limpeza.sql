alter table public.servicos     validate constraint servicos_preco_ate_100k;
alter table public.estoque      validate constraint estoque_precos_ate_100k;
alter table public.agendamentos validate constraint agendamentos_valor_ate_100k;
