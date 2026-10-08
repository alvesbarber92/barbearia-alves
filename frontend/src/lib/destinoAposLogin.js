import { supabase } from './supabase'

export async function destinoAposLogin(user) {
  const { data: ehAdmin, error: erroAdmin } = await supabase.rpc('eh_admin')
  if (!erroAdmin && ehAdmin === true) return '/admin'
  if (user?.user_metadata?.role === 'cliente') return '/minha-conta'
  const { data } = await supabase.from('salons').select('slug').eq('dono_id', user.id).maybeSingle()
  return data ? `/${data.slug}/dashboard` : '/onboarding'
}

export function caminhoInterno(valor) {
  return typeof valor === 'string' && /^\/(?![/\\])/.test(valor) ? valor : null
}
