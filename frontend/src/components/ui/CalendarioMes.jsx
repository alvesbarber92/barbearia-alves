import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { chaveDia } from '../../lib/agenda'

const DIAS_CABECALHO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function semanasDo(ano, mes) {
  const primeiro = new Date(ano, mes, 1)
  const inicio = new Date(primeiro)
  inicio.setDate(inicio.getDate() - primeiro.getDay())

  const semanas = []
  const cursor = new Date(inicio)
  while (semanas.length < 6) {
    const semana = []
    for (let i = 0; i < 7; i++) {
      semana.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    semanas.push(semana)
    if (cursor.getMonth() !== mes && cursor > new Date(ano, mes + 1, 0)) break
  }
  return semanas
}

export default function CalendarioMes({
  ano, mes, diaAtivo, selecionados, contagens = {}, estados = {}, de, ate, onSelecionar, onTrocarMes,
  className = 'lg:w-[17.5rem] lg:flex-shrink-0',
}) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const chaveAtivo = diaAtivo ? chaveDia(diaAtivo) : null
  const marcados = useMemo(() => new Set(selecionados ?? []), [selecionados])
  const chaveHoje = chaveDia(hoje)

  const semAnterior = !!de && chaveDia(new Date(ano, mes, 0)) < de
  const semProximo  = !!ate && chaveDia(new Date(ano, mes + 1, 1)) > ate
  const setaCls = (travada) => `p-1.5 rounded-controle transition-colors ${
    travada ? 'text-cal-3 cursor-not-allowed' : 'text-cal-2 hover:bg-elevado hover:text-cal'
  }`

  return (
    <div className={`card p-4 w-full ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          onClick={() => onTrocarMes(-1)}
          disabled={semAnterior}
          aria-label="Mês anterior"
          className={setaCls(semAnterior)}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-apoio font-semibold capitalize">{MESES[mes]} {ano}</span>
        <button
          onClick={() => onTrocarMes(1)}
          disabled={semProximo}
          aria-label="Próximo mês"
          className={setaCls(semProximo)}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DIAS_CABECALHO.map(d => (
          <span key={d} className="text-micro text-cal-3 text-center py-1">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {semanasDo(ano, mes).flat().map(d => {
          const chave = chaveDia(d)
          const doMes = d.getMonth() === mes
          const qtd = contagens[chave] || 0
          const selecionado = chave === chaveAtivo || marcados.has(chave)
          const ehHoje = chave === chaveHoje
          const estado = estados[chave]
          const rotuloEstado = estado === 'fechado' ? ', fechado' : estado === 'especial' ? ', horário especial' : ''
          const fora = (de && chave < de) || (ate && chave > ate)

          return (
            <button
              key={chave}
              onClick={() => onSelecionar(d)}
              disabled={fora}
              aria-pressed={selecionado}
              aria-label={`${d.getDate()} de ${MESES[d.getMonth()]}${rotuloEstado}${
                marcados.has(chave) ? ', selecionado' : ''
              }${
                fora ? ', indisponível' : qtd ? `, ${qtd} agendamento${qtd > 1 ? 's' : ''}` : ', sem agendamento'
              }`}
              className={`marca relative rounded-controle py-1.5 num text-apoio transition-colors ${
                estado === 'fechado' ? 'line-through' : ''
              } ${
                fora ? 'text-cal-3 cursor-not-allowed'
                  : selecionado ? 'text-cal font-semibold'
                  : estado === 'especial' ? 'text-warn hover:bg-elevado'
                  : doMes && estado !== 'fechado' ? 'text-cal-2 hover:bg-elevado hover:text-cal'
                  : 'text-cal-3 hover:bg-elevado hover:text-cal-2'
              }`}
            >
              {ehHoje && !selecionado && (
                <span className="absolute left-1/2 -translate-x-1/2 bottom-1 h-px w-4 bg-latao" aria-hidden />
              )}
              {d.getDate()}
              {qtd > 0 && (
                <span
                  className={`absolute left-1/2 -translate-x-1/2 top-0.5 w-1 h-1 rounded-full ${
                    doMes ? 'bg-cal-2' : 'bg-cal-3'
                  }`}
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
