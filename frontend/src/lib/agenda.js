export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function horarioPadrao(diaSemana) {
  return {
    dia_semana: diaSemana,
    abertura:   '09:00',
    fechamento: diaSemana === 6 ? '14:00' : '18:00',
    ativo:      diaSemana !== 0,
  }
}

export function gerarDias(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
}

export function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth()    === db.getMonth()    &&
         da.getDate()     === db.getDate()
}

export function formatHora(date) {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatDuracao(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${m}` : `${h}h`
}

export function lucroDaVenda(v) {
  return (Number(v.valor_total) || 0) - (Number(v.custo_total) || 0)
}

export function brl(v) {
  const n = Number(v || 0)
  const redondo = Math.round(n * 100) % 100 === 0
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: redondo ? 0 : 2,
    maximumFractionDigits: redondo ? 0 : 2,
  })
}

export function chaveDia(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const DURACOES_PAUSA = [
  { minutos: 30,  label: '30 min' },
  { minutos: 45,  label: '45 min' },
  { minutos: 60,  label: '1h' },
  { minutos: 90,  label: '1h30' },
  { minutos: 120, label: '2h' },
]

export function somarMinutos(hhmm, minutos) {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + minutos
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function rotuloDuracaoPausa(minutos) {
  return DURACOES_PAUSA.find(d => d.minutos === minutos)?.label ?? `${minutos} min`
}

export const FUSO_BARBEARIA = 'America/Sao_Paulo'

const relogioBarbearia = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_BARBEARIA, hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
})

function partesNaBarbearia(instante) {
  const p = {}
  for (const { type, value } of relogioBarbearia.formatToParts(instante)) p[type] = Number(value)
  return p
}

export function diaNaBarbearia(instante = new Date()) {
  const p = partesNaBarbearia(new Date(instante))
  return new Date(p.year, p.month - 1, p.day)
}

export function instanteNaBarbearia(dia, hhmm) {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  const alvo = Date.UTC(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m)
  let t = alvo
  for (let i = 0; i < 2; i++) {
    const p = partesNaBarbearia(new Date(t))
    t += alvo - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  }
  return new Date(t)
}

export function horaNaBarbearia(instante) {
  return partesNaBarbearia(new Date(instante)).hour
}

export function formatHoraBarbearia(instante) {
  return new Date(instante).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_BARBEARIA })
}

export function formatDataBarbearia(instante, opcoes) {
  return new Date(instante).toLocaleDateString('pt-BR', { ...opcoes, timeZone: FUSO_BARBEARIA })
}

export const MESES_LIMITE_AGENDAMENTO = 3

export function ultimoDiaAgendavelData() {
  const hoje = diaNaBarbearia()
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + MESES_LIMITE_AGENDAMENTO, 1)
  const diasNoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(hoje.getDate(), diasNoMes))
  return d
}

export function ultimoDiaAgendavel() {
  return chaveDia(ultimoDiaAgendavelData())
}

export function primeiroDiaAgendavel() {
  return chaveDia(diaNaBarbearia())
}

export const TETO_PRECO = 99999.99

const EXATO_ATE     = 1e6
const ABSURDO_ACIMA = 1e12

export function brlCompacto(v) {
  const n = Number(v || 0)
  const abs = Math.abs(n)
  if (abs >= ABSURDO_ACIMA) return `${n < 0 ? '-' : ''}R$ 1 tri+`
  if (abs < EXATO_ATE) return brl(n)
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

export const MSG_TETO_PRECO = 'Preço muito alto. O limite é R$ 99.999,99.'

const DIGITOS_INTEIROS = String(Math.trunc(TETO_PRECO)).length

export function filtrarPreco(texto) {
  const limpo = String(texto ?? '').replace(/[^\d.,]/g, '')
  const corte = limpo.search(/[.,]/)
  if (corte === -1) return limpo.slice(0, DIGITOS_INTEIROS)
  return limpo.slice(0, corte).slice(0, DIGITOS_INTEIROS)
    + limpo[corte]
    + limpo.slice(corte + 1).replace(/[.,]/g, '').slice(0, 2)
}
