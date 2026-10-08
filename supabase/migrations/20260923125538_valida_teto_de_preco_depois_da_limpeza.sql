-- Aplicada no banco em 23/09/2026 (UTC), registrada lá como
-- "valida_teto_de_preco_depois_da_limpeza".
--
-- As três constraints de teto entraram NOT VALID na migration anterior porque
-- 7 linhas de teste violavam o limite: dois serviços ("Raspagem de pinto" a
-- 10^37 e "Goleada suprema" a 3,48×10^19) e os cinco agendamentos deles.
--
-- Os valores foram ajustados para R$ 30 — o mesmo dos outros serviços da
-- barbearia — a pedido do Ricardo, que preferiu corrigir a apagar. Serviço e
-- agendamento foram ajustados juntos, para o dado seguir coerente: no sistema
-- o valor do agendamento nasce congelado do preço do serviço, então deixar um
-- sem o outro criaria uma incoerência nova no lugar da antiga.
--
-- O UPDATE em si não está aqui porque é dado, não schema:
--
--   update public.servicos     set preco = 30 where preco > 99999.99;
--   update public.agendamentos set valor = 30 where valor > 99999.99;
--
-- Com a base limpa, as constraints passam a valer também para o passado. Daqui
-- em diante não existe mais linha acima do teto, nem velha nem nova.

alter table public.servicos     validate constraint servicos_preco_ate_100k;
alter table public.estoque      validate constraint estoque_precos_ate_100k;
alter table public.agendamentos validate constraint agendamentos_valor_ate_100k;
