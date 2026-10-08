export function generateSlug(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const SLUGS_RESERVADOS = new Set([
  'login', 'cadastro', 'cadastro-cliente', 'esqueci-senha', 'redefinir-senha',
  'quero-meu-salao', 'termos', 'privacidade', 'admin', 'onboarding', 'minha-conta',
  'api', 'app', 'assets', 'www', 'suporte', 'ajuda', 'entrar', 'sair', 'planos',
])

export function slugReservado(slug) {
  return SLUGS_RESERVADOS.has(slug)
}
