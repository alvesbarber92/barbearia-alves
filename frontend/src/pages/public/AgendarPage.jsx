import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { lerSalaoGuardado, guardarSalao } from '../../lib/salaoGuardado'
import toast from 'react-hot-toast'
import { Check, Mail, LogOut, Calendar, CalendarDays, ClipboardList, ArrowLeft } from 'lucide-react'
import StatusBadge from '../../components/ui/StatusBadge'
import DataRail from '../../components/ui/DataRail'
import Monogram from '../../components/ui/Monogram'
import CalendarioMes from '../../components/ui/CalendarioMes'
import FundoFoto from '../../components/ui/FundoFoto'
import CampoSenha from '../../components/ui/CampoSenha'
import { AvisoLegal } from '../../components/AvisoLegal'
import { brlCompacto, chaveDia, horarioPadrao, ultimoDiaAgendavelData } from '../../lib/agenda'
import { useAccent } from '../../hooks/useAccent'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { mascararTelefone, telefoneValido, MSG_TELEFONE_INVALIDO, propsCampoTelefone } from '../../lib/telefone'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const PERIODOS = [
  { label: 'Manhã',        de: 0,  ate: 12 },
  { label: 'Tarde',        de: 12, ate: 16 },
  { label: 'Fim de tarde', de: 16, ate: 24 },
]

const DIAS_NA_FITA = 14

function gerarDias(n, base = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
}

function inicioDaFita(dia, hoje, ultimo) {
  const recuado = new Date(ultimo)
  recuado.setDate(recuado.getDate() - (DIAS_NA_FITA - 1))
  const inicio = new Date(Math.min(dia.getTime(), Math.max(recuado.getTime(), hoje.getTime())))
  inicio.setHours(0, 0, 0, 0)
  return inicio
}

function mesDe(d) {
  return { ano: d.getFullYear(), mes: d.getMonth() }
}

function horaParaDate(dia, hhmm) {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  const d = new Date(dia)
  d.setHours(h, m, 0, 0)
  return d
}

function gerarSlots(dia, horario) {
  const inicio = horaParaDate(dia, horario.abertura)
  const fim    = horaParaDate(dia, horario.fechamento)
  const slots = []
  for (let d = inicio; d < fim; d = new Date(d.getTime() + 30 * 60000)) slots.push(d)
  return slots
}

function formatHora(date) {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth()    === db.getMonth()    &&
         da.getDate()     === db.getDate()
}

function formatDuracao(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${m}` : `${h}h`
}

function agruparPorPeriodo(slots) {
  return PERIODOS
    .map(p => ({ label: p.label, slots: slots.filter(s => s.getHours() >= p.de && s.getHours() < p.ate) }))
    .filter(g => g.slots.length > 0)
}

function StepIndicator({ etapa }) {
  const steps  = ['servico', 'data', 'confirmar']
  const labels = ['Serviço', 'Horário', 'Confirmar']
  const cur    = steps.indexOf(etapa)
  return (
    <div className="flex items-center gap-2 text-micro" aria-label={`Etapa ${cur + 1} de 3: ${labels[cur]}`}>
      {labels.map((l, i) => (
        <Fragment key={l}>
          <span className={`inline-flex items-center gap-1 ${i === cur ? 'font-semibold text-acento-texto' : i < cur ? 'text-cal-2' : 'text-cal-3'}`}>
            {i < cur && <Check size={11} aria-hidden />}
            {l}
          </span>
          {i < labels.length - 1 && <span aria-hidden className="text-cal-3">›</span>}
        </Fragment>
      ))}
    </div>
  )
}

function FichaServico({ servico, onTrocar }) {
  return (
    <button onClick={onTrocar}
      className="w-full flex items-center justify-between rounded-superficie border border-junta bg-bancada px-4 py-3 text-left transition-colors hover:bg-elevado hover:border-latao">
      <div>
        <p className="font-display text-corpo">{servico.label}</p>
        <p className="num text-micro text-cal-2 mt-0.5">
          {formatDuracao(servico.duracao)} · {brlCompacto(servico.valor)}
        </p>
      </div>
      <span className="text-micro font-semibold text-acento-texto">trocar</span>
    </button>
  )
}

export default function AgendarPage() {
  const { slug } = useParams()
  const { state } = useLocation()

  const [session,     setSession]     = useState(undefined)
  const [authMode,    setAuthMode]    = useState('login')
  const [authForm,    setAuthForm]    = useState({ email: '', password: '', nome: '', telefone: '' })
  const [authLoading, setAuthLoading] = useState(false)

  const [tela, setTela] = useState('home')

  const [salon,        setSalon]        = useState(() =>
    state?.salon?.slug === slug ? state.salon : lerSalaoGuardado(slug))
  useAccent(salon?.cor_primaria)
  const [servicos,     setServicos]     = useState([])
  const [horarios,     setHorarios]     = useState({})
  const [especiais,    setEspeciais]    = useState({})
  const [versaoExpediente, setVersaoExpediente] = useState(0)
  const [etapa,        setEtapa]        = useState('servico')
  const [servico,      setServico]      = useState(null)
  const [diaAtivo,     setDiaAtivo]     = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [ancora,       setAncora]       = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [mesCal,       setMesCal]       = useState(() => mesDe(new Date()))
  const [calAberto,    setCalAberto]    = useState(false)
  const dias = useMemo(() => gerarDias(DIAS_NA_FITA, ancora), [ancora])
  const [slot,         setSlot]         = useState(null)
  const [ocupados,        setOcupados]        = useState({ chave: null, lista: [], erro: false })
  const [recargaOcupados, setRecargaOcupados] = useState(0)
  const [form,         setForm]         = useState({ obs: '' })
  const [salvando,     setSalvando]     = useState(false)
  const [sucesso,      setSucesso]      = useState(false)

  const [meus,        setMeus]        = useState({ chave: null, lista: [], erro: false })
  const [recargaMeus, setRecargaMeus] = useState(0)
  const confirmacao = useConfirmacao()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    supabase.rpc('salao_publico', { p_slug: slug }).maybeSingle()
      .then(({ data, error }) => {
        if (error) return
        guardarSalao(slug, data)
        if (data) {
          setSalon(data)
          localStorage.setItem('ultimo_salon_slug', slug)
        } else {
          setSalon(null)
        }
      })
  }, [slug])

  const salonId = salon?.id
  const userId  = session?.user?.id

  useEffect(() => {
    if (!slug) return
    supabase.rpc('vitrine_servicos', { p_slug: slug })
      .then(({ data }) => setServicos((data || []).map(s => ({
        id: s.id, label: s.nome, duracao: s.duracao || 60, valor: Number(s.preco) || 0,
      }))))
    supabase.rpc('vitrine_horarios', { p_slug: slug })
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(h => { map[h.dia_semana] = h })
        setHorarios(map)
      })
    supabase.rpc('vitrine_dias_especiais', { p_slug: slug, p_desde: chaveDia(new Date()) })
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(d => { map[d.data] = d })
        setEspeciais(map)
      })
  }, [slug, versaoExpediente])

  const chaveOcupados = salonId && userId ? `${salonId}|${userId}|${chaveDia(diaAtivo)}|${recargaOcupados}` : null
  useEffect(() => {
    if (!chaveOcupados) return
    let vivo = true
    const inicio = new Date(diaAtivo); inicio.setHours(0, 0, 0, 0)
    const fim    = new Date(diaAtivo); fim.setHours(23, 59, 59, 999)
    supabase.rpc('horarios_ocupados', {
      p_salon_id: salonId,
      p_inicio: inicio.toISOString(),
      p_fim: fim.toISOString(),
    }).then(({ data, error }) => {
      if (!vivo) return
      setOcupados({ chave: chaveOcupados, lista: data || [], erro: !!error })
    })
    return () => { vivo = false }
  }, [chaveOcupados, salonId, diaAtivo])
  const loadingSlots = !!chaveOcupados && ocupados.chave !== chaveOcupados
  const erroOcupados = !loadingSlots && ocupados.erro
  const agendExist   = loadingSlots ? [] : ocupados.lista

  const chaveMeus = tela === 'agendamentos' && salonId && userId ? `${salonId}|${userId}|${recargaMeus}` : null
  useEffect(() => {
    if (!chaveMeus) return
    let vivo = true
    supabase.rpc('meus_agendamentos', { p_salon_id: salonId })
      .then(({ data, error }) => {
        if (!vivo) return
        setMeus({ chave: chaveMeus, lista: data || [], erro: !!error })
      })
    return () => { vivo = false }
  }, [chaveMeus, salonId])
  const meusAgend        = meus.lista
  const loadingMeusAgend = !!chaveMeus && meus.chave !== chaveMeus
  const erroMeusAgend    = !!chaveMeus && !loadingMeusAgend && meus.erro

  const agora = new Date()
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const ehHoje = isSameDay(diaAtivo, hoje)

  const horarioDoDia = useCallback((dia) => {
    const esp = especiais[chaveDia(dia)]
    if (esp) return esp.fechado ? null : esp
    const h = horarios[dia.getDay()] ?? horarioPadrao(dia.getDay())
    return h.ativo ? h : null
  }, [especiais, horarios])

  const hDia = horarioDoDia(diaAtivo)

  const ultimoData  = useMemo(() => ultimoDiaAgendavelData(), [])
  const chaveUltimo = chaveDia(ultimoData)
  const chaveHoje   = chaveDia(hoje)

  const estadosCal = useMemo(() => {
    const mapa = {}
    const inicio = new Date(mesCal.ano, mesCal.mes, 1)
    inicio.setDate(inicio.getDate() - inicio.getDay())
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio)
      d.setDate(d.getDate() + i)
      const chave = chaveDia(d)
      if (!horarioDoDia(d)) mapa[chave] = 'fechado'
      else if (especiais[chave]) mapa[chave] = 'especial'
    }
    return mapa
  }, [mesCal, horarioDoDia, especiais])

  const selecionarDia = (d) => {
    const dia = new Date(d); dia.setHours(0, 0, 0, 0)
    setDiaAtivo(dia)
    setSlot(null)
    if (!dias.some(x => isSameDay(x, dia))) setAncora(inicioDaFita(dia, hoje, ultimoData))
    if (dia.getMonth() !== mesCal.mes || dia.getFullYear() !== mesCal.ano) setMesCal(mesDe(dia))
  }

  const trocarMesCal = (delta) => setMesCal(({ ano, mes }) => mesDe(new Date(ano, mes + delta, 1)))

  const selecionarNoCalendario = (d) => { selecionarDia(d); setCalAberto(false) }

  const slotsLivres = servico && hDia
    ? gerarSlots(diaAtivo, hDia).filter(s => {
        if (ehHoje && s <= agora) return false
        const fim = new Date(s.getTime() + servico.duracao * 60000)
        if (fim > horaParaDate(diaAtivo, hDia.fechamento)) return false
        return !agendExist.some(ag => {
          const agS = new Date(ag.data_hora)
          const agE = new Date(agS.getTime() + (ag.duracao ?? 30) * 60000)
          return s < agE && fim > agS
        })
      })
    : []

  const handleLogin = async () => {
    setAuthLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authForm.email, password: authForm.password,
    })
    if (error) { toast.error('Email ou senha inválidos'); setAuthLoading(false); return }
    if (data.user?.user_metadata?.role !== 'cliente') {
      await supabase.auth.signOut()
      toast.error('Use uma conta de cliente para agendar')
      setAuthLoading(false); return
    }
    setAuthLoading(false)
  }

  const handleCadastro = async () => {
    if (authForm.password.length < 8) { toast.error('Senha deve ter pelo menos 8 caracteres'); return }
    if (!telefoneValido(authForm.telefone)) { toast.error(MSG_TELEFONE_INVALIDO); return }
    setAuthLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
      options: { data: { nome: authForm.nome, telefone: authForm.telefone, role: 'cliente' } },
    })
    if (error) { toast.error(error.message); setAuthLoading(false); return }
    if (!data.session) {
      toast.success('Confirme seu e-mail para continuar')
      setAuthLoading(false); return
    }
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const confirmarCancelar = async (id) => {
    confirmacao.desarmar()
    const { error } = await supabase.rpc('cancelar_meu_agendamento', { p_agendamento_id: id })
    if (error) { toast.error('Erro ao cancelar'); return }
    setMeus(m => ({ ...m, lista: m.lista.map(a => a.id === id ? { ...a, status: 'cancelado' } : a) }))
  }

  const confirmar = async () => {
    setSalvando(true)
    try {
      const { error } = await supabase.rpc('criar_agendamento_cliente', {
        p_salon_id:    salon.id,
        p_servico_id:  servico.id,
        p_data_hora:   slot.toISOString(),
        p_nome:        session.user.user_metadata?.nome ?? null,
        p_telefone:    session.user.user_metadata?.telefone ?? null,
        p_observacoes: form.obs || null,
      })
      if (error) throw error
      setRecargaMeus(v => v + 1)
      setSucesso(true)
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('Horario indisponivel')) {
        toast.error('Esse horário acabou de ser reservado. Escolha outro.')
        setEtapa('data')
        setSlot(null)
        setRecargaOcupados(v => v + 1)
      } else if (msg.includes('não abre neste dia') || msg.includes('fora do expediente')) {
        toast.error('A barbearia mudou o horário deste dia. Escolha outro horário.')
        setEtapa('data')
        setSlot(null)
        setVersaoExpediente(v => v + 1)
      } else if (err?.code === 'P0001' && msg) {
        toast.error(msg)
      } else {
        toast.error('Erro ao confirmar. Tente novamente.')
      }
    } finally {
      setSalvando(false)
    }
  }

  const resetar = (destino = 'home') => {
    setSucesso(false); setEtapa('servico'); setServico(null)
    setSlot(null); setForm({ obs: '' })
    setDiaAtivo(hoje); setAncora(hoje); setMesCal(mesDe(hoje)); setCalAberto(false)
    setTela(destino)
  }

  const isCliente = session?.user?.user_metadata?.role === 'cliente'

  const now = new Date()
  const proximos  = meusAgend.filter(a => new Date(a.data_hora) >= now && ['pendente', 'confirmado'].includes(a.status))
  const historico = meusAgend.filter(a => new Date(a.data_hora) < now || ['concluido', 'cancelado'].includes(a.status))

  const slotFim = slot && servico ? new Date(slot.getTime() + servico.duracao * 60000) : null
  const proximoDia = (() => {
    const d = new Date(diaAtivo); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0)
    return chaveDia(d) <= chaveUltimo ? d : null
  })()

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-concreto flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-acento-marca border-t-transparent animate-spin" />
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-concreto flex items-center justify-center p-6">
        <FundoFoto />
        <div className="relative z-10 w-full max-w-sm space-y-5">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-chapa bg-ok-fundo mx-auto flex items-center justify-center anim-pop">
              <Check size={26} strokeWidth={2.5} className="text-ok" />
            </div>
            <h2 className="font-display text-tela">
              Agendamento confirmado
            </h2>
            <p className="text-apoio text-cal-2">
              Te esperamos em {salon?.nome}. Até lá!
            </p>
          </div>

          <div className="card space-y-2.5">
            {[
              ['Serviço', servico?.label, false],
              ['Data',    slot?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }), false],
              ['Horário', slotFim ? `${formatHora(slot)} – ${formatHora(slotFim)}` : formatHora(slot), true],
            ].map(([k, v, mono]) => (
              <div key={k} className="flex justify-between gap-4 text-apoio">
                  <span className="text-cal-2">{k}</span>
                  <span className={`text-right font-semibold ${mono ? "num" : ""}`}>{v}</span>
              </div>
            ))}
            <div className="flex justify-between text-apoio pt-2.5 border-t border-dashed border-junta-forte">
                <span className="font-semibold text-cal-2">Valor</span>
                <span className="num font-semibold">{brlCompacto(servico?.valor)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <button className="btn-primary w-full" onClick={() => resetar('agendamentos')}>Ver meus agendamentos</button>
            <button className="btn-secondary w-full" onClick={() => resetar('agendar')}>Fazer outro agendamento</button>
          </div>
        </div>
      </div>
    )
  }

  const header = (
    <>
    <FundoFoto />
    <header className="relative z-10 bg-bancada border-b border-junta px-5 py-3.5 pt-[calc(0.875rem+env(safe-area-inset-top))] flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Monogram nome={salon?.nome} logoUrl={salon?.logo_url} />
        <span className="font-display text-card">{salon?.nome || '...'}</span>
      </div>
      {isCliente && (
        <button onClick={handleSignOut} aria-label="Sair da conta"
          className="p-2 rounded-controle text-cal-2 transition-colors hover:bg-elevado hover:text-cal">
          <LogOut size={16} />
        </button>
      )}
    </header>
    </>
  )

  if (!isCliente) {
    return (
      <div className="min-h-screen bg-concreto">
        {header}
        <main className="relative z-10 flex items-center justify-center px-5 py-10">
          <div className="card p-8 w-full max-w-sm">

            {authMode === 'login' ? (
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleLogin() }}>
                <div>
                  <h1 className="font-display text-tela">Entre para agendar</h1>
                  <p className="text-apoio text-cal-2 mt-1">em {salon?.nome || '...'}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="login-email">E-mail</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cal-3" />
                    <input id="login-email" type="email" className="input-base pl-9"
                      placeholder="seu@email.com" value={authForm.email} autoComplete="email" required
                      onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="login-senha">Senha</label>
                  <CampoSenha id="login-senha" comCadeado
                    placeholder="••••••••" value={authForm.password} autoComplete="current-password" required
                    onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
                  <div className="text-right">
                    <Link
                      to="/esqueci-senha" state={{ email: authForm.email, voltar: `/${slug}/agendar` }}
                      className="text-apoio font-semibold text-acento-texto"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full" disabled={authLoading}>
                  {authLoading ? 'Entrando...' : 'Entrar'}
                </button>

                <p className="text-center text-apoio text-cal-2">
                  Não tem conta?{' '}
                  <button type="button" onClick={() => setAuthMode('cadastro')} className="font-semibold text-acento-texto">
                    Cadastre-se
                  </button>
                </p>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleCadastro() }}>
                <div>
                  <h1 className="font-display text-tela">Crie sua conta</h1>
                  <p className="text-apoio text-cal-2 mt-1">para agendar em {salon?.nome || '...'}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="cad-nome">Nome completo</label>
                  <input id="cad-nome" className="input-base" placeholder="Seu nome" autoComplete="name" required
                    value={authForm.nome} onChange={e => setAuthForm(p => ({ ...p, nome: e.target.value }))} />
                </div>

                <div className="space-y-1">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="cad-email">E-mail</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cal-3" />
                    <input id="cad-email" type="email" className="input-base pl-9"
                      placeholder="seu@email.com" value={authForm.email} autoComplete="email" required
                      onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="cad-senha">Senha</label>
                  <CampoSenha id="cad-senha" comCadeado
                    placeholder="Mínimo 8 caracteres" value={authForm.password} autoComplete="new-password" minLength={8} required
                    onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
                </div>

                <div className="space-y-1">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="cad-fone">Telefone</label>
                  <input id="cad-fone" {...propsCampoTelefone} className="input-base num"
                    value={authForm.telefone} onChange={e => setAuthForm(p => ({ ...p, telefone: mascararTelefone(e.target.value) }))} />
                </div>

                <button type="submit" className="btn-primary w-full" disabled={authLoading}>
                  {authLoading ? 'Criando conta...' : 'Criar conta e agendar'}
                </button>

                <AvisoLegal nomeSalao={salon?.nome} />

                <p className="text-center text-apoio text-cal-2">
                  Já tem conta?{' '}
                  <button type="button" onClick={() => setAuthMode('login')} className="font-semibold text-acento-texto">
                    Entrar
                  </button>
                </p>
              </form>
            )}
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'home') {
    const nome = session.user.user_metadata?.nome || 'Cliente'
    return (
      <div className="min-h-screen bg-concreto">
        {header}
        <main className="relative z-10 max-w-lg mx-auto p-5 space-y-6">
          <div>
            <h1 className="font-display text-tela">
              Olá, {nome.split(' ')[0]}
            </h1>
            <p className="text-apoio text-cal-2 mt-1">O que você quer fazer?</p>
          </div>
          <div className="space-y-3">
            <button onClick={() => setTela('agendar')}
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

            <button onClick={() => setTela('agendamentos')}
              className="card w-full text-left flex items-center gap-4 p-5 transition-colors hover:bg-elevado hover:border-latao">
              <div className="w-11 h-11 rounded-chapa bg-acento/15 flex items-center justify-center flex-shrink-0">
                <ClipboardList size={20} className="text-acento-texto" />
              </div>
              <div>
                <p className="font-display text-card">Meus agendamentos</p>
                <p className="text-apoio text-cal-2 mt-0.5">Ver seus horários marcados</p>
              </div>
              <span className="ml-auto text-card text-cal-2" aria-hidden>›</span>
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (tela === 'agendamentos') {
    return (
      <div className="min-h-screen bg-concreto">
        {header}
        <main className="relative z-10 max-w-lg mx-auto p-5 space-y-5">
          <button onClick={() => setTela('home')}
            className="flex items-center gap-1.5 text-apoio rounded-controle px-2 py-1 -ml-2 transition-colors text-cal-2 hover:bg-elevado hover:text-cal">
            <ArrowLeft size={15} /> Início
          </button>

          {loadingMeusAgend ? (
            <div className="card space-y-3" aria-hidden>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-chapa bg-elevado animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/5 rounded-chapa bg-elevado animate-pulse" />
                    <div className="h-3 w-3/5 rounded-chapa bg-elevado animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : erroMeusAgend ? (
            <div className="card text-center py-10 space-y-3" role="alert">
              <p className="font-display text-card">Não foi possível carregar seus agendamentos</p>
              <p className="text-apoio text-cal-2">Confira sua conexão e tente de novo.</p>
              <button className="btn-secondary text-sm" onClick={() => setRecargaMeus(v => v + 1)}>
                Tentar de novo
              </button>
            </div>
          ) : meusAgend.length === 0 ? (
            <div className="card text-center py-10 space-y-4">
              <div className="w-12 h-12 rounded-chapa bg-elevado mx-auto flex items-center justify-center">
                <Calendar size={22} className="text-cal-2" />
              </div>
              <div>
                <p className="font-display text-card">Nenhum agendamento ainda</p>
                <p className="text-apoio text-cal-2 mt-1">Seu primeiro horário está a três toques daqui.</p>
              </div>
              <button className="btn-primary px-6" onClick={() => setTela('agendar')}>
                Marcar horário
              </button>
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-concreto">
      {header}

      <main className="relative z-10 max-w-lg mx-auto p-5 space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setTela('home')}
            className="flex items-center gap-1.5 text-apoio rounded-controle px-2 py-1 -ml-2 transition-colors text-cal-2 hover:bg-elevado hover:text-cal">
            <ArrowLeft size={15} /> Início
          </button>
          <StepIndicator etapa={etapa} />
        </div>

        {etapa === 'servico' && (
          <div className="space-y-4">
            <h2 className="font-display text-tela">Escolha o serviço</h2>
            {servicos.length === 0 && (
              <p className="text-apoio text-cal-2 py-4 text-center">
                Esta barbearia ainda não cadastrou serviços para agendamento online.
              </p>
            )}
            <div className="space-y-2" role="radiogroup" aria-label="Serviços disponíveis">
              {servicos.map(s => {
                const ativo = servico?.id === s.id
                return (
                  <button key={s.id} onClick={() => setServico(s)}
                    role="radio" aria-checked={ativo}
                    className={`marca w-full p-4 rounded-superficie text-left border bg-bancada transition-colors flex items-center gap-3 ${ativo ? "border-acento-filete" : "border-junta-forte hover:border-latao"}`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${ativo ? "border-acento-filete" : "border-junta-forte"}`}>
                      {ativo && <Check size={12} strokeWidth={3} className="text-acento-texto" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-display text-card">{s.label}</p>
                      <p className="num text-apoio text-cal-2 mt-0.5">{formatDuracao(s.duracao)}</p>
                    </div>
                    <p className="num font-semibold">{brlCompacto(s.valor)}</p>
                  </button>
                )
              })}
            </div>
            <button className="btn-primary w-full" disabled={!servico} onClick={() => setEtapa('data')}>
              Continuar
            </button>
          </div>
        )}

        {etapa === 'data' && (
          <div className="space-y-4">
            <FichaServico servico={servico} onTrocar={() => setEtapa('servico')} />

            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-tela">Quando fica bom?</h2>
              <button
                onClick={() => setCalAberto(v => !v)}
                aria-expanded={calAberto}
                aria-controls="calendario-agendar"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-controle text-apoio font-semibold border bg-bancada transition-colors flex-shrink-0 ${calAberto ? 'border-acento-filete text-cal' : 'border-junta-forte text-cal-2 hover:border-latao hover:text-cal'}`}
              >
                <CalendarDays size={15} aria-hidden />
                {calAberto ? 'Fechar' : 'Outra data'}
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x -mx-5 px-5 pb-1">
              {dias.map(dia => {
                const ativo = isSameDay(dia, diaAtivo)
                const fechado = !horarioDoDia(dia)
                return (
                  <button key={dia.toISOString()}
                    onClick={() => selecionarDia(dia)}
                    aria-pressed={ativo}
                    aria-label={`${DIAS_SEMANA[dia.getDay()]}, dia ${dia.getDate()}${fechado ? ', fechado' : ''}`}
                    className={`marca flex flex-col items-center px-3 py-2 rounded-controle min-w-[54px] snap-start border bg-bancada transition-colors ${ativo ? "border-acento-filete text-cal" : "border-junta text-cal-2 hover:border-latao"}`}
                  >
                    <span className="text-micro font-semibold">
                      {isSameDay(dia, hoje) ? 'Hoje' : DIAS_SEMANA[dia.getDay()]}
                    </span>
                    <span className={`num text-card font-semibold ${fechado ? 'line-through text-cal-3' : ''}`}>{dia.getDate()}</span>
                  </button>
                )
              })}
            </div>

            {calAberto && (
              <div id="calendario-agendar" className="space-y-2 anim-pop">
                <CalendarioMes
                  ano={mesCal.ano}
                  mes={mesCal.mes}
                  diaAtivo={diaAtivo}
                  estados={estadosCal}
                  de={chaveHoje}
                  ate={chaveUltimo}
                  className=""
                  onSelecionar={selecionarNoCalendario}
                  onTrocarMes={trocarMesCal}
                />
                <p className="text-micro text-cal-2">
                  <span className="line-through">riscado</span>: a barbearia não abre ·
                  dá para agendar até <span className="num">{ultimoData.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                </p>
              </div>
            )}

            {loadingSlots ? (
              <div className="flex flex-wrap gap-2" aria-hidden>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-8 w-16 rounded-controle bg-elevado animate-pulse" />
                ))}
              </div>
            ) : erroOcupados ? (
              <div className="card text-center py-8 space-y-3" role="alert">
                <p className="font-display text-corpo">Não foi possível carregar os horários</p>
                <p className="text-apoio text-cal-2">Confira sua conexão e tente de novo.</p>
                <button className="btn-secondary text-sm" onClick={() => setRecargaOcupados(v => v + 1)}>
                  Tentar de novo
                </button>
              </div>
            ) : slotsLivres.length === 0 ? (
              <div className="card text-center py-8 space-y-3">
                <p className="font-display text-corpo">
                  {hDia ? `Nenhum horário livre ${ehHoje ? 'hoje' : 'neste dia'}` : 'A barbearia não abre neste dia'}
                </p>
                <p className="text-apoio text-cal-2">
                  {!hDia ? 'Escolha outra data.' : ehHoje ? 'A agenda de hoje já fechou.' : 'Todos os horários deste dia já foram reservados.'}
                </p>
                {proximoDia && (
                  <button className="btn-secondary text-sm" onClick={() => selecionarDia(proximoDia)}>
                    Ver {DIAS_SEMANA[proximoDia.getDay()]}, {proximoDia.getDate()}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {agruparPorPeriodo(slotsLivres).map(g => (
                  <div key={g.label}>
                    <p className="regua mb-2">
                      {g.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.slots.map(s => {
                        const ativo = slot?.toISOString() === s.toISOString()
                        return (
                          <button key={s.toISOString()} onClick={() => setSlot(s)}
                            aria-pressed={ativo}
                            className={`marca num px-3.5 py-1.5 rounded-controle text-apoio border bg-bancada transition-colors ${ativo ? "border-acento-filete text-cal font-semibold" : "border-junta-forte text-cal-2 hover:border-latao hover:text-cal"}`}
                          >
                            {ativo ? `${formatHora(s)} – ${formatHora(new Date(s.getTime() + servico.duracao * 60000))}` : formatHora(s)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-primary w-full" disabled={!slot} onClick={() => setEtapa('confirmar')}>
              Continuar
            </button>
          </div>
        )}

        {etapa === 'confirmar' && (
          <div className="space-y-4">
            <h2 className="font-display text-tela">Confira e confirme</h2>

            <div className="card space-y-2.5">
              {[
                ['Serviço', servico?.label, false],
                ['Data',    slot?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }), false],
                ['Horário', slotFim ? `${formatHora(slot)} – ${formatHora(slotFim)}` : formatHora(slot), true],
                ['Duração', formatDuracao(servico?.duracao), true],
              ].map(([k, v, mono]) => (
                <div key={k} className="flex justify-between gap-4 text-apoio">
                  <span className="text-cal-2">{k}</span>
                  <span className={`text-right font-semibold ${mono ? "num" : ""}`}>{v}</span>
                </div>
              ))}
              <div className="flex justify-between text-apoio pt-2.5 border-t border-dashed border-junta-forte">
                <span className="font-semibold text-cal-2">Valor</span>
                <span className="num font-semibold">{brlCompacto(servico?.valor)}</span>
              </div>
            </div>

            <p className="text-apoio text-cal-2 px-1">
              Agendando como{' '}
              <span className="font-semibold text-cal">
                {session.user.user_metadata.nome}
              </span>
            </p>

            <div className="space-y-1">
              <label className="text-apoio font-semibold text-cal-2" htmlFor="agendar-obs">
                Observações <span className="font-normal text-cal-3">(opcional)</span>
              </label>
              <textarea id="agendar-obs" className="input-base resize-none" rows={2}
                placeholder="Preferências, alergias..."
                value={form.obs} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <button className="btn-primary w-full" disabled={salvando} onClick={confirmar}>
                {salvando ? 'Confirmando...' : 'Confirmar agendamento'}
              </button>
              <button className="btn-secondary w-full" onClick={() => setEtapa('data')}>
                Voltar e ajustar
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
