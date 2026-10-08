-- Aplicada no banco em 14/09/2026 (UTC) pelo conector, registrada lá como
-- "tempo_real_agendamentos".
--
-- Dashboard e agenda assinam postgres_changes em agendamentos, mas a
-- publicação supabase_realtime estava vazia: nenhum evento chegava e a tela
-- só mudava ao recarregar. O Realtime aplica o RLS de quem assina
-- (agendamentos_isolamento), então cada dono só recebe a própria barbearia.

alter publication supabase_realtime add table public.agendamentos;
