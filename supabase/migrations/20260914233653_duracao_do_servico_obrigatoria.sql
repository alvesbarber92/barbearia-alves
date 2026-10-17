alter table public.servicos
  alter column duracao set not null,
  add constraint servicos_duracao_positiva check (duracao > 0);
