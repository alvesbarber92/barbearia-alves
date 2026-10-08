-- Aplicada no banco em 14/09/2026 (UTC) pelo conector, registrada lá como
-- "duracao_do_servico_obrigatoria".
--
-- Serviço sem duração era contado de dois jeitos: as telas usavam 60 min
-- (s.duracao || 60 na AgendarPage, na agenda do dono e na vitrine) e o banco
-- usava 30 (coalesce(duracao, 30) no expediente, no conflito e, desde a
-- migration anterior, na duração gravada no agendamento). O cliente veria
-- "1h" e o horário ficaria reservado por 30.
--
-- Em 14/09/2026 nenhum serviço estava sem duração, e as telas sempre gravam
-- um valor (Configurações e o cadastro inicial usam 60 quando o campo vem
-- vazio). A trava fecha o caso na origem. O default 30 da coluna continua.

alter table public.servicos
  alter column duracao set not null,
  add constraint servicos_duracao_positiva check (duracao > 0);
