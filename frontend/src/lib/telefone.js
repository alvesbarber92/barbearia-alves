export function digitosTelefone(valor) {
  return (valor || '').replace(/\D/g, '').slice(0, 11)
}

export function mascararTelefone(valor) {
  const d = digitosTelefone(valor)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function formatarTelefone(tel) {
  const d = (tel || '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return mascararTelefone(d)
  return tel
}

export function telefoneValido(valor) {
  const d = (valor || '').replace(/\D/g, '')
  if (d.length === 0) return true
  if (d[0] === '0') return false
  if (d.length === 11) return d[2] === '9'
  return d.length === 10
}

export const MSG_TELEFONE_INVALIDO = 'Telefone inválido. Use DDD + número, ex.: (16) 99748-5859'

export const propsCampoTelefone = {
  type: 'tel',
  inputMode: 'numeric',
  maxLength: 15,
  autoComplete: 'tel',
  placeholder: '(16) 99748-5859',
}
