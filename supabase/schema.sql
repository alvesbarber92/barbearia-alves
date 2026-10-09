-- ============================================================================
--  BarberVez - retrato do schema
--  Projeto Supabase - gerado em 18 de setembro de 2026,
--  atualizado em 25 de setembro de 2026 (horario fixo e pausa/almoco)
-- ============================================================================
--
-- Este arquivo e a FONTE DE VERDADE do schema, e nao um historico.
--
-- Por que um retrato e nao a soma das migrations: parte da base foi construida
-- pelo painel do Supabase. `salon_modulos`, `plataforma_admins`,
-- `auditoria_admin`, `eh_admin` e as funcoes `admin_*` nao aparecem em migration
-- nenhuma. A remocao de `salons.dono_email` - o e-mail do dono passou a vir de
-- `auth.users` por `dono_id` - tambem foi feita a mao, e so foi percebida em
-- 18/09/2026, quando uma migration antiga foi reaplicada e voltou a inserir
-- numa coluna que nao existe mais. Replayar `migrations/` num banco vazio NAO
-- reproduz este schema; aplicar este arquivo reproduz.
--
-- Gerado por introspeccao (pg_catalog + information_schema), nao por pg_dump.
-- Nao inclui: extensoes, o schema `auth` do Supabase, nem dados.
--
-- Para regerar depois de uma alteracao, ver README.md nesta pasta.

-- ===== TABELAS =====

create table public.admin_observando (
  admin_id uuid not null,
  salon_id uuid not null,
  iniciado_em timestamp with time zone default now() not null
);

create table public.agendamentos (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  cliente_id uuid,
  servico_id uuid,
  servico text not null,
  data_hora timestamp with time zone not null,
  status text default 'confirmado'::text not null,
  valor numeric,
  forma_pag text,
  observacoes text,
  criado_em timestamp with time zone default now(),
  duracao integer not null,
  fixo_id uuid
);

create table public.auditoria_admin (
  id uuid default gen_random_uuid() not null,
  admin_id uuid not null,
  salon_id uuid,
  acao text not null,
  detalhe jsonb,
  criado_em timestamp with time zone default now() not null
);

create table public.clientes (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  auth_user_id uuid,
  nome text not null,
  telefone text,
  email text,
  observacoes text,
  criado_em timestamp with time zone default now()
);

create table public.convites (
  codigo text not null,
  nota text,
  salon_id uuid,
  criado_por uuid,
  criado_em timestamp with time zone default now() not null,
  expira_em timestamp with time zone not null,
  usado_em timestamp with time zone,
  usado_por uuid
);

create table public.dias_especiais (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  data date not null,
  fechado boolean default true not null,
  abertura time without time zone,
  fechamento time without time zone,
  criado_em timestamp with time zone default now() not null
);

create table public.estoque (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  nome text not null,
  categoria text,
  quantidade integer default 0,
  quantidade_minima integer default 5,
  preco_custo numeric,
  preco_venda numeric,
  criado_em timestamp with time zone default now()
);

create table public.horarios (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  dia_semana integer not null,
  abertura time without time zone default '09:00:00'::time without time zone not null,
  fechamento time without time zone default '18:00:00'::time without time zone not null,
  ativo boolean default true not null,
  criado_em timestamp with time zone default now(),
  pausa_inicio time without time zone,
  pausa_minutos integer
);

create table public.horarios_fixos (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  cliente_id uuid not null,
  servico_id uuid,
  data_inicio date not null,
  hora time without time zone not null,
  intervalo_semanas integer not null,
  observacoes text,
  ativo boolean default true not null,
  gerado_ate date,
  criado_em timestamp with time zone default now() not null,
  encerrado_em timestamp with time zone
);

create table public.pausas_dia (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  data date not null,
  inicio time without time zone,
  minutos integer,
  criado_em timestamp with time zone default now() not null
);

create table public.plataforma_admins (
  user_id uuid not null,
  nome text not null,
  ativo boolean default true not null,
  criado_em timestamp with time zone default now() not null
);

create table public.salon_modulos (
  salon_id uuid not null,
  modulo text not null,
  disponivel boolean default false not null,
  ativo boolean default true not null,
  atualizado_em timestamp with time zone default now() not null
);

create table public.salons (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  nome text not null,
  dono_id uuid not null,
  cor_primaria text default '#1F2937'::text,
  logo_url text,
  plano text default 'basico'::text,
  whatsapp text,
  horario_resumo time without time zone default '08:00:00'::time without time zone,
  ativo boolean default true not null,
  termos_aceitos_em timestamp with time zone,
  termos_versao text,
  criado_em timestamp with time zone default now()
);

create table public.servicos (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  nome text not null,
  duracao integer default 30 not null,
  preco numeric,
  ativo boolean default true,
  criado_em timestamp with time zone default now()
);

create table public.vendas (
  id uuid default gen_random_uuid() not null,
  salon_id uuid not null,
  produto_id uuid,
  cliente_id uuid,
  quantidade integer not null,
  valor_total numeric,
  forma_pag text,
  data_venda timestamp with time zone default now(),
  custo_total numeric
);

-- ===== CONSTRAINTS =====

alter table public.admin_observando add constraint admin_observando_pkey PRIMARY KEY (admin_id);
alter table public.admin_observando add constraint admin_observando_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.admin_observando add constraint admin_observando_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.agendamentos add constraint agendamentos_pkey PRIMARY KEY (id);
alter table public.agendamentos add constraint agendamentos_duracao_positiva CHECK ((duracao > 0));
alter table public.agendamentos add constraint agendamentos_forma_pag_check CHECK (((forma_pag = ANY (ARRAY['dinheiro'::text, 'pix'::text, 'cartao'::text])) OR (forma_pag IS NULL)));
alter table public.agendamentos add constraint agendamentos_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'confirmado'::text, 'concluido'::text, 'cancelado'::text, 'faltou'::text])));
alter table public.agendamentos add constraint agendamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.agendamentos add constraint agendamentos_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.agendamentos add constraint agendamentos_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE SET NULL;
alter table public.auditoria_admin add constraint auditoria_admin_pkey PRIMARY KEY (id);
alter table public.auditoria_admin add constraint auditoria_admin_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id);
alter table public.auditoria_admin add constraint auditoria_admin_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE SET NULL;
alter table public.clientes add constraint clientes_pkey PRIMARY KEY (id);
alter table public.clientes add constraint clientes_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.clientes add constraint clientes_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.convites add constraint convites_pkey PRIMARY KEY (codigo);
alter table public.convites add constraint convites_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.convites add constraint convites_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE SET NULL;
alter table public.convites add constraint convites_usado_por_fkey FOREIGN KEY (usado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.dias_especiais add constraint dias_especiais_pkey PRIMARY KEY (id);
alter table public.dias_especiais add constraint dias_especiais_salon_id_data_key UNIQUE (salon_id, data);
alter table public.dias_especiais add constraint dias_especiais_horario_check CHECK (((fechado AND (abertura IS NULL) AND (fechamento IS NULL)) OR ((NOT fechado) AND (abertura IS NOT NULL) AND (fechamento IS NOT NULL) AND (fechamento > abertura))));
alter table public.dias_especiais add constraint dias_especiais_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.estoque add constraint estoque_pkey PRIMARY KEY (id);
alter table public.estoque add constraint estoque_categoria_check CHECK (((categoria IS NULL) OR (categoria = ANY (ARRAY['pomada'::text, 'gel'::text, 'shampoo'::text, 'barba'::text, 'lamina'::text, 'bebida'::text, 'vestuario'::text, 'acessorio'::text, 'outro'::text]))));
alter table public.estoque add constraint estoque_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.horarios add constraint horarios_pkey PRIMARY KEY (id);
alter table public.horarios add constraint horarios_salon_id_dia_semana_key UNIQUE (salon_id, dia_semana);
alter table public.horarios add constraint horarios_check CHECK ((fechamento > abertura));
alter table public.horarios add constraint horarios_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)));
alter table public.horarios add constraint horarios_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.horarios add constraint horarios_pausa_check CHECK ((((pausa_inicio IS NULL) AND (pausa_minutos IS NULL)) OR ((pausa_inicio IS NOT NULL) AND (pausa_minutos IS NOT NULL) AND ((pausa_minutos >= 5) AND (pausa_minutos <= 480)))));
alter table public.horarios_fixos add constraint horarios_fixos_pkey PRIMARY KEY (id);
alter table public.horarios_fixos add constraint horarios_fixos_intervalo_check CHECK ((intervalo_semanas = ANY (ARRAY[1, 2, 4])));
alter table public.horarios_fixos add constraint horarios_fixos_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.horarios_fixos add constraint horarios_fixos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
alter table public.horarios_fixos add constraint horarios_fixos_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE SET NULL;
alter table public.agendamentos add constraint agendamentos_fixo_id_fkey FOREIGN KEY (fixo_id) REFERENCES horarios_fixos(id) ON DELETE SET NULL;
alter table public.pausas_dia add constraint pausas_dia_pkey PRIMARY KEY (id);
alter table public.pausas_dia add constraint pausas_dia_salon_id_data_key UNIQUE (salon_id, data);
alter table public.pausas_dia add constraint pausas_dia_check CHECK ((((inicio IS NULL) AND (minutos IS NULL)) OR ((inicio IS NOT NULL) AND (minutos IS NOT NULL) AND ((minutos >= 5) AND (minutos <= 480)))));
alter table public.pausas_dia add constraint pausas_dia_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.plataforma_admins add constraint plataforma_admins_pkey PRIMARY KEY (user_id);
alter table public.plataforma_admins add constraint plataforma_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.salon_modulos add constraint salon_modulos_pkey PRIMARY KEY (salon_id, modulo);
alter table public.salon_modulos add constraint salon_modulos_modulo_check CHECK ((modulo = ANY (ARRAY['agendamento_online'::text, 'estoque'::text, 'financeiro'::text])));
alter table public.salon_modulos add constraint salon_modulos_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.salons add constraint salons_pkey PRIMARY KEY (id);
alter table public.salons add constraint salons_slug_key UNIQUE (slug);
alter table public.salons add constraint salons_dono_id_fkey FOREIGN KEY (dono_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.servicos add constraint servicos_pkey PRIMARY KEY (id);
alter table public.servicos add constraint servicos_duracao_positiva CHECK ((duracao > 0));
alter table public.servicos add constraint servicos_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;
alter table public.vendas add constraint vendas_pkey PRIMARY KEY (id);
alter table public.vendas add constraint vendas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.vendas add constraint vendas_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES estoque(id) ON DELETE SET NULL;
alter table public.vendas add constraint vendas_salon_id_fkey FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE;

-- Teto por unidade. Entraram NOT VALID em 23/09/2026, porque linhas de teste
-- violavam o limite; depois que os valores foram ajustados, foram validadas.
-- Hoje valem para tudo, passado e futuro, aqui e no banco.
alter table public.agendamentos add constraint agendamentos_valor_ate_100k CHECK (((valor IS NULL) OR ((valor >= (0)::numeric) AND (valor <= 99999.99))));
alter table public.estoque add constraint estoque_precos_ate_100k CHECK ((((preco_custo IS NULL) OR ((preco_custo >= (0)::numeric) AND (preco_custo <= 99999.99))) AND ((preco_venda IS NULL) OR ((preco_venda >= (0)::numeric) AND (preco_venda <= 99999.99)))));
alter table public.servicos add constraint servicos_preco_ate_100k CHECK (((preco IS NULL) OR ((preco >= (0)::numeric) AND (preco <= 99999.99))));

-- ===== INDICES =====
--
-- Os seis pares duplicados que existiam no retrato de 8/9/2026 sairam do banco:
-- hoje ha um indice por coluna.

CREATE INDEX idx_admin_observando_salon ON public.admin_observando USING btree (salon_id);
CREATE INDEX idx_agendamentos_cliente ON public.agendamentos USING btree (cliente_id);
CREATE INDEX idx_agendamentos_salon_data ON public.agendamentos USING btree (salon_id, data_hora);
CREATE INDEX idx_agendamentos_salon_id ON public.agendamentos USING btree (salon_id);
CREATE INDEX idx_agendamentos_fixo ON public.agendamentos USING btree (fixo_id) WHERE (fixo_id IS NOT NULL);
CREATE INDEX auditoria_admin_salao_idx ON public.auditoria_admin USING btree (salon_id, criado_em DESC);
CREATE INDEX idx_clientes_auth_user_id ON public.clientes USING btree (auth_user_id);
CREATE INDEX idx_clientes_salon_id ON public.clientes USING btree (salon_id);
CREATE INDEX idx_estoque_salon_id ON public.estoque USING btree (salon_id);
CREATE INDEX idx_horarios_salon_id ON public.horarios USING btree (salon_id);
CREATE INDEX idx_horarios_fixos_salon ON public.horarios_fixos USING btree (salon_id) WHERE ativo;
CREATE INDEX idx_salons_dono_id ON public.salons USING btree (dono_id);
CREATE INDEX idx_servicos_salon_id ON public.servicos USING btree (salon_id);
CREATE INDEX idx_vendas_salon_data ON public.vendas USING btree (salon_id, data_venda);
CREATE INDEX idx_vendas_salon_id ON public.vendas USING btree (salon_id);

-- ===== FUNCOES =====

CREATE OR REPLACE FUNCTION public.admin_auditoria_salao(p_salon_id uuid, p_limite integer DEFAULT 20)
 RETURNS TABLE(acao text, detalhe jsonb, criado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.acao, a.detalhe, a.criado_em
  from public.auditoria_admin a
  where public.eh_admin() and a.salon_id = p_salon_id
  order by a.criado_em desc
  limit least(coalesce(p_limite, 20), 100);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_definir_modulo(p_salon_id uuid, p_modulo text, p_disponivel boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado';
  end if;

  insert into public.salon_modulos (salon_id, modulo, disponivel)
  values (p_salon_id, p_modulo, p_disponivel)
  on conflict (salon_id, modulo) do update
    set disponivel = excluded.disponivel, atualizado_em = now();

  insert into public.auditoria_admin (admin_id, salon_id, acao, detalhe)
  values (auth.uid(), p_salon_id,
          case when p_disponivel then 'modulo_habilitado' else 'modulo_desabilitado' end,
          jsonb_build_object('modulo', p_modulo, 'disponivel', p_disponivel));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_definir_situacao_salao(p_salon_id uuid, p_ativo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado';
  end if;

  update public.salons set ativo = p_ativo where id = p_salon_id;

  insert into public.auditoria_admin (admin_id, salon_id, acao, detalhe)
  values (auth.uid(), p_salon_id,
          case when p_ativo then 'salao_ativado' else 'salao_desativado' end,
          jsonb_build_object('ativo', p_ativo));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_gerar_convite(p_nota text DEFAULT NULL::text, p_minutos integer DEFAULT 5)
 RETURNS convites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_alfabeto  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo    text;
  v_i         int;
  v_tentativa int := 0;
  v_minutos   int := greatest(1, least(coalesce(p_minutos, 5), 1440));
  v_row       public.convites%rowtype;
begin
  if not eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  loop
    v_codigo := '';
    for v_i in 1..8 loop
      v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;
    v_codigo := substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4);

    exit when not exists (select 1 from convites c where c.codigo = v_codigo);

    v_tentativa := v_tentativa + 1;
    if v_tentativa > 20 then
      raise exception 'nao_foi_possivel_gerar_codigo' using errcode = 'P0001';
    end if;
  end loop;

  insert into convites (codigo, nota, expira_em, criado_por)
  values (v_codigo,
          nullif(btrim(coalesce(p_nota, '')), ''),
          now() + make_interval(mins => v_minutos),
          auth.uid())
  returning * into v_row;

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_listar_convites(p_limite integer DEFAULT 30)
 RETURNS TABLE(codigo text, nota text, criado_em timestamp with time zone, expira_em timestamp with time zone, usado_em timestamp with time zone, usado_por_email text, salao_nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select c.codigo, c.nota, c.criado_em, c.expira_em, c.usado_em,
         u.email::text, s.nome
  from convites c
  left join auth.users u on u.id = c.usado_por
  left join salons    s on s.id = c.salon_id
  where eh_admin()
  order by c.criado_em desc
  limit greatest(1, least(coalesce(p_limite, 30), 200));
$function$
;

CREATE OR REPLACE FUNCTION public.admin_listar_saloes()
 RETURNS TABLE(id uuid, nome text, slug text, dono_email text, plano text, ativo boolean, criado_em timestamp with time zone, modulos jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    s.id, s.nome, s.slug, u.email::text, s.plano, s.ativo, s.criado_em,
    coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'modulo',        sm.modulo,
                  'disponivel',    sm.disponivel,
                  'ativo',         sm.ativo,
                  'atualizado_em', sm.atualizado_em
                ) order by sm.modulo)
       from public.salon_modulos sm
       where sm.salon_id = s.id),
      '[]'::jsonb
    ) as modulos
  from public.salons s
  left join auth.users u on u.id = s.dono_id
  where public.eh_admin()
  order by s.nome;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_uso_banco()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'banco_bytes',          pg_database_size(current_database()),
    'arquivos_bytes',       (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
    'arquivos_qtd',         (select count(*) from storage.objects),
    'usuarios_total',       (select count(*) from auth.users),
    'usuarios_ativos_30d',  (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '30 days'),
    'tabelas', coalesce((
      select jsonb_agg(t order by t.bytes desc)
      from (
        select s.relname::text                    as nome,
               pg_total_relation_size(s.relid)    as bytes,
               s.n_live_tup                       as linhas
        from pg_stat_user_tables s
        where s.schemaname = 'public'
        order by pg_total_relation_size(s.relid) desc
        limit 8
      ) t
    ), '[]'::jsonb)
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.cancelar_meu_agendamento(p_agendamento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_afetadas int;
begin
  update agendamentos a
     set status = 'cancelado'
   where a.id = p_agendamento_id
     and a.status in ('pendente','confirmado')
     and a.data_hora > now()
     and a.cliente_id in (select c.id from clientes c where c.auth_user_id = auth.uid());

  get diagnostics v_afetadas = row_count;
  if v_afetadas = 0 then
    raise exception 'Agendamento não encontrado ou não pode mais ser cancelado'
      using errcode = 'P0001';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.convite_valido(p_codigo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from convites c
    where c.codigo = upper(btrim(coalesce(p_codigo, '')))
      and c.usado_por is null
      and c.expira_em > now()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.criar_agendamento_cliente(p_salon_id uuid, p_servico_id uuid, p_data_hora timestamp with time zone, p_nome text, p_telefone text, p_observacoes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid        uuid := auth.uid();
  v_email      text;
  v_cliente    uuid;
  v_nome_serv  text;
  v_preco      numeric;
  v_duracao    int;
  v_futuros    int;
  v_id         uuid;
  v_local      timestamp;
  v_dia        date;
  v_fechado    boolean;
  v_ativo      boolean;
  v_abertura   time;
  v_fechamento time;
  v_pausa      record;
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado para agendar' using errcode = 'P0001';
  end if;

  if p_data_hora is null or p_data_hora <= now() then
    raise exception 'A data do agendamento tem de ser futura' using errcode = 'P0001';
  end if;

  -- Serviço tem de pertencer a este salão e estar ativo. É o que impede
  -- preço forjado e agendamento de serviço de outra barbearia.
  select s.nome, s.preco, coalesce(s.duracao, 30) into v_nome_serv, v_preco, v_duracao
  from servicos s
  where s.id = p_servico_id and s.salon_id = p_salon_id and s.ativo;

  if v_nome_serv is null then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  if not exists (select 1 from salons where id = p_salon_id and ativo) then
    raise exception 'Barbearia indisponível' using errcode = 'P0001';
  end if;

  -- Horário fixo: cria as datas que entraram na janela de 3 meses ANTES de
  -- gravar este agendamento, para o cliente do link não pegar o horário de
  -- quem é fixo. Se a geração falhar, o agendamento segue: um defeito no fixo
  -- não pode impedir a barbearia de receber cliente.
  begin
    perform public.gerar_agendamentos_fixos(p_salon_id);
  exception when others then
    raise warning 'gerar_agendamentos_fixos falhou para %: %', p_salon_id, sqlerrm;
  end;

  -- Expediente do dia: data especial, linha da semana, padrão.
  v_local := p_data_hora at time zone 'America/Sao_Paulo';
  v_dia   := v_local::date;

  select de.fechado, de.abertura, de.fechamento into v_fechado, v_abertura, v_fechamento
  from dias_especiais de
  where de.salon_id = p_salon_id and de.data = v_dia;

  if not found then
    select h.ativo, h.abertura, h.fechamento into v_ativo, v_abertura, v_fechamento
    from horarios h
    where h.salon_id = p_salon_id and h.dia_semana = extract(dow from v_dia)::int;

    if not found then
      -- Dia sem linha: não deveria mais acontecer, as linhas nascem com a
      -- barbearia. Vale o mesmo padrão do cadastro.
      select p.ativo, p.abertura, p.fechamento into v_ativo, v_abertura, v_fechamento
      from public.horario_padrao(extract(dow from v_dia)::int) as p;
    end if;
    v_fechado := not v_ativo;
  end if;

  -- As mensagens são lidas pelo AgendarPage: mudar o texto quebra o aviso.
  if v_fechado then
    raise exception 'A barbearia não abre neste dia' using errcode = 'P0001';
  end if;

  -- Serviço sem duração conta 30 min, como no trigger de conflito. A tela usa
  -- 60, então o banco nunca recusa um horário que a tela ofereceu.
  if v_local < v_dia + v_abertura
     or v_local + make_interval(mins => v_duracao) > v_dia + v_fechamento then
    raise exception 'Horário fora do expediente da barbearia' using errcode = 'P0001';
  end if;

  -- Pausa: o serviço não pode encostar no intervalo do barbeiro. O texto vai
  -- direto para o cliente (AgendarPage mostra a mensagem de P0001).
  select * into v_pausa from public.pausa_do_dia(p_salon_id, v_dia);
  if v_pausa.inicio is not null
     and v_local < v_dia + v_pausa.inicio + make_interval(mins => v_pausa.minutos)
     and v_local + make_interval(mins => v_duracao) > v_dia + v_pausa.inicio then
    raise exception 'Esse horário é o intervalo da barbearia. Escolha outro.' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select c.id into v_cliente
  from clientes c
  where c.salon_id = p_salon_id and c.auth_user_id = v_uid;

  if v_cliente is null then
    insert into clientes (salon_id, auth_user_id, nome, telefone, email)
    values (p_salon_id, v_uid, p_nome, p_telefone, v_email)
    returning id into v_cliente;
  else
    update clientes
       set nome = coalesce(p_nome, nome),
           telefone = coalesce(p_telefone, telefone)
     where id = v_cliente;
  end if;

  -- limite de 2 agendamentos futuros por cliente, para evitar que alguém
  -- trave a agenda marcando horário em série.
  -- Horário fixo: as datas do fixo não contam. Foi o dono quem marcou, e com
  -- elas contando o cliente fixo nunca mais marcaria um horário extra.
  select count(*) into v_futuros
  from agendamentos a
  where a.cliente_id = v_cliente
    and a.status in ('pendente','confirmado')
    and a.data_hora > now()
    and a.fixo_id is null;

  if v_futuros >= 2 then
    raise exception 'Você já tem 2 horários marcados. Cancele um para marcar outro.'
      using errcode = 'P0001';
  end if;

  insert into agendamentos (
    salon_id, cliente_id, servico_id, servico, data_hora, status, valor, observacoes
  ) values (
    p_salon_id, v_cliente, p_servico_id, v_nome_serv, p_data_hora, 'confirmado', v_preco,
    nullif(btrim(coalesce(p_observacoes, '')), '')
  ) returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.criar_salao_com_convite(p_nome text, p_slug text, p_codigo text, p_whatsapp text DEFAULT NULL::text, p_termos_aceitos_em timestamp with time zone DEFAULT NULL::timestamp with time zone, p_termos_versao text DEFAULT NULL::text)
 RETURNS salons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid     uuid := auth.uid();
  v_codigo  text := upper(btrim(coalesce(p_codigo, '')));
  v_convite public.convites%rowtype;
  v_slug    text;
  v_salon   public.salons%rowtype;
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = 'P0001';
  end if;

  if exists (select 1 from salons s where s.dono_id = v_uid) then
    raise exception 'ja_tem_salao' using errcode = 'P0001';
  end if;

  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome_obrigatorio' using errcode = 'P0001';
  end if;

  v_slug := nullif(btrim(coalesce(p_slug, '')), '');
  if v_slug is null then
    raise exception 'slug_obrigatorio' using errcode = 'P0001';
  end if;

  if public.slug_reservado(v_slug) then
    raise exception 'slug_reservado' using errcode = 'P0001';
  end if;

  -- `for update` segura a linha ate o fim desta transacao: em dois cadastros
  -- simultaneos com o mesmo codigo, o segundo espera e encontra `usado_por`.
  select * into v_convite from convites c where c.codigo = v_codigo for update;

  if not found or v_convite.usado_por is not null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;

  if v_convite.expira_em <= now() then
    raise exception 'convite_expirado' using errcode = 'P0001';
  end if;

  if exists (select 1 from salons s where s.slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 6);
  end if;

  insert into salons (nome, slug, whatsapp, dono_id,
                      termos_aceitos_em, termos_versao)
  values (btrim(p_nome), v_slug,
          nullif(btrim(coalesce(p_whatsapp, '')), ''),
          v_uid,
          coalesce(p_termos_aceitos_em, now()),
          p_termos_versao)
  returning * into v_salon;

  update convites
     set usado_por = v_uid, usado_em = now(), salon_id = v_salon.id
   where codigo = v_codigo;

  return v_salon;
end
$function$
;

CREATE OR REPLACE FUNCTION public.eh_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.plataforma_admins
    where user_id = auth.uid() and ativo
  );
$function$
;

CREATE OR REPLACE FUNCTION public.estoque_entrada(p_produto_id uuid, p_quantidade integer, p_preco_custo numeric DEFAULT NULL::numeric)
 RETURNS estoque
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_item public.estoque%rowtype;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade_invalida' using errcode = 'P0001';
  end if;

  -- Compra mais cara ou mais barata atualiza o custo do produto dali em
  -- diante. As vendas ja feitas nao se mexem: o custo delas esta congelado.
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
$function$
;

CREATE OR REPLACE FUNCTION public.estoque_saida(p_produto_id uuid, p_quantidade integer, p_forma_pag text DEFAULT NULL::text, p_cliente_id uuid DEFAULT NULL::uuid)
 RETURNS vendas
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_item  public.estoque%rowtype;
  v_venda public.vendas%rowtype;
begin
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'quantidade_invalida' using errcode = 'P0001';
  end if;

  -- `for update` segura a linha ate o fim da transacao: duas baixas do mesmo
  -- produto ao mesmo tempo nao podem ler o mesmo saldo e vender duas vezes.
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
$function$
;

-- Fora da ordem alfabetica de proposito: `get_salon_id` chama esta funcao, e
-- funcao SQL tem o corpo conferido na criacao. Invertendo, a criacao falha.
CREATE OR REPLACE FUNCTION public.get_salon_id_proprio()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select id from public.salons
   where dono_id = (select auth.uid())
     and ativo
   limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_salon_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select o.salon_id
       from public.admin_observando o
      where o.admin_id = (select auth.uid())
        and public.eh_admin()),
    public.get_salon_id_proprio()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.horario_padrao(p_dia_semana integer)
 RETURNS TABLE(ativo boolean, abertura time without time zone, fechamento time without time zone)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p_dia_semana <> 0,
         time '09:00',
         case when p_dia_semana = 6 then time '14:00' else time '18:00' end
$function$
;

CREATE OR REPLACE FUNCTION public.horarios_ocupados(p_salon_id uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone)
 RETURNS TABLE(data_hora timestamp with time zone, duracao integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select a.data_hora, a.duracao
  from agendamentos a
  where a.salon_id = p_salon_id
    and a.status <> 'cancelado'
    and a.data_hora >= p_inicio
    and a.data_hora < least(p_fim, p_inicio + interval '31 days')
  union all
  -- Pausa de cada dia da janela, no formato de um agendamento: a tela do
  -- cliente esconde o horário sem precisar saber que é almoço.
  select (d::date + p.inicio) at time zone 'America/Sao_Paulo', p.minutos
  from generate_series(
         (p_inicio at time zone 'America/Sao_Paulo')::date::timestamp,
         (least(p_fim, p_inicio + interval '31 days') at time zone 'America/Sao_Paulo')::date::timestamp,
         interval '1 day') as d
  cross join lateral public.pausa_do_dia(p_salon_id, d::date) as p
  where p.inicio is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.meus_agendamentos(p_salon_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, salon_id uuid, servico text, data_hora timestamp with time zone, status text, valor numeric, salao_nome text, salao_slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select a.id, a.salon_id, a.servico, a.data_hora, a.status, a.valor, s.nome, s.slug
  from agendamentos a
  join salons  s on s.id = a.salon_id
  join clientes c on c.id = a.cliente_id
  where c.auth_user_id = auth.uid()
    and (p_salon_id is null or a.salon_id = p_salon_id)
  order by a.data_hora desc;
$function$
;

CREATE OR REPLACE FUNCTION public.modulo_liberado(p_slug text, p_modulo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.salon_modulos sm
    join public.salons s on s.id = sm.salon_id
    where s.slug = p_slug and s.ativo
      and sm.modulo = p_modulo
      and sm.disponivel and sm.ativo
  );
$function$
;

CREATE OR REPLACE FUNCTION public.preenche_duracao_agendamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.duracao is null then
    select s.duracao into new.duracao
    from servicos s where s.id = new.servico_id;
    new.duracao := coalesce(new.duracao, 30);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.salao_ativo(p_salon_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from salons s where s.id = p_salon_id and s.ativo);
$function$
;

CREATE OR REPLACE FUNCTION public.salao_publico(p_slug text)
 RETURNS TABLE(id uuid, slug text, nome text, cor_primaria text, logo_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select s.id, s.slug, s.nome, s.cor_primaria, s.logo_url
  from salons s
  where s.slug = p_slug and s.ativo;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_horarios_novo_salao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.horarios (salon_id, dia_semana, ativo, abertura, fechamento)
  select new.id, d, p.ativo, p.abertura, p.fechamento
  from generate_series(0, 6) as d
  cross join lateral public.horario_padrao(d) as p
  on conflict (salon_id, dia_semana) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_modulos_novo_salao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.salon_modulos (salon_id, modulo)
  select new.id, m.modulo
  from (values ('agendamento_online'),('estoque'),('financeiro')) as m(modulo)
  on conflict (salon_id, modulo) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.slug_disponivel(p_slug text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select not public.slug_reservado(p_slug)
     and not exists (select 1 from salons s where s.slug = p_slug)
$function$
;

CREATE OR REPLACE FUNCTION public.slug_reservado(p_slug text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  select lower(btrim(coalesce(p_slug, ''))) = any (array[
    'login', 'cadastro', 'cadastro-cliente', 'esqueci-senha', 'redefinir-senha',
    'quero-meu-salao', 'termos', 'privacidade', 'admin', 'onboarding', 'minha-conta',
    'api', 'app', 'assets', 'www', 'suporte', 'ajuda', 'entrar', 'sair', 'planos'
  ])
$function$
;

CREATE OR REPLACE FUNCTION public.valida_conflito_agendamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status = 'cancelado' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.salon_id::text, 0));

  if exists (
    select 1
    from agendamentos a
    where a.salon_id = new.salon_id
      and a.id <> new.id
      and a.status <> 'cancelado'
      and a.data_hora < new.data_hora + make_interval(mins => new.duracao)
      and a.data_hora + make_interval(mins => a.duracao) > new.data_hora
  ) then
    raise exception 'Horario indisponivel: ja existe um agendamento nesse intervalo'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vitrine_dias_especiais(p_slug text, p_desde date DEFAULT NULL::date)
 RETURNS TABLE(data date, fechado boolean, abertura time without time zone, fechamento time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select de.data, de.fechado, de.abertura, de.fechamento
  from dias_especiais de
  join salons s on s.id = de.salon_id
  where s.slug = p_slug and s.ativo
    and de.data >= coalesce(p_desde, current_date)
  order by de.data
$function$
;

CREATE OR REPLACE FUNCTION public.vitrine_horarios(p_slug text)
 RETURNS TABLE(dia_semana integer, abertura time without time zone, fechamento time without time zone, ativo boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select h.dia_semana, h.abertura, h.fechamento, h.ativo
  from horarios h
  join salons s on s.id = h.salon_id
  where s.slug = p_slug and s.ativo
  order by h.dia_semana
$function$
;

CREATE OR REPLACE FUNCTION public.vitrine_servicos(p_slug text)
 RETURNS TABLE(id uuid, nome text, preco numeric, duracao integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select sv.id, sv.nome, sv.preco, sv.duracao
  from servicos sv
  join salons s on s.id = sv.salon_id
  where s.slug = p_slug and s.ativo and sv.ativo
  order by sv.nome
$function$
;

CREATE OR REPLACE FUNCTION public.admin_observar_salao(p_salon_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_slug text;
begin
  if not public.eh_admin() then
    raise exception 'nao_autorizado' using errcode = 'P0001';
  end if;

  select s.slug into v_slug from salons s where s.id = p_salon_id;
  if v_slug is null then
    raise exception 'barbearia_nao_encontrada' using errcode = 'P0001';
  end if;

  insert into admin_observando (admin_id, salon_id)
  values (auth.uid(), p_salon_id)
  on conflict (admin_id) do update
    set salon_id = excluded.salon_id, iniciado_em = now();

  insert into auditoria_admin (admin_id, salon_id, acao, detalhe)
  values (auth.uid(), p_salon_id, 'observacao_iniciada',
          jsonb_build_object('slug', v_slug));

  return v_slug;
end
$function$
;

CREATE OR REPLACE FUNCTION public.admin_encerrar_observacao()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_salon uuid;
begin
  delete from admin_observando where admin_id = auth.uid()
  returning salon_id into v_salon;

  if v_salon is not null then
    insert into auditoria_admin (admin_id, salon_id, acao, detalhe)
    values (auth.uid(), v_salon, 'observacao_encerrada', '{}'::jsonb);
  end if;
end
$function$
;

CREATE OR REPLACE FUNCTION public.salao_atual()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'salon', (
      select to_jsonb(s) from salons s
       where s.id = coalesce(
         (select o.salon_id
            from admin_observando o
           where o.admin_id = (select auth.uid())
             and public.eh_admin()),
         (select s2.id from salons s2
           where s2.dono_id = (select auth.uid())
           limit 1)
       )
    ),
    'observando', exists (
      select 1 from admin_observando o
       where o.admin_id = (select auth.uid()) and public.eh_admin()
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.valida_limite_agendamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'UPDATE' and new.data_hora is not distinct from old.data_hora then
    return new;
  end if;
  if new.data_hora >= (((now() at time zone 'America/Sao_Paulo')::date
                        + interval '3 months' + interval '1 day')
                       at time zone 'America/Sao_Paulo') then
    raise exception 'agendamento permitido até 3 meses à frente' using errcode = 'check_violation';
  end if;
  return new;
end $function$
;

-- Horario fixo (20260925193530_horario_fixo.sql)

CREATE OR REPLACE FUNCTION public.expediente_do_dia(p_salon_id uuid, p_dia date, OUT fechado boolean, OUT abertura time without time zone, OUT fechamento time without time zone)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_ativo boolean;
begin
  select de.fechado, de.abertura, de.fechamento into fechado, abertura, fechamento
  from dias_especiais de
  where de.salon_id = p_salon_id and de.data = p_dia;
  if found then return; end if;

  select h.ativo, h.abertura, h.fechamento into v_ativo, abertura, fechamento
  from horarios h
  where h.salon_id = p_salon_id and h.dia_semana = extract(dow from p_dia)::int;
  if not found then
    select p.ativo, p.abertura, p.fechamento into v_ativo, abertura, fechamento
    from public.horario_padrao(extract(dow from p_dia)::int) as p;
  end if;
  fechado := not coalesce(v_ativo, false);
end $function$
;

CREATE OR REPLACE FUNCTION public.gerar_agendamentos_fixos(p_salon_id uuid, p_fixo_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(fixo uuid, dia date, situacao text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  f           record;
  v_exp       record;
  v_pausa     record;
  -- Último dia que `valida_limite_agendamento` aceita
  v_limite    date := ((now() at time zone 'America/Sao_Paulo')::date + interval '3 months')::date;
  v_passo     integer;
  v_dia       date;
  v_inicio    timestamptz;
  v_nome      text;
  v_preco     numeric;
  v_duracao   integer;
begin
  -- Mesma trava do trigger de conflito: duas gerações simultâneas (dois
  -- clientes marcando ao mesmo tempo) não criam a mesma data duas vezes.
  perform pg_advisory_xact_lock(hashtextextended(p_salon_id::text, 0));

  for f in
    select h.* from horarios_fixos h
    where h.salon_id = p_salon_id
      and h.ativo
      and (p_fixo_id is null or h.id = p_fixo_id)
      and (h.gerado_ate is null or h.gerado_ate < v_limite)
    for update
  loop
    select s.nome, s.preco, coalesce(s.duracao, 30) into v_nome, v_preco, v_duracao
    from servicos s where s.id = f.servico_id;
    -- Serviço apagado: o fixo para de gerar, mas as datas já criadas ficam.
    continue when v_nome is null;

    v_passo := 7 * f.intervalo_semanas;
    v_dia := f.data_inicio;
    if f.gerado_ate is not null and f.gerado_ate >= v_dia then
      -- Primeira data depois da última já gerada
      v_dia := f.data_inicio + ((f.gerado_ate - f.data_inicio) / v_passo + 1) * v_passo;
    end if;

    while v_dia <= v_limite loop
      v_inicio := (v_dia + f.hora) at time zone 'America/Sao_Paulo';
      if v_inicio > now() then
        select * into v_exp from public.expediente_do_dia(p_salon_id, v_dia);
        select * into v_pausa from public.pausa_do_dia(p_salon_id, v_dia);
        fixo := f.id; dia := v_dia;

        if v_exp.fechado
           or f.hora < v_exp.abertura
           or f.hora + make_interval(mins => v_duracao) > v_exp.fechamento
           or f.hora + make_interval(mins => v_duracao) < f.hora then  -- passou da meia-noite
          situacao := 'fechado';
        elsif v_pausa.inicio is not null
              and f.hora < v_pausa.inicio + make_interval(mins => v_pausa.minutos)
              and f.hora + make_interval(mins => v_duracao) > v_pausa.inicio then
          situacao := 'pausa';
        elsif exists (
          select 1 from agendamentos a
          where a.salon_id = p_salon_id
            and a.status <> 'cancelado'
            and a.data_hora < v_inicio + make_interval(mins => v_duracao)
            and a.data_hora + make_interval(mins => a.duracao) > v_inicio
        ) then
          situacao := 'ocupado';
        else
          insert into agendamentos (salon_id, cliente_id, servico_id, servico, data_hora,
                                    status, valor, observacoes, duracao, fixo_id)
          values (p_salon_id, f.cliente_id, f.servico_id, v_nome, v_inicio,
                  'confirmado', v_preco, f.observacoes, v_duracao, f.id);
          situacao := 'marcado';
        end if;
        return next;
      end if;
      v_dia := v_dia + v_passo;
    end loop;

    update horarios_fixos set gerado_ate = v_limite where id = f.id;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.criar_horario_fixo(p_cliente_id uuid, p_servico_id uuid, p_data_inicio date, p_hora time without time zone, p_intervalo_semanas integer, p_observacoes text DEFAULT NULL::text)
 RETURNS TABLE(fixo uuid, dia date, situacao text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_salon uuid := public.get_salon_id_proprio();
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_id    uuid;
begin
  if v_salon is null then
    raise exception 'Sem permissão' using errcode = 'P0001';
  end if;
  if p_intervalo_semanas is null or p_intervalo_semanas not in (1, 2, 4) then
    raise exception 'Repetição inválida' using errcode = 'P0001';
  end if;
  if p_data_inicio is null or p_hora is null then
    raise exception 'Informe a data e o horário' using errcode = 'P0001';
  end if;
  if p_data_inicio < v_hoje then
    raise exception 'A primeira data não pode ser no passado' using errcode = 'P0001';
  end if;
  if p_data_inicio > (v_hoje + interval '3 months')::date then
    raise exception 'agendamento permitido até 3 meses à frente' using errcode = 'P0001';
  end if;
  if not exists (select 1 from clientes c where c.id = p_cliente_id and c.salon_id = v_salon) then
    raise exception 'Cliente não encontrado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from servicos s where s.id = p_servico_id and s.salon_id = v_salon and s.ativo) then
    raise exception 'Serviço indisponível' using errcode = 'P0001';
  end if;

  insert into horarios_fixos (salon_id, cliente_id, servico_id, data_inicio, hora,
                              intervalo_semanas, observacoes)
  values (v_salon, p_cliente_id, p_servico_id, p_data_inicio, p_hora, p_intervalo_semanas,
          nullif(btrim(coalesce(p_observacoes, '')), ''))
  returning id into v_id;

  return query select * from public.gerar_agendamentos_fixos(v_salon, v_id);

  -- Nenhuma data livre: desfaz tudo em vez de deixar um fixo que não reserva nada
  if not exists (select 1 from agendamentos a where a.fixo_id = v_id) then
    raise exception 'Nenhuma data livre para esse horário fixo' using errcode = 'P0001';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.encerrar_horario_fixo(p_fixo_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_salon uuid := public.get_salon_id_proprio();
  v_canceladas integer;
begin
  update horarios_fixos
     set ativo = false, encerrado_em = now()
   where id = p_fixo_id and salon_id = v_salon and ativo;
  if not found then
    raise exception 'Horário fixo não encontrado' using errcode = 'P0001';
  end if;

  update agendamentos
     set status = 'cancelado'
   where fixo_id = p_fixo_id
     and salon_id = v_salon
     and status in ('pendente', 'confirmado')
     and data_hora > now();
  get diagnostics v_canceladas = row_count;
  return v_canceladas;
end $function$
;

CREATE OR REPLACE FUNCTION public.gerar_meus_horarios_fixos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_salon uuid := public.get_salon_id_proprio();
  v_marcados integer;
begin
  if v_salon is null then return 0; end if;
  select count(*) into v_marcados
  from public.gerar_agendamentos_fixos(v_salon) g
  where g.situacao = 'marcado';
  return v_marcados;
end $function$
;

-- Pausa / almoco (20260925200725_pausa_almoco.sql)

CREATE OR REPLACE FUNCTION public.pausa_do_dia(p_salon_id uuid, p_dia date, OUT inicio time without time zone, OUT minutos integer)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  select pd.inicio, pd.minutos into inicio, minutos
  from pausas_dia pd
  where pd.salon_id = p_salon_id and pd.data = p_dia;
  if found then return; end if;

  select h.pausa_inicio, h.pausa_minutos into inicio, minutos
  from horarios h
  where h.salon_id = p_salon_id and h.dia_semana = extract(dow from p_dia)::int;
end $function$
;

-- ===== CONSTRAINT QUE DEPENDE DE FUNCAO =====
--
-- Fica aqui, e nao no bloco de constraints la em cima, porque uma CHECK que
-- chama funcao so pode ser criada depois da funcao existir. Aplicar este
-- arquivo de cima para baixo num banco vazio falharia na ordem antiga.

alter table public.salons add constraint salons_slug_nao_reservado CHECK ((NOT slug_reservado(slug)));

-- ===== TRIGGERS =====

CREATE TRIGGER trg_agendamento_preenche_duracao BEFORE INSERT ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION preenche_duracao_agendamento();
CREATE TRIGGER trg_valida_conflito_agendamento BEFORE INSERT OR UPDATE OF data_hora, status, servico_id, duracao ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION valida_conflito_agendamento();
CREATE TRIGGER trg_valida_limite_agendamento BEFORE INSERT OR UPDATE OF data_hora ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION valida_limite_agendamento();
CREATE TRIGGER salons_seed_horarios AFTER INSERT ON public.salons FOR EACH ROW EXECUTE FUNCTION seed_horarios_novo_salao();
CREATE TRIGGER salons_seed_modulos AFTER INSERT ON public.salons FOR EACH ROW EXECUTE FUNCTION seed_modulos_novo_salao();

-- ===== EVENT TRIGGER =====
--
-- Liga RLS sozinho em toda tabela nova criada no schema `public`. E a rede que
-- evita tabela nascendo aberta: sem ela, uma tabela criada as pressas pelo
-- painel fica legivel por qualquer pessoa com a chave anon.

CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION rls_auto_enable();

-- ===== ROW LEVEL SECURITY =====

alter table public.admin_observando enable row level security;
alter table public.agendamentos enable row level security;
alter table public.auditoria_admin enable row level security;
alter table public.clientes enable row level security;
alter table public.convites enable row level security;
alter table public.dias_especiais enable row level security;
alter table public.estoque enable row level security;
alter table public.horarios enable row level security;
alter table public.horarios_fixos enable row level security;
alter table public.pausas_dia enable row level security;
alter table public.plataforma_admins enable row level security;
alter table public.salon_modulos enable row level security;
alter table public.salons enable row level security;
alter table public.servicos enable row level security;
alter table public.vendas enable row level security;

-- `auditoria_admin`, `plataforma_admins` e `convites` ficam com RLS ativa e
-- NENHUMA policy, de proposito: isso as fecha para acesso direto, e so as
-- funcoes SECURITY DEFINER do painel conseguem le-las.

-- ===== POLICIES =====
--
-- Quatro por tabela de barbearia, e nao uma so com FOR ALL, por causa da
-- observacao do /admin: a LEITURA aceita a barbearia observada, a escrita e a
-- exclusao so aceitam a propria. Uma policy FOR ALL nao daria conta porque
-- DELETE nao passa por WITH CHECK -- o observador nao editaria nada e ainda
-- assim conseguiria apagar.

create policy agendamentos_leitura on public.agendamentos as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy agendamentos_insercao on public.agendamentos as PERMISSIVE for INSERT to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy agendamentos_alteracao on public.agendamentos as PERMISSIVE for UPDATE to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy agendamentos_exclusao on public.agendamentos as PERMISSIVE for DELETE to authenticated
  using ((salon_id = get_salon_id_proprio()));

create policy clientes_leitura on public.clientes as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy clientes_insercao on public.clientes as PERMISSIVE for INSERT to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy clientes_alteracao on public.clientes as PERMISSIVE for UPDATE to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy clientes_exclusao on public.clientes as PERMISSIVE for DELETE to authenticated
  using ((salon_id = get_salon_id_proprio()));

create policy dias_especiais_leitura on public.dias_especiais as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy dias_especiais_insercao on public.dias_especiais as PERMISSIVE for INSERT to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy dias_especiais_alteracao on public.dias_especiais as PERMISSIVE for UPDATE to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy dias_especiais_exclusao on public.dias_especiais as PERMISSIVE for DELETE to authenticated
  using ((salon_id = get_salon_id_proprio()));

create policy estoque_leitura on public.estoque as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy estoque_insercao on public.estoque as PERMISSIVE for INSERT to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy estoque_alteracao on public.estoque as PERMISSIVE for UPDATE to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy estoque_exclusao on public.estoque as PERMISSIVE for DELETE to authenticated
  using ((salon_id = get_salon_id_proprio()));

create policy horarios_leitura on public.horarios as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy horarios_insercao on public.horarios as PERMISSIVE for INSERT to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy horarios_alteracao on public.horarios as PERMISSIVE for UPDATE to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy horarios_exclusao on public.horarios as PERMISSIVE for DELETE to authenticated
  using ((salon_id = get_salon_id_proprio()));

-- Horario fixo: so leitura. Criar, gerar e encerrar passam pelas funcoes
-- SECURITY DEFINER, que conferem cliente e servico da barbearia.
create policy horarios_fixos_leitura on public.horarios_fixos as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy pausas_dia_leitura on public.pausas_dia as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy pausas_dia_insercao on public.pausas_dia as PERMISSIVE for INSERT to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy pausas_dia_alteracao on public.pausas_dia as PERMISSIVE for UPDATE to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy pausas_dia_exclusao on public.pausas_dia as PERMISSIVE for DELETE to authenticated
  using ((salon_id = get_salon_id_proprio()));

create policy servicos_leitura on public.servicos as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy servicos_insercao on public.servicos as PERMISSIVE for INSERT to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy servicos_alteracao on public.servicos as PERMISSIVE for UPDATE to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy servicos_exclusao on public.servicos as PERMISSIVE for DELETE to authenticated
  using ((salon_id = get_salon_id_proprio()));

create policy vendas_leitura on public.vendas as PERMISSIVE for SELECT to authenticated
  using ((salon_id = get_salon_id()));

create policy vendas_insercao on public.vendas as PERMISSIVE for INSERT to authenticated
  with check ((salon_id = get_salon_id_proprio()));

create policy vendas_alteracao on public.vendas as PERMISSIVE for UPDATE to authenticated
  using ((salon_id = get_salon_id_proprio()))
  with check ((salon_id = get_salon_id_proprio()));

create policy vendas_exclusao on public.vendas as PERMISSIVE for DELETE to authenticated
  using ((salon_id = get_salon_id_proprio()));

-- Sem policy de INSERT em `salons`, de proposito: criar barbearia so acontece
-- dentro de criar_salao_com_convite(), que exige convite valido e nao usado.
create policy salons_owner_leitura on public.salons as PERMISSIVE for SELECT to authenticated
  using ((dono_id = ( SELECT auth.uid() AS uid)));

create policy salons_owner_alteracao on public.salons as PERMISSIVE for UPDATE to authenticated
  using ((dono_id = ( SELECT auth.uid() AS uid)))
  with check ((dono_id = ( SELECT auth.uid() AS uid)));

create policy salons_owner_exclusao on public.salons as PERMISSIVE for DELETE to authenticated
  using ((dono_id = ( SELECT auth.uid() AS uid)));

create policy salon_modulos_leitura_dono on public.salon_modulos as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM salons s
  WHERE ((s.id = salon_modulos.salon_id) AND (s.dono_id = auth.uid())))));

create policy salon_modulos_ativacao_dono on public.salon_modulos as PERMISSIVE for UPDATE to authenticated
  using ((EXISTS ( SELECT 1
   FROM salons s
  WHERE ((s.id = salon_modulos.salon_id) AND (s.dono_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM salons s
  WHERE ((s.id = salon_modulos.salon_id) AND (s.dono_id = auth.uid())))));

-- O painel aberto pela plataforma precisa ler o cadastro e os modulos da
-- barbearia observada. So leitura, e so para quem esta em `plataforma_admins`.
create policy salons_observacao_leitura on public.salons as PERMISSIVE for SELECT to authenticated
  using ((eh_admin() AND (id = get_salon_id())));

create policy salon_modulos_observacao_leitura on public.salon_modulos as PERMISSIVE for SELECT to authenticated
  using ((eh_admin() AND (salon_id = get_salon_id())));

-- ===== PRIVILEGIOS DE TABELA =====
--
-- O Supabase concede todos os privilegios a `anon` e `authenticated` em toda
-- tabela do schema `public` e deixa a protecao inteira por conta do RLS. Isso
-- resolve LINHA, mas RLS nao filtra COLUNA: as policies dizem quais linhas o
-- dono altera, nao quais campos.
--
-- Sem as revogacoes abaixo, um dono reativava a propria barbearia
-- (`salons.ativo`, derrubando o bloqueio do /admin) e liberava modulo pago
-- (`salon_modulos.disponivel`) por chamada direta a API REST, com a chave anon
-- que esta no navegador. Verificado no banco em 18/09/2026.
--
-- As demais tabelas ficam com o padrao do Supabase de proposito: nelas nao ha
-- coluna que o dono nao possa escrever, e o isolamento entre barbearias e
-- feito pelas policies de `salon_id`.

revoke update on public.salons from anon, authenticated;
grant  update (nome, slug, whatsapp, cor_primaria, logo_url)
  on public.salons to authenticated;

revoke update on public.salon_modulos from anon, authenticated;
grant  update (ativo) on public.salon_modulos to authenticated;

-- `horarios_fixos` so e escrita pelas funcoes do horario fixo.
revoke insert, update, delete on public.horarios_fixos from anon, authenticated;

-- ===== PRIVILEGIOS DE FUNCAO =====
--
-- O Postgres concede EXECUTE a PUBLIC por padrao em toda funcao criada, entao
-- as revogacoes abaixo sao a parte que importa: sem elas, conceder a
-- `authenticated` nao exclui o `anon`.

-- Nao sao chamadas por nome: as de trigger sao disparadas pelo Postgres, que
-- nao confere EXECUTE no disparo, e `horario_padrao` so e lida de dentro de
-- outras funcoes SECURITY DEFINER.
revoke execute on function public.horario_padrao(p_dia_semana integer) from public, anon, authenticated;
revoke execute on function public.preenche_duracao_agendamento() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.seed_horarios_novo_salao() from public, anon, authenticated;
revoke execute on function public.seed_modulos_novo_salao() from public, anon, authenticated;
revoke execute on function public.valida_conflito_agendamento() from public, anon, authenticated;
revoke execute on function public.valida_limite_agendamento() from public, anon, authenticated;
revoke execute on function public.expediente_do_dia(p_salon_id uuid, p_dia date) from public, anon, authenticated;
revoke execute on function public.gerar_agendamentos_fixos(p_salon_id uuid, p_fixo_id uuid) from public, anon, authenticated;
revoke execute on function public.pausa_do_dia(p_salon_id uuid, p_dia date) from public, anon, authenticated;

-- Funcoes de sessao: exigem login.
revoke execute on function public.get_salon_id() from public, anon;
grant  execute on function public.get_salon_id() to authenticated;
revoke execute on function public.get_salon_id_proprio() from public, anon;
grant  execute on function public.get_salon_id_proprio() to authenticated;
revoke execute on function public.salao_atual() from public, anon;
grant  execute on function public.salao_atual() to authenticated;
revoke execute on function public.admin_observar_salao(p_salon_id uuid) from public, anon;
grant  execute on function public.admin_observar_salao(p_salon_id uuid) to authenticated;
revoke execute on function public.admin_encerrar_observacao() from public, anon;
grant  execute on function public.admin_encerrar_observacao() to authenticated;
revoke execute on function public.eh_admin() from public, anon;
grant  execute on function public.eh_admin() to authenticated;
revoke execute on function public.estoque_entrada(p_produto_id uuid, p_quantidade integer, p_preco_custo numeric) from public, anon;
grant  execute on function public.estoque_entrada(p_produto_id uuid, p_quantidade integer, p_preco_custo numeric) to authenticated;
revoke execute on function public.estoque_saida(p_produto_id uuid, p_quantidade integer, p_forma_pag text, p_cliente_id uuid) from public, anon;
grant  execute on function public.estoque_saida(p_produto_id uuid, p_quantidade integer, p_forma_pag text, p_cliente_id uuid) to authenticated;
revoke execute on function public.horarios_ocupados(p_salon_id uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone) from public, anon;
grant  execute on function public.horarios_ocupados(p_salon_id uuid, p_inicio timestamp with time zone, p_fim timestamp with time zone) to authenticated;
revoke execute on function public.slug_reservado(p_slug text) from public, anon;
grant  execute on function public.slug_reservado(p_slug text) to authenticated;
revoke execute on function public.criar_agendamento_cliente(p_salon_id uuid, p_servico_id uuid, p_data_hora timestamp with time zone, p_nome text, p_telefone text, p_observacoes text) from public, anon;
grant  execute on function public.criar_agendamento_cliente(p_salon_id uuid, p_servico_id uuid, p_data_hora timestamp with time zone, p_nome text, p_telefone text, p_observacoes text) to authenticated;
revoke execute on function public.meus_agendamentos(p_salon_id uuid) from public, anon;
grant  execute on function public.meus_agendamentos(p_salon_id uuid) to authenticated;
revoke execute on function public.cancelar_meu_agendamento(p_agendamento_id uuid) from public, anon;
grant  execute on function public.cancelar_meu_agendamento(p_agendamento_id uuid) to authenticated;
revoke execute on function public.criar_salao_com_convite(p_nome text, p_slug text, p_codigo text, p_whatsapp text, p_termos_aceitos_em timestamp with time zone, p_termos_versao text) from public, anon;
grant  execute on function public.criar_salao_com_convite(p_nome text, p_slug text, p_codigo text, p_whatsapp text, p_termos_aceitos_em timestamp with time zone, p_termos_versao text) to authenticated;
revoke execute on function public.admin_listar_saloes() from public, anon;
grant  execute on function public.admin_listar_saloes() to authenticated;
revoke execute on function public.admin_uso_banco() from public, anon;
grant  execute on function public.admin_uso_banco() to authenticated;
revoke execute on function public.admin_definir_modulo(p_salon_id uuid, p_modulo text, p_disponivel boolean) from public, anon;
grant  execute on function public.admin_definir_modulo(p_salon_id uuid, p_modulo text, p_disponivel boolean) to authenticated;
revoke execute on function public.admin_definir_situacao_salao(p_salon_id uuid, p_ativo boolean) from public, anon;
grant  execute on function public.admin_definir_situacao_salao(p_salon_id uuid, p_ativo boolean) to authenticated;
revoke execute on function public.admin_auditoria_salao(p_salon_id uuid, p_limite integer) from public, anon;
grant  execute on function public.admin_auditoria_salao(p_salon_id uuid, p_limite integer) to authenticated;
revoke execute on function public.admin_gerar_convite(p_nota text, p_minutos integer) from public, anon;
grant  execute on function public.admin_gerar_convite(p_nota text, p_minutos integer) to authenticated;
revoke execute on function public.admin_listar_convites(p_limite integer) from public, anon;
grant  execute on function public.admin_listar_convites(p_limite integer) to authenticated;
revoke execute on function public.criar_horario_fixo(p_cliente_id uuid, p_servico_id uuid, p_data_inicio date, p_hora time without time zone, p_intervalo_semanas integer, p_observacoes text) from public, anon;
grant  execute on function public.criar_horario_fixo(p_cliente_id uuid, p_servico_id uuid, p_data_inicio date, p_hora time without time zone, p_intervalo_semanas integer, p_observacoes text) to authenticated;
revoke execute on function public.encerrar_horario_fixo(p_fixo_id uuid) from public, anon;
grant  execute on function public.encerrar_horario_fixo(p_fixo_id uuid) to authenticated;
revoke execute on function public.gerar_meus_horarios_fixos() from public, anon;
grant  execute on function public.gerar_meus_horarios_fixos() to authenticated;

-- Publicas de proposito: a vitrine, o agendamento e o cadastro precisam delas
-- sem login. Estas mantem o EXECUTE que PUBLIC recebe por padrao.
grant execute on function public.convite_valido(p_codigo text) to anon, authenticated;
grant execute on function public.modulo_liberado(p_slug text, p_modulo text) to anon, authenticated;
grant execute on function public.salao_ativo(p_salon_id uuid) to anon, authenticated;
grant execute on function public.salao_publico(p_slug text) to anon, authenticated;
grant execute on function public.slug_disponivel(p_slug text) to anon, authenticated;

-- A vitrine por slug nao herda o EXECUTE de PUBLIC: so anon e authenticated.
revoke execute on function public.vitrine_servicos(p_slug text) from public;
revoke execute on function public.vitrine_horarios(p_slug text) from public;
revoke execute on function public.vitrine_dias_especiais(p_slug text, p_desde date) from public;
grant execute on function public.vitrine_servicos(p_slug text) to anon, authenticated;
grant execute on function public.vitrine_horarios(p_slug text) to anon, authenticated;
grant execute on function public.vitrine_dias_especiais(p_slug text, p_desde date) to anon, authenticated;

-- ===== COMENTARIOS =====

comment on column public.vendas.custo_total is 'Custo do produto no momento da venda, multiplicado pela quantidade. Gravado aqui para o lucro do passado nao mudar quando o preco de custo do produto mudar.';

-- ===== PUBLICACAO REALTIME =====

alter publication supabase_realtime add table public.agendamentos;
