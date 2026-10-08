import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import { SkeletonCard } from '../../components/ui/Skeleton'
import StatusBadge from '../../components/ui/StatusBadge'
import StatCard from '../../components/ui/StatCard'
import PageHeader from '../../components/ui/PageHeader'
import { brlCompacto } from '../../lib/agenda'
import EmptyState from '../../components/ui/EmptyState'
import { Calendar, Users, Package, DollarSign, Link2, Copy, Store } from 'lucide-react'
import toast from 'react-hot-toast'

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function DashboardHome() {
  const { salon, salonCarregando, moduloLiberado, modulosCarregando } = useAuth()
  const comEstoque = moduloLiberado('estoque')
  const [stats, setStats] = useState(null)
  const [proximos, setProximos] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!salon) return
    const channel = supabase
      .channel(`dashboard-${salon.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'agendamentos',
        filter: `salon_id=eq.${salon.id}`,
      }, () => setRefreshKey(k => k + 1))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [salon])

  const semSalao = !salonCarregando && !salon

  useEffect(() => {
    if (!salon || modulosCarregando) return
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0)
    const fimDia = new Date(inicioDia); fimDia.setDate(fimDia.getDate() + 1)

    Promise.all([
      supabase.from('agendamentos')
        .select('valor, forma_pag, status, data_hora')
        .eq('salon_id', salon.id)
        .neq('status', 'cancelado')
        .gte('data_hora', inicioDia.toISOString())
        .lt('data_hora', fimDia.toISOString()),
      comEstoque
        ? supabase.from('estoque')
            .select('id, nome, quantidade, quantidade_minima')
            .eq('salon_id', salon.id)
        : Promise.resolve({ data: [] }),
      supabase.from('agendamentos')
        .select('cliente_id')
        .eq('salon_id', salon.id)
        .gte('data_hora', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('clientes').select('id', { count: 'exact' }).eq('salon_id', salon.id),
      supabase.from('agendamentos')
        .select('*, clientes(nome)')
        .eq('salon_id', salon.id)
        .neq('status', 'cancelado')
        .gte('data_hora', inicioDia.toISOString())
        .lt('data_hora', fimDia.toISOString())
        .order('data_hora'),
    ]).then(([agend, estoque, ativos, totalClientes, prox]) => {
      const hoje = agend.data || []
      const agora = new Date()
      const validos = hoje.filter(a => a.status === 'confirmado')
      const receita = validos
        .filter(a => new Date(a.data_hora) <= agora)
        .reduce((s, a) => s + Number(a.valor || 0), 0)
      const previsto = validos
        .filter(a => new Date(a.data_hora) > agora)
        .reduce((s, a) => s + Number(a.valor || 0), 0)
      const estoqueItems = estoque.data || []
      const estoqueBaixo = estoqueItems.filter(i => i.quantidade <= i.quantidade_minima)
      const clientesAtivosIds = new Set((ativos.data || []).map(a => a.cliente_id))
      const inativos = (totalClientes.count || 0) - clientesAtivosIds.size

      setStats({
        agendamentosHoje: validos.length,
        receitaHoje: receita,
        previsto,
        estoqueBaixo: estoqueBaixo.length,
        clientesInativos: Math.max(0, inativos),
      })
      setProximos(prox.data || [])
      setLoading(false)
    })
  }, [salon, refreshKey, comEstoque, modulosCarregando])

  if (semSalao) {
    return (
      <div className="p-5 md:p-8">
        <EmptyState
          icon={Store}
          title="Barbearia ainda não configurada"
          description="Termine o cadastro da sua barbearia para acompanhar os números do dia por aqui."
          action={<Link to="/onboarding" className="btn-primary">Concluir cadastro</Link>}
        />
      </div>
    )
  }

  if (loading || !stats) {
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
        title={saudacao()}
        subtitle={`${salon?.nome} — ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      <div className={`grid grid-cols-2 gap-4 ${comEstoque ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <StatCard icon={Calendar}  label="Agendamentos hoje" value={stats.agendamentosHoje} sub="clientes agendados" />
        <StatCard icon={DollarSign} label="Receita do dia"
          value={brlCompacto(stats.receitaHoje)}
          sub={stats.previsto > 0 ? `+ ${brlCompacto(stats.previsto)} previsto` : 'serviços do dia'} />
        {comEstoque && (
          <StatCard icon={Package} label="Estoque baixo" value={stats.estoqueBaixo} sub="itens abaixo do mínimo" alert={stats.estoqueBaixo > 0} />
        )}
        <StatCard icon={Users} label="Clientes inativos" value={stats.clientesInativos} sub="sem visita há 60+ dias"
          className={comEstoque ? '' : 'col-span-2 md:col-span-1'} />
      </div>

      <div className="card">
        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-cal-2">
          <Link2 size={14} />
          Link de agendamento
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={`${window.location.origin}/${salon?.slug}/agendar`}
            className="input-base text-apoio bg-elevado text-cal-2 cursor-pointer"
            onClick={e => e.target.select()}
            aria-label="Seu link de agendamento"
          />
          <button
            className="btn-secondary text-micro px-3.5 flex items-center gap-1.5 whitespace-nowrap"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/${salon?.slug}/agendar`)
              toast.success('Link copiado!')
            }}
          >
            <Copy size={13} />
            Copiar
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-base font-semibold mb-3 text-cal">
          Agendamentos de hoje
        </h2>
        {proximos.length === 0 ? (
          <div className="text-center py-6 space-y-1">
            <p className="text-sm font-medium text-cal-2">Nenhum atendimento hoje</p>
            <p className="text-xs text-cal-3">
              Compartilhe seu link de agendamento acima para receber reservas.
            </p>
          </div>
        ) : (
          <div>
            {proximos.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-3 border-b last:border-b-0 border-junta">
                <span className="text-sm font-semibold num w-12 flex-shrink-0 text-cal">
                  {new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-cal">{a.clientes?.nome || '—'}</p>
                  <p className="text-xs truncate num text-cal-3">
                    {a.servico}{a.valor ? ` · ${brlCompacto(a.valor)}` : ''}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
