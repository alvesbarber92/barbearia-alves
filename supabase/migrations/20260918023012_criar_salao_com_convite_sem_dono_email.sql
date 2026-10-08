-- Aplicada no banco em 18/09/2026 (UTC), registrada lá como
-- "criar_salao_com_convite_sem_dono_email".
--
-- Corrige a migration anterior. `salons.dono_email` foi removida do banco pelo
-- painel, sem migration, quando o e-mail do dono passou a vir de `auth.users`
-- por `dono_id` — dá para ver isso em `admin_listar_saloes`, que hoje faz
-- `left join auth.users u on u.id = s.dono_id`. A remoção foi acertada: um
-- e-mail só, num lugar só. O que faltou foi o arquivo registrando a mudança.
--
-- Sem esse registro, a migration de 15/09 ficou no repositório inserindo numa
-- coluna que já não existia, e ao ser aplicada em 18/09 recolocou o erro no
-- banco. PL/pgSQL não valida nome de coluna na criação da função, só na
-- execução, então nada reclamou: a primeira barbearia nova é que descobriria,
-- no meio do cadastro.
--
-- Mesma função, mesma trava de slug reservado, inserindo só o que existe.

create or replace function public.criar_salao_com_convite(
  p_nome              text,
  p_slug              text,
  p_codigo            text,
  p_whatsapp          text        default null,
  p_termos_aceitos_em timestamptz default null,
  p_termos_versao     text        default null
)
returns public.salons
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
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

  -- `for update` segura a linha até o fim desta transação: em dois cadastros
  -- simultâneos com o mesmo código, o segundo espera e encontra `usado_por`.
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
$fn$;
