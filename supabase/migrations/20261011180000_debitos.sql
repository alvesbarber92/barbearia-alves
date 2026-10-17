create table public.debitos (
  id uuid default gen_random_uuid() not null primary key,
  salon_id uuid not null references public.salons(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  nome text not null,
  telefone text,
  descricao text,
  valor numeric not null,
  data date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  pago_em timestamp with time zone,
  criado_em timestamp with time zone default now() not null,
  constraint debitos_nome_preenchido check (length(btrim(nome)) > 0),
  constraint debitos_valor_ate_100k check (valor > 0 and valor <= 99999.99)
);

create index debitos_salon_idx on public.debitos (salon_id, pago_em);

alter table public.debitos enable row level security;

create policy debitos_leitura on public.debitos as permissive for select to authenticated
  using ((salon_id = get_salon_id()));

create policy debitos_insercao on public.debitos as permissive for insert to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy debitos_alteracao on public.debitos as permissive for update to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy debitos_exclusao on public.debitos as permissive for delete to authenticated
  using ((salon_id = get_salon_id_proprio()));
