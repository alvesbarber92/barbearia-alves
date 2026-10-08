-- Aplicada no banco em 23/09/2026 (UTC), registrada lá como
-- "teto_de_preco_em_servicos_estoque_e_agendamentos".
--
-- Nada impedia um preço de 10^37. Um serviço foi cadastrado assim em teste, e o
-- número vazou por toda a interface: cartão do Financeiro com quatro linhas de
-- dígitos, linha da agenda estourando a largura, card da tela pública de
-- agendamento saindo para fora da borda.
--
-- Formatar melhor ajuda, mas não resolve sozinho — o `Intl` em pt-BR para em
-- "tri", então 10^37 ainda sai com 28 caracteres. O conserto de verdade é o
-- valor não poder existir.
--
-- Teto de R$ 99.999,99 por unidade: preço de serviço, preço de produto e valor
-- de um agendamento. É folgado de propósito — o serviço mais caro de uma
-- barbearia não passa de alguns milhares. Se um dia apertar, é só subir o
-- número nos três lugares (e em TETO_PRECO, no `frontend/src/lib/agenda.js`).
--
-- NOT VALID de propósito: as 7 linhas de teste que já existem violam o teto, e
-- apagar dado não é decisão a tomar sozinho. A constraint vale para tudo que
-- entrar ou for alterado daqui pra frente; as linhas velhas ficam onde estão
-- até alguém limpar. Depois da limpeza, para fechar de vez:
--
--   alter table public.servicos     validate constraint servicos_preco_ate_100k;
--   alter table public.agendamentos validate constraint agendamentos_valor_ate_100k;
--   alter table public.estoque      validate constraint estoque_precos_ate_100k;

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
