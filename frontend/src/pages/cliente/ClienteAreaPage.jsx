import { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import StatusBadge from '../../components/ui/StatusBadge'
import DataRail from '../../components/ui/DataRail'
import Monogram from '../../components/ui/Monogram'
import { brlCompacto } from '../../lib/agenda'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { Calendar, ClipboardList, LogOut, ArrowLeft } from 'lucide-react'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatHora(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function ClienteAreaPage() {
  const navigate = useNavigate()
  const [session,      setSession]      = useState(null)
  const [agendamentos, setAgendamentos] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [tela,         setTela]         = useState('home')
  const [semSessao,    setSemSessao]    = useState(false)
  const confirmacao = useConfirmacao()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!s) { setSemSessao(true); return }
      setSession(s)

      const { data } = await supabase.rpc('meus_agendamentos')

      setAgendamentos(data || [])
      setLoading(false)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const confirmarCancelar = async (id) => {
    confirmacao.desarmar()
    const { error } = await supabase.rpc('cancelar_meu_agendamento', { p_agendamento_id: id })
    if (error) { toast.error('Erro ao cancelar'); return }
    setAgendamentos(p => p.map(a => a.id === id ? { ...a, status: 'cancelado' } : a))
  }

  const now = new Date()
  const proximos  = agendamentos.filter(a =>
    new Date(a.data_hora) >= now && ['pendente', 'confirmado'].includes(a.status)
  )
  const historico = agendamentos.filter(a =>
    new Date(a.data_hora) < now || ['concluido', 'cancelado'].includes(a.status)
  )

  const nome      = session?.user?.user_metadata?.nome || 'Cliente'
  const salonSlug = agendamentos.length > 0
    ? agendamentos[0].salao_slug
    : localStorage.getItem('ultimo_salon_slug')

  if (semSessao) return <Navigate to="/login" replace />

  if (loading) {
    return (
      <div className="min-h-screen bg-concreto flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-acento-marca border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-concreto">

      <header className="bg-bancada border-b border-junta px-5 py-3.5 pt-[calc(0.875rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monogram nome={nome} />
          <span className="font-display text-card">Minha conta</span>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-1.5 text-apoio rounded-controle px-3 py-1.5 transition-colors text-cal-2 hover:bg-elevado hover:text-cal">
          <LogOut size={15} />
          Sair
        </button>
      </header>

      {tela === 'home' && (
        <main className="max-w-lg mx-auto p-5 space-y-6">
          <div>
            <h1 className="font-display text-tela">
              Olá, {nome.split(' ')[0]}
            </h1>
            <p className="text-apoio text-cal-2 mt-1">O que você quer fazer?</p>
          </div>
          <div className="space-y-3">
            {salonSlug ? (
              <button onClick={() => navigate(`/${salonSlug}/agendar`)}
                className="card w-full text-left flex items-center gap-4 p-5 transition-colors hover:bg-elevado hover:border-latao">
                <div className="w-11 h-11 rounded-chapa bg-acento/15 flex items-center justify-center flex-shrink-0">
                  <Calendar size={20} className="text-acento-texto" />
                </div>
                <div>
                  <p className="font-display text-card">Marcar horário</p>
                  <p className="text-apoio text-cal-2 mt-0.5">Agende um novo serviço</p>
                </div>
                <span className="ml-auto text-card text-cal-2" aria-hidden>›</span>
              </button>
            ) : (
              <div className="card flex items-start gap-4 p-5">
                <div className="w-11 h-11 rounded-chapa bg-elevado flex items-center justify-center flex-shrink-0">
                  <Calendar size={20} className="text-cal-2" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-card">Marcar horário</p>
                  <p className="text-apoio text-cal-2 mt-0.5">
                    Abra o link que a barbearia te enviou para marcar o primeiro
                    horário. Depois disso ela fica salva aqui.
                  </p>
                </div>
              </div>
            )}

            <button onClick={() => setTela('agendamentos')}
              className="card w-full text-left flex items-center gap-4 p-5 transition-colors hover:bg-elevado hover:border-latao">
              <div className="w-11 h-11 rounded-chapa bg-acento/15 flex items-center justify-center flex-shrink-0">
                <ClipboardList size={20} className="text-acento-texto" />
              </div>
              <div>
                <p className="font-display text-card">Meus agendamentos</p>
                <p className="text-apoio text-cal-2 mt-0.5">
                  {proximos.length > 0
                    ? `${proximos.length} horário${proximos.length > 1 ? 's' : ''} marcado${proximos.length > 1 ? 's' : ''}`
                    : 'Ver histórico'}
                </p>
              </div>
              <span className="ml-auto text-card text-cal-2" aria-hidden>›</span>
            </button>
          </div>
        </main>
      )}

      {tela === 'agendamentos' && (
        <main className="max-w-lg mx-auto p-5 space-y-5">
          <button onClick={() => setTela('home')}
            className="flex items-center gap-1.5 text-apoio rounded-controle px-2 py-1 -ml-2 transition-colors text-cal-2 hover:bg-elevado hover:text-cal">
            <ArrowLeft size={15} /> Início
          </button>

          {agendamentos.length === 0 ? (
            <div className="card text-center py-10 space-y-4">
              <div className="w-12 h-12 rounded-chapa bg-elevado mx-auto flex items-center justify-center">
                <Calendar size={22} className="text-cal-2" />
              </div>
              <div>
                <p className="font-display text-card">Nenhum agendamento ainda</p>
                <p className="text-apoio text-cal-2 mt-1">
                  {salonSlug
                    ? 'Seu primeiro horário está a três toques daqui.'
                    : 'Abra o link que a barbearia te enviou para marcar o primeiro horário.'}
                </p>
              </div>
              {salonSlug && (
                <button className="btn-primary px-6" onClick={() => navigate(`/${salonSlug}/agendar`)}>
                  Marcar horário
                </button>
              )}
            </div>
          ) : (
            <>
              {proximos.length > 0 && (
                <div className="card">
                  <h2 className="regua mb-2">Próximos</h2>
                  {proximos.map(a => (
                    <div key={a.id} className="flex items-center gap-3 py-3 border-b last:border-b-0 border-junta">
                      <DataRail iso={a.data_hora} />
                      <div className="flex-1 min-w-0">
                        <p className="text-corpo font-semibold truncate">{a.servico}</p>
                        <p className="num text-micro text-cal-2 mt-0.5">
                          {DIAS_SEMANA[new Date(a.data_hora).getDay()]} · {formatHora(a.data_hora)}
                          {a.valor ? ` · ${brlCompacto(a.valor)}` : ''}
                        </p>
                        {a.salao_nome && (
                          <p className="text-micro text-cal-2 mt-0.5 truncate">{a.salao_nome}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <StatusBadge status={a.status} />
                        {confirmacao.armado === a.id ? (
                          <button onClick={() => confirmarCancelar(a.id)}
                            className="text-micro font-semibold px-2.5 py-1 rounded-controle bg-danger-solido text-cal">
                            Confirmar cancelamento
                          </button>
                        ) : (
                          <button onClick={() => confirmacao.armar(a.id)}
                            className="text-micro font-semibold px-2.5 py-1 rounded-controle border border-junta-forte text-cal-2 transition-colors hover:border-latao hover:text-cal">
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {historico.length > 0 && (
                <div className="card">
                  <h2 className="regua mb-2">Histórico</h2>
                  {historico.map(a => (
                    <div key={a.id} className="flex items-center gap-3 py-3 border-b last:border-b-0 border-junta">
                      <DataRail iso={a.data_hora} />
                      <div className="flex-1 min-w-0">
                        <p className="text-corpo font-semibold truncate">{a.servico}</p>
                        <p className="num text-micro text-cal-2 mt-0.5">
                          {DIAS_SEMANA[new Date(a.data_hora).getDay()]} · {formatHora(a.data_hora)}
                          {a.valor ? ` · ${brlCompacto(a.valor)}` : ''}
                        </p>
                        {a.salao_nome && (
                          <p className="text-micro text-cal-2 mt-0.5 truncate">{a.salao_nome}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      )}
    </div>
  )
}
