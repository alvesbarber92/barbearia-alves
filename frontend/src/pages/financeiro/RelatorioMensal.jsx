import { useEffect, useMemo, useState } from 'react'
import { Printer, X } from 'lucide-react'
import CamadaModal from '../../components/ui/CamadaModal'
import { supabase } from '../../lib/supabase'
import { brl } from '../../lib/agenda'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const qtd = n => String(n)

const comMaiuscula = s => s.charAt(0).toUpperCase() + s.slice(1)

function listarDias(indices) {
  const nomes = indices.map(i => DIAS_SEMANA[i].toLowerCase())
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0]
}

function nomeDoMes(year, month) {
  return new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

function resumir({ atend, debitos }) {
  const receitaAtend = atend.reduce((s, a) => s + Number(a.valor || 0), 0)
  const recebidoDebitos = debitos.reduce((s, d) => s + Number(d.valor || 0), 0)
  const atendimentos = atend.length
  return {
    faturamento: receitaAtend + recebidoDebitos,
    recebidoDebitos,
    atendimentos,
    media: atendimentos ? receitaAtend / atendimentos : 0,
  }
}

function Comparacao({ atual, anterior, formatar, nomeAnterior }) {
  const diff = atual - anterior
  const pct = anterior > 0 ? Math.round((Math.abs(diff) / anterior) * 100) : null
  const igual = Math.abs(diff) < 0.005
  const subiu = diff > 0
  return (
    <>
      <p className={`text-xs mt-1.5 tabular-nums ${igual ? 'text-[#6b6660]' : subiu ? 'text-[#2f6b3a]' : 'text-[#a3412b]'}`}>
        {igual
          ? `igual a ${nomeAnterior}`
          : `${subiu ? '▲' : '▼'} ${formatar(Math.abs(diff))} a ${subiu ? 'mais' : 'menos'}${pct !== null ? ` (${subiu ? '+' : '−'}${pct}%)` : ''}`}
      </p>
      <p className="text-xs text-[#6b6660] tabular-nums">{nomeAnterior}: {formatar(anterior)}</p>
    </>
  )
}

function Indicador({ label, valor, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6875rem] font-semibold tracking-[0.08em] uppercase text-[#6b6660]">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums [overflow-wrap:anywhere]">{valor}</p>
      {children}
    </div>
  )
}

function Secao({ titulo, children }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="text-[0.8125rem] font-bold tracking-[0.04em] uppercase mb-3">{titulo}</h3>
      {children}
    </section>
  )
}

export default function RelatorioMensal({ salonId, salonNome, year, month, onClose }) {
  const [tentativa, setTentativa] = useState(0)
  const [dados, setDados] = useState(null)

  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    let cancelado = false
    const inicioAnterior = new Date(year, month - 1, 1)
    const inicio = new Date(year, month, 1)
    const fim = new Date(year, month + 1, 1)
    const agora = new Date()

    Promise.all([
      supabase
        .from('agendamentos')
        .select('servico, valor, data_hora')
        .eq('salon_id', salonId)
        .eq('status', 'confirmado')
        .gte('data_hora', inicioAnterior.toISOString())
        .lt('data_hora', fim.toISOString())
        .lte('data_hora', agora.toISOString()),
      supabase
        .from('debitos')
        .select('valor, pago_em')
        .eq('salon_id', salonId)
        .gte('pago_em', inicioAnterior.toISOString())
        .lt('pago_em', fim.toISOString()),
    ]).then(([resAg, resDeb]) => {
      if (cancelado) return
      if (resAg.error || resDeb.error) { setDados({ erro: true }); return }
      const entre = (lista, campo, de, ate) => lista.filter(x => {
        const d = new Date(x[campo])
        return d >= de && d < ate
      })
      setDados({
        atual: {
          atend: entre(resAg.data || [], 'data_hora', inicio, fim),
          debitos: entre(resDeb.data || [], 'pago_em', inicio, fim),
        },
        anterior: {
          atend: entre(resAg.data || [], 'data_hora', inicioAnterior, inicio),
          debitos: entre(resDeb.data || [], 'pago_em', inicioAnterior, inicio),
        },
        emitidoEm: agora,
      })
    })

    return () => { cancelado = true }
  }, [salonId, year, month, tentativa])

  const relatorio = useMemo(() => {
    if (!dados || dados.erro) return null
    const atual = resumir(dados.atual)
    const anterior = resumir(dados.anterior)

    const porDia = Array(7).fill(0)
    dados.atual.atend.forEach(a => { porDia[new Date(a.data_hora).getDay()] += Number(a.valor || 0) })
    const maxDia = Math.max(...porDia)

    const servicos = {}
    dados.atual.atend.forEach(a => {
      const nome = a.servico || 'Sem serviço'
      servicos[nome] ??= { nome, vezes: 0, rendeu: 0 }
      servicos[nome].vezes += 1
      servicos[nome].rendeu += Number(a.valor || 0)
    })

    return {
      atual,
      anterior,
      porDia,
      maxDia,
      melhoresDias: maxDia > 0 ? porDia.flatMap((v, i) => (v === maxDia ? [i] : [])) : [],
      servicos: Object.values(servicos).sort((a, b) => b.vezes - a.vezes || b.rendeu - a.rendeu),
    }
  }, [dados])

  const mes = nomeDoMes(year, month)
  const mesAnterior = nomeDoMes(year, month - 1)
  const mesAno = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const vazio = relatorio && relatorio.atual.atendimentos === 0 && relatorio.atual.recebidoDebitos === 0

  function imprimir() {
    const tituloAntes = document.title
    document.title = `Relatório ${mesAno} - ${salonNome}`
    window.addEventListener('afterprint', () => { document.title = tituloAntes }, { once: true })
    window.print()
  }

  function frase() {
    const { atual, anterior } = relatorio
    const diff = atual.faturamento - anterior.faturamento
    let comparacao = ''
    if (anterior.faturamento > 0) {
      comparacao = Math.abs(diff) < 0.005
        ? ` Ficou igual a ${mesAnterior}.`
        : ` Foi ${brl(Math.abs(diff))} a ${diff > 0 ? 'mais' : 'menos'} que em ${mesAnterior}.`
    }
    return (
      <>
        Em <b>{mes}</b> a barbearia fez{' '}
        <b>{atual.atendimentos} {atual.atendimentos === 1 ? 'atendimento' : 'atendimentos'}</b>{' '}
        e faturou <b>{brl(atual.faturamento)}</b>.{comparacao}
      </>
    )
  }

  return (
    <CamadaModal onFundo={onClose} className="impressao">
      <div
        className="impressao-folha w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-superficie bg-white text-[#1b1a18] shadow-flutua [color-scheme:light]"
        role="dialog" aria-modal="true" aria-label={`Relatório de ${mesAno}`}
      >
        <div className="nao-imprimir sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-[#f1efeb] border-b border-[#dedad3]">
          <button
            onClick={imprimir}
            disabled={!relatorio}
            className="inline-flex items-center gap-2 rounded-controle bg-[#1b1a18] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            <Printer size={16} />
            Imprimir ou salvar em PDF
          </button>
          <button onClick={onClose} aria-label="Fechar"
            className="p-1.5 rounded-controle text-[#6b6660] transition-colors hover:bg-[#e4e0d9] hover:text-[#1b1a18]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 sm:px-8 py-7 space-y-7">
          <header className="pb-4 border-b-2 border-[#1b1a18]">
            <p className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase text-[#6b6660]">Relatório mensal</p>
            <h2 className="text-2xl font-bold uppercase mt-1 [overflow-wrap:anywhere]">{salonNome}</h2>
            <p className="text-sm text-[#6b6660] mt-1">{comMaiuscula(mesAno)}</p>
          </header>

          {!dados ? (
            <p className="text-sm text-[#6b6660] py-8 text-center">Carregando relatório…</p>
          ) : dados.erro ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-[#6b6660]">Não deu para carregar o relatório.</p>
              <button
                onClick={() => { setDados(null); setTentativa(t => t + 1) }}
                className="rounded-controle border border-[#cfcac2] px-4 py-2 text-sm font-semibold hover:bg-[#f1efeb]"
              >
                Tentar de novo
              </button>
            </div>
          ) : vazio ? (
            <p className="text-sm text-[#6b6660] py-8 text-center">
              Nenhum atendimento realizado em {mesAno}.
            </p>
          ) : (
            <>
              <p className="text-base leading-relaxed">{frase()}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Indicador label="Faturamento" valor={brl(relatorio.atual.faturamento)}>
                  <Comparacao atual={relatorio.atual.faturamento} anterior={relatorio.anterior.faturamento}
                    formatar={brl} nomeAnterior={mesAnterior} />
                  {relatorio.atual.recebidoDebitos > 0 && (
                    <p className="text-xs text-[#6b6660] tabular-nums">
                      inclui {brl(relatorio.atual.recebidoDebitos)} de débitos recebidos
                    </p>
                  )}
                </Indicador>
                <Indicador label="Atendimentos" valor={relatorio.atual.atendimentos}>
                  <Comparacao atual={relatorio.atual.atendimentos} anterior={relatorio.anterior.atendimentos}
                    formatar={qtd} nomeAnterior={mesAnterior} />
                </Indicador>
                <Indicador label="Média por atendimento" valor={brl(relatorio.atual.media)}>
                  <Comparacao atual={relatorio.atual.media} anterior={relatorio.anterior.media}
                    formatar={brl} nomeAnterior={mesAnterior} />
                </Indicador>
              </div>

              {relatorio.atual.atendimentos > 0 && (
                <>
                  <Secao titulo="Movimento por dia da semana">
                    <div className="space-y-2">
                      {DIAS_SEMANA.map((dia, i) => (
                        <div key={dia} className="grid grid-cols-[5rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                          <span className="text-sm text-[#4a4640]">{dia}</span>
                          <div className="h-2.5 rounded-full bg-[#ebe8e3] overflow-hidden">
                            <div className="h-full rounded-full bg-[#1b1a18]"
                              style={{ width: `${relatorio.maxDia > 0 ? (relatorio.porDia[i] / relatorio.maxDia) * 100 : 0}%` }} />
                          </div>
                          <span className="text-sm text-right tabular-nums">
                            {relatorio.porDia[i] > 0 ? brl(relatorio.porDia[i]) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {relatorio.melhoresDias.length > 0 && (
                      <p className="text-xs text-[#6b6660] mt-3">
                        {relatorio.melhoresDias.length > 1 ? 'Dias mais fortes' : 'Dia mais forte'}:{' '}
                        {listarDias(relatorio.melhoresDias)}, com {brl(relatorio.maxDia)} somados no mês
                        {relatorio.melhoresDias.length > 1 ? ' cada' : ''}.
                      </p>
                    )}
                  </Secao>

                  <Secao titulo="Serviços mais feitos">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[#4a4640] border-b border-[#cfcac2]">
                          <th className="text-left font-semibold py-2">Serviço</th>
                          <th className="text-right font-semibold py-2 w-16">Vezes</th>
                          <th className="text-right font-semibold py-2 w-28">Rendeu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorio.servicos.map(s => (
                          <tr key={s.nome} className="border-b border-[#e4e0d9] break-inside-avoid">
                            <td className="py-2 pr-3 [overflow-wrap:anywhere]">{s.nome}</td>
                            <td className="py-2 text-right tabular-nums">{s.vezes}</td>
                            <td className="py-2 text-right font-semibold tabular-nums">{brl(s.rendeu)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Secao>
                </>
              )}
            </>
          )}

          {relatorio && (
            <footer className="pt-4 border-t border-[#dedad3] text-xs text-[#6b6660] leading-relaxed">
              Emitido em {dados.emitidoEm.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
              {' '}Conta só os atendimentos confirmados que já aconteceram. Horário marcado para os próximos dias ainda não entra.
            </footer>
          )}
        </div>
      </div>
    </CamadaModal>
  )
}
