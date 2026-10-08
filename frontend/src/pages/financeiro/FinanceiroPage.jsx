import { useEffect, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import { SkeletonCard } from '../../components/ui/Skeleton'
import StatCard, { MiniStat } from '../../components/ui/StatCard'
import PageHeader from '../../components/ui/PageHeader'
import { brlCompacto } from '../../lib/agenda'
import { DollarSign, Calendar, TrendingUp, ChevronLeft, ChevronRight, Star } from 'lucide-react'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function nomeMes(year, month) {
  return new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function inicioMes(year, month) {
  const d = new Date(year, month, 1); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function inicioMesSeguinte(year, month) {
  const d = new Date(year, month + 1, 1); d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const COLUNAS_MES = { gridTemplateColumns: '5rem 4.5rem minmax(0,1fr) minmax(0,1fr) 6.5rem' }

export default function FinanceiroPage() {
  const { salon } = useAuth()

  const [loadingHoje, setLoadingHoje] = useState(true)
  const [atendimentosHoje, setAtendimentosHoje] = useState([])
  const [receitaMesAtual, setReceitaMesAtual] = useState(0)
  const [previstoMesAtual, setPrevistoMesAtual] = useState(0)

  const agora = new Date()
  const [mesSel, setMesSel] = useState({ year: agora.getFullYear(), month: agora.getMonth() })
  const [dadosMes, setDadosMes] = useState({ chave: null, lista: [] })
  const chaveMes = `${salon?.id ?? ""}:${mesSel.year}-${mesSel.month}`
  const loadingMes = !salon?.id || dadosMes.chave !== chaveMes
  const atendimentosMes = dadosMes.lista

  const [loadingKpis, setLoadingKpis] = useState(true)
  const [kpis, setKpis] = useState(null)

  useEffect(() => {
    if (!salon?.id) return
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)
    const fimDia = new Date(inicioDia); fimDia.setDate(fimDia.getDate() + 1)
    const ano = inicioDia.getFullYear()
    const mes = inicioDia.getMonth()

    Promise.all([
      supabase
        .from('agendamentos')
        .select('*, clientes(nome)')
        .eq('salon_id', salon.id)
        .eq('status', 'confirmado')
        .gte('data_hora', inicioDia.toISOString())
        .lt('data_hora', fimDia.toISOString())
        .order('data_hora'),
      supabase
        .from('agendamentos')
        .select('valor, data_hora, status')
        .eq('salon_id', salon.id)
        .eq('status', 'confirmado')
        .gte('data_hora', inicioMes(ano, mes))
        .lt('data_hora', inicioMesSeguinte(ano, mes)),
    ]).then(([resHoje, resMes]) => {
      setAtendimentosHoje(resHoje.data || [])
      const agoraTs = new Date()
      const doMes = resMes.data || []
      setReceitaMesAtual(doMes.reduce((s, a) => s + Number(a.valor || 0), 0))
      setPrevistoMesAtual(
        doMes.filter(a => new Date(a.data_hora) > agoraTs)
             .reduce((s, a) => s + Number(a.valor || 0), 0)
      )
      setLoadingHoje(false)
    })
  }, [salon?.id])

  useEffect(() => {
    const salonId = salon?.id
    if (!salonId) return
    const { year, month } = mesSel
    let cancelado = false

    supabase
      .from('agendamentos')
      .select('*, clientes(nome)')
      .eq('salon_id', salonId)
      .eq('status', 'confirmado')
      .gte('data_hora', inicioMes(year, month))
      .lt('data_hora', inicioMesSeguinte(year, month))
      .order('data_hora', { ascending: false })
      .then(({ data }) => {
        if (!cancelado) setDadosMes({ chave: `${salonId}:${year}-${month}`, lista: data || [] })
      })

    return () => { cancelado = true }
  }, [salon?.id, mesSel])

  useEffect(() => {
    if (!salon?.id) return
    const desde90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    supabase
      .from('agendamentos')
      .select('servico, valor, data_hora')
      .eq('salon_id', salon.id)
      .eq('status', 'confirmado')
      .gte('data_hora', desde90)
      .lte('data_hora', new Date().toISOString())
      .then(({ data }) => {
        const ags = data || []

        const receitaPorDia = Array(7).fill(0)
        ags.forEach(a => { receitaPorDia[new Date(a.data_hora).getDay()] += (a.valor || 0) })
        const maxReceita = Math.max(...receitaPorDia)
        const melhorDia = maxReceita > 0 ? DIAS_SEMANA[receitaPorDia.indexOf(maxReceita)] : '—'

        const contagem = {}
        ags.forEach(a => { if (a.servico) contagem[a.servico] = (contagem[a.servico] || 0) + 1 })
        const servicoTop = Object.keys(contagem).length
          ? Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0]
          : '—'

        const receita90 = ags.reduce((s, a) => s + (a.valor || 0), 0)
        const receita30 = ags
          .filter(a => a.data_hora >= desde30)
          .reduce((s, a) => s + (a.valor || 0), 0)

        setKpis({ melhorDia, servicoTop, receita30, receita90 })
        setLoadingKpis(false)
      })
  }, [salon?.id])

  const agoraTs = new Date()
  const confirmadosHoje = atendimentosHoje.filter(a => a.status === 'confirmado')
  const realizadosHoje = confirmadosHoje.filter(a => new Date(a.data_hora) <= agoraTs)
  const receitaHoje = realizadosHoje.reduce((s, a) => s + Number(a.valor || 0), 0)
  const previstoHoje = confirmadosHoje
    .filter(a => new Date(a.data_hora) > agoraTs)
    .reduce((s, a) => s + Number(a.valor || 0), 0)
  const qtdHoje = realizadosHoje.length
  const ticketHoje = qtdHoje > 0 ? receitaHoje / qtdHoje : 0

  const agoraMes = new Date()
  const confirmadosMes = atendimentosMes.filter(a => a.status === 'confirmado')
  const receitaMesSel = confirmadosMes.reduce((s, a) => s + Number(a.valor || 0), 0)
  const previstoMesSel = confirmadosMes
    .filter(a => new Date(a.data_hora) > agoraMes)
    .reduce((s, a) => s + Number(a.valor || 0), 0)
  const qtdMesSel = confirmadosMes.length
  const ticketMesSel = qtdMesSel > 0 ? receitaMesSel / qtdMesSel : 0

  function prevMes() {
    setMesSel(prev => {
      const d = new Date(prev.year, prev.month - 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function nextMes() {
    setMesSel(prev => {
      const d = new Date(prev.year, prev.month + 1, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  if (loadingHoje) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 space-y-5">

      <PageHeader
        title="Financeiro"
        subtitle={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Receita do dia"    value={brlCompacto(receitaHoje)}
          sub={previstoHoje > 0 ? `+ ${brlCompacto(previstoHoje)} previsto` : 'atendimentos hoje'} />
        <StatCard icon={Calendar}   label="Agendamentos hoje" value={qtdHoje}                    sub="já realizados" />
        <StatCard icon={TrendingUp} label="Ticket médio"      value={brlCompacto(ticketHoje)}      sub="por atendimento" />
        <StatCard icon={DollarSign} label="Total do mês"      value={brlCompacto(receitaMesAtual)}
          sub={previstoMesAtual > 0
            ? `inclui ${brlCompacto(previstoMesAtual)} a realizar`
            : nomeMes(agora.getFullYear(), agora.getMonth())} />
      </div>

      <div className="card">
        <h2 className="font-display text-base font-semibold mb-4 flex items-center gap-2 text-cal">
          <Calendar size={17} className="text-cal-3" />
          Atendimentos de hoje
        </h2>
        {atendimentosHoje.length === 0 ? (
          <p className="text-sm py-4 text-center text-cal-3">Nenhum atendimento hoje</p>
        ) : (
          <div>
            {atendimentosHoje.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-3 hover:bg-elevado rounded-controle px-2 -mx-2 transition-colors">
                <span className="text-sm num font-semibold w-12 flex-shrink-0 text-cal">
                  {formatHora(a.data_hora)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-cal">{a.clientes?.nome || '—'}</p>
                  <p className="text-xs truncate text-cal-3">{a.servico || '—'}</p>
                </div>
                <span className="text-sm font-semibold num whitespace-nowrap text-cal">
                  {a.valor ? brlCompacto(a.valor) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-base font-semibold text-cal">Visão mensal</h2>
          <div className="flex items-center gap-1">
            <button onClick={prevMes} className="btn-secondary px-2">
              <ChevronLeft size={15} />
            </button>
            <span
              className="text-apoio font-semibold px-3 capitalize text-cal-2 min-w-[130px] text-center"
            >
              {nomeMes(mesSel.year, mesSel.month)}
            </span>
            <button onClick={nextMes} className="btn-secondary px-2">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {loadingMes ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniStat label="Total do mês" value={brlCompacto(receitaMesSel)}
                sub={previstoMesSel > 0 ? `inclui ${brlCompacto(previstoMesSel)} a realizar` : null} />
              <MiniStat label="Atendimentos" value={qtdMesSel} />
              <MiniStat label="Ticket médio" value={brlCompacto(ticketMesSel)} />
            </div>

            {atendimentosMes.length === 0 ? (
              <p className="text-sm py-3 text-center text-cal-3">
                Nenhum atendimento em {nomeMes(mesSel.year, mesSel.month)}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[35rem]">
                <div
                  className="grid gap-2 pb-2 border-b border-junta-forte"
                  style={COLUNAS_MES}
                >
                  {['Data', 'Hora', 'Cliente', 'Serviço', 'Valor'].map(h => (
                    <span
                      key={h}
                      className="text-micro font-semibold last:text-right text-cal-2"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                <div className="max-h-72 overflow-y-auto pr-1">
                  {atendimentosMes.map(a => {
                    const futuro = new Date(a.data_hora) > agoraMes
                    return (
                      <div
                        key={a.id}
                        className="grid gap-2 py-2.5 hover:bg-elevado rounded-controle px-1 -mx-1 transition-colors items-center"
                        style={COLUNAS_MES}
                      >
                        <p className="text-xs num text-cal-2">{formatData(a.data_hora)}</p>
                        <p className="text-xs num text-cal-3">{formatHora(a.data_hora)}</p>
                        <p className="text-sm truncate text-cal">{a.clientes?.nome || '—'}</p>
                        <p className="text-xs truncate text-cal-3">{a.servico || '—'}</p>
                        <div className="text-right">
                          <p className="text-sm font-semibold num text-cal">
                            {a.valor ? brlCompacto(a.valor) : '—'}
                          </p>
                          {futuro && (
                            <p className="text-xs text-cal-3">previsto</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-display text-base font-semibold flex items-center gap-2 text-cal">
          <Star size={17} className="text-cal-3" />
          Indicadores gerais
        </h2>

        {loadingKpis ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Melhor dia da semana',   value: kpis.melhorDia,           sub: 'últimos 90 dias' },
              { label: 'Serviço mais realizado', value: kpis.servicoTop,          sub: 'últimos 90 dias' },
              { label: 'Receita 30 dias',        value: brlCompacto(kpis.receita30), sub: 'últimos 30 dias' },
              { label: 'Receita 90 dias',        value: brlCompacto(kpis.receita90), sub: 'últimos 90 dias' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-superficie p-4 bg-elevado min-w-0">
                <p className="text-xs font-medium mb-1 text-cal-3">{label}</p>
                <p className="font-display text-base font-semibold text-cal [overflow-wrap:anywhere]">{value}</p>
                <p className="text-xs mt-0.5 text-cal-3">{sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
