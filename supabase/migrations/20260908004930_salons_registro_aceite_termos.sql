-- Registro do aceite dos Termos de Uso pela proprietária.
-- Nulo nos salões já existentes: eles se cadastraram antes de existir aceite,
-- e inventar uma data seria falsear a prova. Ficam nulos de propósito.
alter table public.salons
  add column if not exists termos_aceitos_em timestamptz,
  add column if not exists termos_versao     text;

comment on column public.salons.termos_aceitos_em is
  'Momento em que a proprietária aceitou os Termos de Uso no cadastro. Nulo = cadastro anterior à exigência do aceite.';
comment on column public.salons.termos_versao is
  'Versão do texto legal aceita (TERMOS_VERSAO em frontend/src/legal.js). Sem ela, sabe-se que houve aceite mas não de qual texto.';
