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
