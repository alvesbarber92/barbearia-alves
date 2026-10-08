-- Aplicada no banco em 14/09/2026 (UTC) pelo conector, registrada lá como
-- "logos_das_barbearias".
--
-- Logo da barbearia: o dono envia em Configurações > Perfil e ele aparece no
-- painel, na vitrine e no agendamento. O endereço fica em salons.logo_url.
--
-- Bucket público: a imagem é lida pela URL /object/public/logos/..., que não
-- passa por policy. Por isso NÃO há policy de SELECT aberta: ela deixaria
-- listar os arquivos de todas as barbearias pela API.
--
-- Cada barbearia grava só na própria pasta: <salon_id>/logo-<timestamp>.<ext>.
-- A policy de SELECT restrita à pasta existe porque apagar um arquivo pela
-- API exige também poder lê-lo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']);

create policy logos_dono_le_a_propria_pasta on storage.objects
  for select to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (public.get_salon_id())::text);

create policy logos_dono_envia on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = (public.get_salon_id())::text);

create policy logos_dono_atualiza on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (public.get_salon_id())::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = (public.get_salon_id())::text);

create policy logos_dono_apaga on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (public.get_salon_id())::text);
