revoke update on public.salons from anon, authenticated;
grant  update (nome, slug, whatsapp, cor_primaria, logo_url)
  on public.salons to authenticated;

revoke update on public.salon_modulos from anon, authenticated;
grant  update (ativo) on public.salon_modulos to authenticated;

