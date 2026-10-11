const POR_CODIGO = {
  user_already_exists:        'Este e-mail já tem conta. Entre com sua senha ou use "Esqueci minha senha".',
  email_exists:               'Este e-mail já tem conta. Entre com sua senha ou use "Esqueci minha senha".',
  weak_password:              'Senha fraca. Use pelo menos 8 caracteres, com letras e números.',
  email_address_invalid:      'E-mail inválido. Confira o endereço digitado.',
  validation_failed:          'Confira o e-mail e a senha digitados.',
  invalid_credentials:        'E-mail ou senha inválidos',
  email_not_confirmed:        'Confirme seu e-mail antes de entrar',
  over_email_send_rate_limit: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  over_request_rate_limit:    'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  signup_disabled:            'O cadastro está desativado no momento.',
  user_banned:                'Esta conta está bloqueada. Fale com a barbearia.',
}

const POR_TEXTO = [
  ['already registered', POR_CODIGO.user_already_exists],
  ['password should be', POR_CODIGO.weak_password],
  ['invalid login credentials', POR_CODIGO.invalid_credentials],
  ['unable to validate email', POR_CODIGO.email_address_invalid],
  ['email not confirmed', POR_CODIGO.email_not_confirmed],
  ['rate limit', POR_CODIGO.over_request_rate_limit],
]

export function mensagemErroAuth(error, padrao = 'Algo deu errado. Tente de novo.') {
  if (!error) return padrao
  if (error.code && POR_CODIGO[error.code]) return POR_CODIGO[error.code]
  if (error.status === 429) return POR_CODIGO.over_request_rate_limit
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'Sem conexão. Confira a internet e tente de novo.'
  }
  const texto = String(error.message || '').toLowerCase()
  const achado = POR_TEXTO.find(([trecho]) => texto.includes(trecho))
  return achado ? achado[1] : padrao
}
