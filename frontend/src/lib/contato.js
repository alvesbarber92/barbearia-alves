export const WHATSAPP_COMERCIAL = '16997485859'

export function linkWhatsappInteresse({ nome = '', salao = '' } = {}) {
  const partes = ['Olá! Tenho interesse no sistema de agendamento da Alves BarberShop.']
  if (nome.trim())  partes.push(`Meu nome é ${nome.trim()}.`)
  if (salao.trim()) partes.push(`A barbearia se chama ${salao.trim()}.`)
  partes.push('Pode me explicar como funciona?')

  const texto = encodeURIComponent(partes.join(' '))
  return `https://wa.me/55${WHATSAPP_COMERCIAL}?text=${texto}`
}

export function linkWhatsappSuporte({ salao = '', email = '' } = {}) {
  const partes = ['Olá! O sistema da Alves BarberShop está bloqueado.']
  if (salao.trim()) partes.push(`Barbearia: ${salao.trim()}.`)
  if (email.trim()) partes.push(`Conta: ${email.trim()}.`)
  partes.push('Pode verificar, por favor?')

  return `https://wa.me/55${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(partes.join(' '))}`
}
