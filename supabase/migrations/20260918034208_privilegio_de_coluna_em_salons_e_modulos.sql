-- Aplicada no banco em 18/09/2026 (UTC), registrada lá como
-- "privilegio_de_coluna_em_salons_e_modulos".
--
-- RLS filtra linha, não coluna. As policies `salons_owner_alteracao` e
-- `salon_modulos_ativacao_dono` dizem QUAIS linhas o dono altera, mas não
-- QUAIS colunas — e `authenticated` tinha UPDATE em todas elas. Duas
-- consequências, testadas no banco assumindo a identidade de um dono, cada
-- uma afetando 1 linha:
--
--   update salons        set ativo = true       -> barbearia desativada pelo
--                                                  /admin voltava ao ar sozinha
--   update salon_modulos set disponivel = true  -> dono liberava módulo pago
--                                                  sem passar por admin_definir_modulo
--
-- Nenhum dos dois exigia nada sofisticado: a chave anon está no navegador e a
-- API REST do Supabase aceita a chamada de quem souber o próprio salon_id. O
-- bloqueio por falta de pagamento era a única alavanca comercial da
-- plataforma, e não segurava.
--
-- Privilégio de coluna é o que RLS não faz. O dono segue editando o que é dele
-- e perde o que nunca foi: `ativo`, `plano` e `disponivel`.

revoke update on public.salons from anon, authenticated;
grant  update (nome, slug, whatsapp, cor_primaria, logo_url)
  on public.salons to authenticated;

-- `horario_resumo` ficou de fora de propósito: nenhuma tela escreve nele hoje.
-- Se alguma passar a escrever, some a coluna ao grant acima.

revoke update on public.salon_modulos from anon, authenticated;
grant  update (ativo) on public.salon_modulos to authenticated;

-- `disponivel` fica só para admin_definir_modulo, que é SECURITY DEFINER e
-- confere eh_admin() antes de gravar.
