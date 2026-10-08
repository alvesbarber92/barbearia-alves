const chave = (slug) => `salao_publico:${slug}`

export function lerSalaoGuardado(slug) {
  if (!slug) return null
  try {
    const s = JSON.parse(localStorage.getItem(chave(slug)))
    return s?.slug === slug ? s : null
  } catch {
    return null
  }
}

export function guardarSalao(slug, salon) {
  try {
    if (salon) localStorage.setItem(chave(slug), JSON.stringify(salon))
    else localStorage.removeItem(chave(slug))
  } catch {
    return
  }
}
