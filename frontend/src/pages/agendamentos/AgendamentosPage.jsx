import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import CamadaModal from '../../components/ui/CamadaModal'
import { Plus, X, Repeat, Coffee } from 'lucide-react'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import PageHeader from '../../components/ui/PageHeader'
import { formatarTelefone, mascararTelefone, telefoneValido, MSG_TELEFONE_INVALIDO, propsCampoTelefone } from '../../lib/telefone'
import CalendarioMes from '../../components/ui/CalendarioMes'
import { brlCompacto, chaveDia, horarioPadrao, primeiroDiaAgendavel, ultimoDiaAgendavel, MESES_LIMITE_AGENDAMENTO, DURACOES_PAUSA, somarMinutos, rotuloDuracaoPausa } from '../../lib/agenda'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const REPETICOES = [
  { valor: 0, label: 'Não repetir' },
  { valor: 1, label: 'Toda semana' },
  { valor: 2, label: 'A cada 2 semanas' },
  { valor: 4, label: 'A cada 4 semanas' },
]

const DIA_LONGO = [['domingo', 'o'], ['segunda', 'a'], ['terça', 'a'], ['quarta', 'a'],
                   ['quinta', 'a'], ['sexta', 'a'], ['sábado', 'o']]

function descricaoFixo(diaSemana, hora, intervalo) {
  const [nome, g] = DIA_LONGO[diaSemana]
  const quando = intervalo === 1 ? `tod${g} ${nome}` : `a cada ${intervalo} semanas, n${g} ${nome}`
  return `${quando} às ${hora.slice(0, 5)}`
}

function diaMes(iso) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const PERIODOS = [
  { label: 'Manhã',        de: 0,  ate: 12 },
  { label: 'Tarde',        de: 12, ate: 16 },
  { label: 'Fim de tarde', de: 16, ate: 24 },
]

function gerarDias(n, base = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })
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

function servicoCabe(slot, duracao, agendamentos, fechamento) {
  const fim = new Date(slot.getTime() + duracao * 60000)
  if (fim > fechamento) return false
  return !agendamentos.some(ag => {
    const agStart = new Date(ag.data_hora)
    const agEnd   = new Date(agStart.getTime() + (ag.duracao ?? 30) * 60000)
    return slot < agEnd && fim > agStart
  })
}

function formatDuracao(min) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${m}min` : `${h}h`
}

function normaliza(s) {
  return (s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function agruparPorPeriodo(slots) {
  return PERIODOS
    .map(p => ({ label: p.label, slots: slots.filter(s => s.getHours() >= p.de && s.getHours() < p.ate) }))
    .filter(g => g.slots.length > 0)
}

export default function AgendamentosPage() {
  const { salon } = useAuth()
  const [ancora, setAncora] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const dias = useMemo(() => gerarDias(7, ancora), [ancora])
  const [mesCal, setMesCal] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() } })
  const [contagens, setContagens] = useState({})
  const [diaAtivo, setDiaAtivo] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [agendamentos, setAgendamentos] = useState([])
  const [servicos,     setServicos]     = useState([])
  const [horarios,     setHorarios]     = useState({})
  const [especiais,    setEspeciais]    = useState({})
  const [pausasDia,    setPausasDia]    = useState({})
  const [pausaEdit,    setPausaEdit]    = useState(null)
  const [agendFormDia, setAgendFormDia] = useState([])
  const [showModal, setShowModal]       = useState(false)
  const confirmacao = useConfirmacao()
  const [confirmCliente, setConfirmCliente] = useState(null)
  const [refreshKey, setRefreshKey]     = useState(0)
  const [agora, setAgora]               = useState(() => new Date())
  const [fixo, setFixo]                 = useState(null)

  const [form, setForm] = useState({
    nome: '', telefone: '', servico: null, data: '', hora: '', obs: '', repetir: 0,
  })

  useEffect(() => {
    if (!salon?.id) return
    supabase.rpc('gerar_meus_horarios_fixos').then(({ data }) => {
      if (data > 0) setRefreshKey(k => k + 1)
    })
  }, [salon?.id])

  useEffect(() => {
    if (!salon?.id) return
    const inicio = new Date(diaAtivo); inicio.setHours(0, 0, 0, 0)
    const fim    = new Date(diaAtivo); fim.setHours(23, 59, 59, 999)
    supabase.from('agendamentos')
      .select('*, clientes(nome, telefone)')
      .eq('salon_id', salon.id)
      .gte('data_hora', inicio.toISOString())
      .lte('data_hora', fim.toISOString())
      .order('data_hora')
      .then(({ data }) => { if (data) setAgendamentos(data) })
  }, [diaAtivo, salon, refreshKey])

  useEffect(() => {
    if (!salon?.id) return
    const inicio = new Date(mesCal.ano, mesCal.mes, 1); inicio.setDate(inicio.getDate() - 7)
    const fim    = new Date(mesCal.ano, mesCal.mes + 1, 1); fim.setDate(fim.getDate() + 7)
    supabase.from('agendamentos')
      .select('data_hora')
      .eq('salon_id', salon.id)
      .neq('status', 'cancelado')
      .gte('data_hora', inicio.toISOString())
      .lt('data_hora', fim.toISOString())
      .then(({ data }) => {
        const mapa = {}
        for (const a of data || []) {
          const k = chaveDia(new Date(a.data_hora))
          mapa[k] = (mapa[k] || 0) + 1
        }
        setContagens(mapa)
      })
  }, [salon?.id, mesCal.ano, mesCal.mes, refreshKey])

  useEffect(() => {
    if (!salon?.id) return
    supabase.from('servicos').select('id, nome, preco, duracao')
      .eq('salon_id', salon.id).eq('ativo', true).order('nome')
      .then(({ data }) => setServicos((data || []).map(s => ({
        id: s.id, label: s.nome, duracao: s.duracao || 60, valor: Number(s.preco) || 0,
      }))))
    supabase.from('horarios').select('dia_semana, abertura, fechamento, ativo, pausa_inicio, pausa_minutos')
      .eq('salon_id', salon.id)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(h => { map[h.dia_semana] = h })
        setHorarios(map)
      })
    const desde = new Date(); desde.setDate(desde.getDate() - 31)
    supabase.from('dias_especiais').select('data, fechado, abertura, fechamento')
      .eq('salon_id', salon.id)
      .gte('data', chaveDia(desde))
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(d => { map[d.data] = d })
        setEspeciais(map)
      })
    supabase.from('pausas_dia').select('data, inicio, minutos')
      .eq('salon_id', salon.id)
      .gte('data', chaveDia(desde))
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(p => { map[p.data] = { inicio: p.inicio, minutos: p.minutos } })
        setPausasDia(map)
      })
  }, [salon?.id])

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!salon?.id) return
    const channel = supabase
      .channel(`agend-${salon.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'agendamentos',
        filter: `salon_id=eq.${salon.id}`,
      }, () => setRefreshKey(k => k + 1))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [salon])

  const horarioDoDia = (dia) => {
    const esp = especiais[chaveDia(dia)]
    if (esp) return esp.fechado ? null : esp
    const h = horarios[dia.getDay()] ?? horarioPadrao(dia.getDay())
    return h.ativo ? h : null
  }

  const infoPausa = (dia) => {
    const k = chaveDia(dia)
    if (k in pausasDia) {
      const p = pausasDia[k]
      return { pausa: p.inicio ? { inicio: p.inicio.slice(0, 5), minutos: p.minutos } : null, doDia: true }
    }
    const h = horarios[dia.getDay()]
    return { pausa: h?.pausa_inicio ? { inicio: h.pausa_inicio.slice(0, 5), minutos: h.pausa_minutos } : null, doDia: false }
  }
  const comPausa = (dia, lista) => {
    const { pausa } = infoPausa(dia)
    return pausa
      ? [...lista, { data_hora: horaParaDate(dia, pausa.inicio).toISOString(), duracao: pausa.minutos }]
      : lista
  }

  const estadosCal = useMemo(() => Object.fromEntries(
    Object.values(especiais).map(e => [e.data, e.fechado ? 'fechado' : 'especial'])
  ), [especiais])

  const agendDia    = agendamentos.filter(a => isSameDay(a.data_hora, diaAtivo) && a.status !== 'cancelado')
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const ehHoje = isSameDay(diaAtivo, hoje)
  const diaPassado = diaAtivo < hoje
  const hDiaAtivo   = horarioDoDia(diaAtivo)
  const duracaoMinima = servicos.length ? Math.min(...servicos.map(s => s.duracao)) : 30
  const slotsLivres = (hDiaAtivo ? gerarSlots(diaAtivo, hDiaAtivo) : [])
    .filter(s => servicoCabe(s, duracaoMinima, comPausa(diaAtivo, agendDia), horaParaDate(diaAtivo, hDiaAtivo.fechamento)))
    .filter(s => s > agora)

  const abrirModal = (slot = null) => {
    const base = diaPassado ? hoje : diaAtivo
    const dataStr = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
    setForm({ nome: '', telefone: '', servico: null, data: dataStr, hora: slot ? formatHora(slot) : '', obs: '', repetir: 0 })
    setShowModal(true)
  }

  useEffect(() => {
    if (!showModal || !salon?.id || !form.data) return
    const dia = new Date(form.data + 'T00:00:00')
    const inicio = new Date(dia); inicio.setHours(0, 0, 0, 0)
    const fim    = new Date(dia); fim.setHours(23, 59, 59, 999)
    supabase.from('agendamentos')
      .select('data_hora, status, duracao')
      .eq('salon_id', salon.id)
      .neq('status', 'cancelado')
      .gte('data_hora', inicio.toISOString())
      .lte('data_hora', fim.toISOString())
      .then(({ data }) => setAgendFormDia(data || []))
  }, [showModal, form.data, salon?.id, refreshKey])

  const formDia    = form.data ? new Date(form.data + 'T00:00:00') : diaAtivo
  const hFormDia   = horarioDoDia(formDia)
  const ehHojeForm = isSameDay(formDia, hoje)
  const formPassado = formDia < hoje
  const horariosDoForm = (servicoId) => {
    if (!hFormDia) return []
    const dur = servicos.find(s => s.id === servicoId)?.duracao ?? duracaoMinima
    const fechamento = horaParaDate(formDia, hFormDia.fechamento)
    return gerarSlots(formDia, hFormDia)
      .filter(s => servicoCabe(s, dur, comPausa(formDia, agendFormDia), fechamento))
      .filter(s => s > agora)
  }
  const slotsModal = horariosDoForm(form.servico)
  const horarioFim = form.servico && form.hora ? (() => {
    const [hh, mm] = form.hora.split(':').map(Number)
    const d = new Date(); d.setHours(hh, mm, 0, 0)
    const dur = servicos.find(s => s.id === form.servico)?.duracao ?? 30
    return formatHora(new Date(d.getTime() + dur * 60000))
  })() : null

  const gravarAgendamento = async (payload) => {
    const { error } = await supabase.from('agendamentos').insert(payload)
    if (error) {
      if (String(error.message || '').includes('Horario indisponivel')) {
        toast.error('Esse horário já está ocupado. Escolha outro.')
      } else if (String(error.message || '').includes('3 meses')) {
        toast.error(`Só dá para agendar até ${MESES_LIMITE_AGENDAMENTO} meses à frente`)
      } else {
        toast.error('Erro ao agendar')
      }
      return
    }
    toast.success('Agendamento criado!')
    setShowModal(false)
    setDiaAtivo(d => new Date(d))
  }

  const gravarFixo = async (payload) => {
    const { data, error } = await supabase.rpc('criar_horario_fixo', {
      p_cliente_id: payload.cliente_id,
      p_servico_id: payload.servico_id,
      p_data_inicio: form.data,
      p_hora: form.hora,
      p_intervalo_semanas: form.repetir,
      p_observacoes: payload.observacoes,
    })
    if (error) {
      const msg = String(error.message || '')
      toast.error(
        msg.includes('Nenhuma data livre') ? 'Nenhuma data livre nesse horário. Escolha outro.'
        : msg.includes('3 meses')          ? `Só dá para agendar até ${MESES_LIMITE_AGENDAMENTO} meses à frente`
        :                                    'Erro ao criar o horário fixo'
      )
      return
    }
    const marcadas = (data || []).filter(d => d.situacao === 'marcado').length
    const puladas  = (data || []).filter(d => d.situacao !== 'marcado')
    toast.success(`Horário fixo criado: ${marcadas} ${marcadas === 1 ? 'data reservada' : 'datas reservadas'}`)
    if (puladas.length > 0) {
      toast(`Ficaram de fora: ${puladas.map(p =>
        `${diaMes(p.dia)} (${p.situacao === 'ocupado' ? 'já tinha cliente' : p.situacao === 'pausa' ? 'almoço' : 'fechado'})`).join(', ')}`,
        { duration: 10000 })
    }
    setShowModal(false)
    setRefreshKey(k => k + 1)
  }

  const gravar = (payload) => form.repetir ? gravarFixo(payload) : gravarAgendamento(payload)

  const salvar = async () => {
    if (!form.nome || !form.servico || !form.data || !form.hora) {
      toast.error('Preencha todos os campos obrigatórios'); return
    }
    if (!telefoneValido(form.telefone)) { toast.error(MSG_TELEFONE_INVALIDO); return }
    if (form.repetir && !form.telefone) {
      toast.error('Informe o telefone: o horário fixo fica na ficha do cliente'); return
    }
    if (form.data < primeiroDiaAgendavel()) {
      toast.error('Não dá para agendar em data que já passou'); return
    }
    if (form.data > ultimoDiaAgendavel()) {
      toast.error(`Só dá para agendar até ${MESES_LIMITE_AGENDAMENTO} meses à frente`); return
    }
    const [hh, mm] = form.hora.split(':').map(Number)
    const dataHora = new Date(form.data + 'T00:00:00')
    dataHora.setHours(hh, mm, 0, 0)
    const servico = servicos.find(s => s.id === form.servico)

    let clienteId = null
    let fichaExistente = null
    if (form.telefone) {
      const { data: c } = await supabase.from('clientes').select('id, nome')
        .eq('salon_id', salon.id).in('telefone', [form.telefone, form.telefone.replace(/\D/g, '')])
        .limit(1).maybeSingle()
      if (c) {
        clienteId = c.id
        fichaExistente = c
      } else {
        const { data: nc } = await supabase.from('clientes')
          .insert({ salon_id: salon.id, nome: form.nome, telefone: form.telefone }).select().single()
        clienteId = nc?.id
      }
    }
    const payload = {
      salon_id: salon.id, cliente_id: clienteId,
      servico: servico?.label, servico_id: servico?.id,
      data_hora: dataHora.toISOString(), valor: servico?.valor,
      status: 'confirmado', observacoes: form.obs || null,
    }
    if (fichaExistente && normaliza(fichaExistente.nome) !== normaliza(form.nome)) {
      setConfirmCliente({ nome: fichaExistente.nome, payload })
      return
    }
    if (form.repetir && !clienteId) { toast.error('Erro ao salvar a ficha do cliente'); return }
    await gravar(payload)
  }

  const confirmarFichaExistente = async () => {
    const payload = confirmCliente?.payload
    setConfirmCliente(null)
    if (payload) await gravar(payload)
  }

  const pausaAtiva = infoPausa(diaAtivo)
  const pausaPadraoDoDia = (() => {
    const h = horarios[diaAtivo.getDay()]
    return h?.pausa_inicio ? { inicio: h.pausa_inicio.slice(0, 5), minutos: h.pausa_minutos } : null
  })()

  const abrirPausa = () => setPausaEdit({
    inicio: pausaAtiva.pausa?.inicio ?? pausaPadraoDoDia?.inicio ?? '12:00',
    minutos: pausaAtiva.pausa?.minutos ?? pausaPadraoDoDia?.minutos ?? 60,
    conflitos: null,
  })

  const gravarPausaDia = async (linha) => {
    const data = chaveDia(diaAtivo)
    const { error } = linha
      ? await supabase.from('pausas_dia').upsert({ salon_id: salon.id, data, ...linha }, { onConflict: 'salon_id,data' })
      : await supabase.from('pausas_dia').delete().eq('salon_id', salon.id).eq('data', data)
    if (error) { toast.error('Erro ao salvar o almoço'); return }
    setPausasDia(m => {
      const n = { ...m }
      if (linha) n[data] = linha
      else delete n[data]
      return n
    })
    setPausaEdit(null)
    toast.success(!linha ? 'Almoço do dia voltou ao padrão'
      : linha.inicio ? `Almoço marcado: ${linha.inicio} – ${somarMinutos(linha.inicio, linha.minutos)}`
      : 'Sem almoço neste dia')
  }

  const salvarPausa = async (mesmoAssim = false) => {
    const { inicio, minutos } = pausaEdit
    if (!inicio) { toast.error('Escolha o horário do almoço'); return }
    if (!mesmoAssim) {
      const ini = horaParaDate(diaAtivo, inicio)
      const fim = new Date(ini.getTime() + minutos * 60000)
      const conflitos = agendDia.filter(a => {
        const s = new Date(a.data_hora)
        const e = new Date(s.getTime() + (a.duracao ?? 30) * 60000)
        return s < fim && e > ini
      })
      if (conflitos.length > 0) { setPausaEdit(p => ({ ...p, conflitos })); return }
    }
    await gravarPausaDia({ inicio, minutos })
  }

  const abrirFixo = async (ag) => {
    setFixo({ ag, dados: null, armado: false })
    const { data } = await supabase.from('horarios_fixos')
      .select('id, data_inicio, hora, intervalo_semanas, ativo')
      .eq('id', ag.fixo_id).maybeSingle()
    setFixo(f => f && f.ag.id === ag.id ? { ...f, dados: data || { ativo: false } } : f)
  }

  const encerrarFixo = async () => {
    const { data, error } = await supabase.rpc('encerrar_horario_fixo', { p_fixo_id: fixo.ag.fixo_id })
    if (error) { toast.error('Erro ao encerrar o horário fixo'); return }
    toast.success(data > 0
      ? `Horário fixo encerrado: ${data} ${data === 1 ? 'data liberada' : 'datas liberadas'}`
      : 'Horário fixo encerrado')
    setFixo(null)
    setRefreshKey(k => k + 1)
  }

  const confirmarCancelar = async (id) => {
    confirmacao.desarmar()
    const { error } = await supabase.from('agendamentos').update({ status: 'cancelado' }).eq('id', id)
    if (error) { toast.error('Erro ao cancelar'); return }
    setAgendamentos(p => p.map(a => a.id === id ? { ...a, status: 'cancelado' } : a))
    toast.success('Agendamento cancelado')
  }

  const selecionarDia = (d) => {
    const dia = new Date(d); dia.setHours(0, 0, 0, 0)
    setDiaAtivo(dia)
    if (!dias.some(x => isSameDay(x, dia))) setAncora(dia)
    if (dia.getMonth() !== mesCal.mes || dia.getFullYear() !== mesCal.ano) {
      setMesCal({ ano: dia.getFullYear(), mes: dia.getMonth() })
    }
  }

  const trocarMes = (delta) => setMesCal(({ ano, mes }) => {
    const d = new Date(ano, mes + delta, 1)
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })

  return (
    <div className="p-5 md:p-8 space-y-5">

      <PageHeader
        title="Agendamentos"
        action={
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => abrirModal()}>
            <Plus size={16} /> Novo agendamento
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0 space-y-5">

      <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x pb-1">
        {dias.map(dia => {
          const ativo = isSameDay(dia, diaAtivo)
          return (
            <button key={dia.toISOString()} onClick={() => selecionarDia(dia)}
              aria-pressed={ativo}
              aria-label={`${DIAS_SEMANA[dia.getDay()]}, dia ${dia.getDate()}`}
              className={`marca flex flex-col items-center px-3 py-2 rounded-controle min-w-[54px] snap-start border bg-bancada transition-colors ${ativo ? "border-acento-filete text-cal" : "border-junta text-cal-2 hover:border-latao"}`}
            >
              <span className="text-micro font-semibold">
                {isSameDay(dia, hoje) ? 'Hoje' : DIAS_SEMANA[dia.getDay()]}
              </span>
              <span className="num text-card font-semibold">{dia.getDate()}</span>
            </button>
          )
        })}
      </div>

      <div className="card">
        <h2 className="font-display text-base font-semibold mb-3 text-cal">
          {diaAtivo.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        {especiais[chaveDia(diaAtivo)] && (
          <p className="text-apoio text-warn -mt-2 mb-3">
            {hDiaAtivo
              ? <>Horário especial: <span className="num">{hDiaAtivo.abertura.slice(0, 5)} – {hDiaAtivo.fechamento.slice(0, 5)}</span></>
              : 'Dia fechado em Configurações'}
          </p>
        )}
        {hDiaAtivo && (
          <button type="button" onClick={abrirPausa}
            className="-mt-1 mb-3 inline-flex items-center gap-1.5 text-apoio text-cal-2 transition-colors hover:text-cal">
            <Coffee size={14} aria-hidden="true" />
            {pausaAtiva.pausa
              ? <>Almoço <span className="num">{pausaAtiva.pausa.inicio} – {somarMinutos(pausaAtiva.pausa.inicio, pausaAtiva.pausa.minutos)}</span></>
              : 'Sem almoço'}
            <span className="text-cal-3">·</span>
            <span className="underline underline-offset-2">{pausaAtiva.pausa ? 'Alterar' : 'Marcar almoço'}</span>
          </button>
        )}
        {agendDia.length === 0
          ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm font-medium text-cal-2">Nenhum atendimento neste dia</p>
              {!diaPassado && (
                <button className="btn-secondary text-sm" onClick={() => abrirModal()}>
                  Agendar para este dia
                </button>
              )}
            </div>
          ) : (
            <div>
              {agendDia.map(a => (
                <div key={a.id} className="flex items-center gap-3 py-3 border-b last:border-b-0 border-junta">
                  <span className="text-sm font-semibold num w-12 flex-shrink-0 text-cal">
                    {formatHora(a.data_hora)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold truncate text-cal">{a.clientes?.nome || '—'}</p>
                      {a.fixo_id && (
                        <button type="button" onClick={() => abrirFixo(a)} aria-label="Ver horário fixo"
                          className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-chapa text-micro font-semibold border border-junta-forte text-cal-2 transition-colors hover:border-latao hover:text-cal">
                          <Repeat size={11} aria-hidden="true" /> Fixo
                        </button>
                      )}
                    </div>
                    <p className="text-xs truncate num text-cal-3">
                      {a.servico}{a.valor ? ` · ${brlCompacto(a.valor)}` : ''}
                    </p>
                    {a.clientes?.telefone && (
                      <a href={`tel:${a.clientes.telefone.replace(/\D/g, '')}`}
                        className="text-xs num truncate block hover:underline text-cal-2">
                        {formatarTelefone(a.clientes.telefone)}
                      </a>
                    )}
                  </div>
                  {confirmacao.armado !== a.id && <StatusBadge status={a.status} />}
                  {confirmacao.armado === a.id
                    ? (
                      <button onClick={() => confirmarCancelar(a.id)}
                        aria-label={`Confirmar cancelamento de ${a.clientes?.nome || 'agendamento'}`}
                        className="text-xs px-2.5 py-1 rounded-chapa text-cal font-semibold flex-shrink-0 whitespace-nowrap bg-danger-solido">
                        <span className="sm:hidden">Confirmar</span>
                        <span className="hidden sm:inline">Confirmar cancelamento</span>
                      </button>
                    ) : (
                      <button onClick={() => confirmacao.armar(a.id)} aria-label="Cancelar agendamento"
                        className="p-1.5 rounded-controle transition-colors flex-shrink-0 text-cal-2 hover:bg-danger-fundo hover:text-danger">
                        <X size={15} />
                      </button>
                    )
                  }
                </div>
              ))}
            </div>
          )
        }
      </div>

      <div className="card">
        <p className="text-sm font-semibold mb-3 text-cal-2">Horários livres</p>
        {slotsLivres.length === 0
          ? (
            <p className="text-sm text-cal-3">
              {diaPassado    ? 'Esse dia já passou.'
                : !hDiaAtivo ? 'Fechado neste dia.'
                : ehHoje     ? 'A agenda de hoje já fechou.'
                :              'Dia totalmente reservado.'}
            </p>
          ) : (
            <div className="space-y-4">
              {agruparPorPeriodo(slotsLivres).map(g => (
                <div key={g.label}>
                  <p className="regua mb-2">
                    {g.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.slots.map(slot => (
                      <button key={slot.toISOString()} onClick={() => abrirModal(slot)}
                        aria-label={`Agendar às ${formatHora(slot)}`}
                        className="px-3.5 py-1.5 rounded-controle text-sm num border transition-colors hover:border-acento-filete hover:text-acento-texto border-junta-forte text-cal bg-bancada"
                      >
                        {formatHora(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

        </div>

        <CalendarioMes
          ano={mesCal.ano}
          mes={mesCal.mes}
          diaAtivo={diaAtivo}
          contagens={contagens}
          estados={estadosCal}
          onSelecionar={selecionarDia}
          onTrocarMes={trocarMes}
        />
      </div>

      {showModal && (
        <CamadaModal onFundo={() => setShowModal(false)}>
          <div className="rounded-superficie px-6 pt-6 w-full max-w-md space-y-4 shadow-flutua border max-h-[90dvh] overflow-y-auto bg-bancada border-junta"
            role="dialog" aria-modal="true" aria-label="Novo agendamento"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-card text-cal">Novo agendamento</h2>
              <button onClick={() => setShowModal(false)} aria-label="Fechar"
                className="p-1.5 rounded-controle transition-colors text-cal-2 hover:bg-elevado hover:text-cal">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-cal-2" htmlFor="novo-nome">Nome *</label>
                <input id="novo-nome" className="input-base text-sm" placeholder="João Silva"
                  value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-xs font-medium text-cal-2" htmlFor="novo-fone">Telefone</label>
                <input id="novo-fone" {...propsCampoTelefone} className="input-base text-sm num"
                  value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: mascararTelefone(e.target.value) }))} />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-cal-2">Serviço *</p>
              {servicos.length === 0 && (
                <p className="text-xs text-cal-3">
                  Nenhum serviço ativo. Cadastre serviços em Configurações.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Serviço">
                {servicos.map(s => {
                  const ativo = form.servico === s.id
                  return (
                    <button key={s.id} onClick={() => setForm(p => ({
                        ...p, servico: s.id,
                        hora: p.hora && horariosDoForm(s.id).some(h => formatHora(h) === p.hora) ? p.hora : '',
                      }))}
                      role="radio" aria-checked={ativo}
                      className={`marca p-3 rounded-controle text-left border bg-bancada transition-colors ${ativo ? "border-acento-filete" : "border-junta-forte hover:border-latao"}`}
                    >
                      <p className="text-xs font-display font-semibold text-cal">{s.label}</p>
                      <p className="text-xs mt-0.5 num text-cal-3">
                        {formatDuracao(s.duracao)} · {brlCompacto(s.valor)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-cal-2" htmlFor="novo-data">Data *</label>
              <input id="novo-data" type="date" className="input-base text-sm num"
                min={primeiroDiaAgendavel()}
                max={ultimoDiaAgendavel()}
                value={form.data}
                onChange={e => setForm(p => ({ ...p, data: e.target.value, hora: '' }))} />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-cal-2">Horário *</span>
              {slotsModal.length === 0 ? (
                <p className="text-sm text-cal-3">
                  {!form.data      ? 'Escolha uma data primeiro.'
                    : formPassado  ? 'Essa data já passou. Escolha de hoje em diante.'
                    : !hFormDia    ? 'A barbearia não abre neste dia.'
                    : ehHojeForm   ? 'A agenda de hoje já fechou.'
                    :                'Dia totalmente reservado.'}
                </p>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-3 pr-1">
                  {agruparPorPeriodo(slotsModal).map(g => (
                    <div key={g.label}>
                      <p className="regua mb-2">{g.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {g.slots.map(slot => {
                          const h = formatHora(slot)
                          const escolhido = form.hora === h
                          return (
                            <button key={h} type="button" aria-pressed={escolhido}
                              onClick={() => setForm(p => ({ ...p, hora: h }))}
                              className={`px-3.5 py-1.5 rounded-controle text-sm num border transition-colors ${
                                escolhido
                                  ? 'border-acento-filete text-acento-texto bg-elevado font-semibold'
                                  : 'border-junta-forte text-cal bg-bancada hover:border-acento-filete hover:text-acento-texto'
                              }`}
                            >
                              {h}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {horarioFim && (
              <p className="text-xs num text-cal-3">
                Término previsto: {horarioFim}
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-cal-2">Repetir</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Repetir">
                {REPETICOES.map(r => {
                  const ativo = form.repetir === r.valor
                  return (
                    <button key={r.valor} type="button" role="radio" aria-checked={ativo}
                      onClick={() => setForm(p => ({ ...p, repetir: r.valor }))}
                      className={`marca px-3 py-2 rounded-controle text-sm text-left border bg-bancada transition-colors ${ativo ? 'border-acento-filete text-cal' : 'border-junta-forte text-cal-2 hover:border-latao'}`}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
              {form.repetir > 0 && (
                <p className="text-xs text-cal-3">
                  {form.data && form.hora
                    ? `Fica reservado ${descricaoFixo(formDia.getDay(), form.hora, form.repetir)}`
                    : 'Fica reservado no mesmo dia da semana e horário'}
                  , até {MESES_LIMITE_AGENDAMENTO} meses à frente, e renova sozinho. Ninguém consegue marcar por cima.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-cal-2" htmlFor="novo-obs">Observações</label>
              <textarea id="novo-obs" className="input-base text-sm resize-none" rows={2} placeholder="Preferências, alergias..."
                value={form.obs} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} />
            </div>

            <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-6 flex gap-2 border-t bg-bancada border-junta">
              <button className="btn-secondary flex-1 text-sm" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1 text-sm"  onClick={salvar}>
                {form.repetir ? 'Criar horário fixo' : 'Agendar'}
              </button>
            </div>
          </div>
        </CamadaModal>
      )}

      <Modal open={!!pausaEdit} onClose={() => setPausaEdit(null)}
        title={`Almoço de ${diaAtivo.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric' })}`}>
        {pausaEdit && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-cal-2" htmlFor="pausa-inicio">Começa às</label>
              <input id="pausa-inicio" type="time" step={300} className="input-base text-sm num w-[8rem]"
                value={pausaEdit.inicio}
                onChange={e => setPausaEdit(p => ({ ...p, inicio: e.target.value, conflitos: null }))} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-cal-2">Duração</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Duração do almoço">
                {DURACOES_PAUSA.map(d => {
                  const ativo = pausaEdit.minutos === d.minutos
                  return (
                    <button key={d.minutos} type="button" role="radio" aria-checked={ativo}
                      onClick={() => setPausaEdit(p => ({ ...p, minutos: d.minutos, conflitos: null }))}
                      className={`marca px-3.5 py-1.5 rounded-controle text-sm num border bg-bancada transition-colors ${ativo ? 'border-acento-filete text-cal' : 'border-junta-forte text-cal-2 hover:border-latao'}`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {pausaEdit.inicio && (
              <p className="text-xs text-cal-3">
                Os clientes não conseguem marcar das <span className="num">{pausaEdit.inicio}</span> às{' '}
                <span className="num">{somarMinutos(pausaEdit.inicio, pausaEdit.minutos)}</span> neste dia.
              </p>
            )}

            {pausaEdit.conflitos?.length > 0 && (
              <div className="rounded-controle border border-danger bg-danger-fundo p-3 space-y-1">
                <p className="text-sm font-semibold text-danger">Já tem cliente marcado nesse horário:</p>
                {pausaEdit.conflitos.map(a => (
                  <p key={a.id} className="text-sm text-cal">
                    <span className="num">{formatHora(a.data_hora)}</span> · {a.clientes?.nome || '—'}
                  </p>
                ))}
                <p className="text-xs text-cal-2">Ninguém é desmarcado. Escolha outro horário ou salve assim mesmo.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button className="btn-secondary flex-1 text-sm" onClick={() => setPausaEdit(null)}>Cancelar</button>
              {pausaEdit.conflitos?.length > 0
                ? <button className="btn-destrutivo flex-1 text-sm" onClick={() => salvarPausa(true)}>Salvar mesmo assim</button>
                : <button className="btn-primary flex-1 text-sm" onClick={() => salvarPausa()}>Salvar almoço</button>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 border-t border-junta">
              {pausaAtiva.pausa && (
                <button type="button" className="text-apoio text-cal-2 underline underline-offset-2 hover:text-cal pt-3"
                  onClick={() => gravarPausaDia({ inicio: null, minutos: null })}>
                  Sem almoço neste dia
                </button>
              )}
              {pausaAtiva.doDia && (
                <button type="button" className="text-apoio text-cal-2 underline underline-offset-2 hover:text-cal pt-3"
                  onClick={() => gravarPausaDia(null)}>
                  {pausaPadraoDoDia
                    ? `Voltar ao padrão (${pausaPadraoDoDia.inicio} · ${rotuloDuracaoPausa(pausaPadraoDoDia.minutos)})`
                    : 'Voltar ao padrão (sem almoço)'}
                </button>
              )}
            </div>
            <p className="text-xs text-cal-3">
              O almoço de todos os dias fica em Configurações → Horários.
            </p>
          </div>
        )}
      </Modal>

      <Modal open={!!fixo} onClose={() => setFixo(null)} title="Horário fixo">
        {fixo && (
          <div className="space-y-4">
            <p className="text-sm text-cal-2">
              <strong className="text-cal">{fixo.ag.clientes?.nome || '—'}</strong> · {fixo.ag.servico}
            </p>
            <p className="text-sm text-cal">
              {!fixo.dados ? 'Carregando…'
                : fixo.dados.ativo
                  ? `Reservado ${descricaoFixo(new Date(fixo.dados.data_inicio + 'T00:00:00').getDay(), fixo.dados.hora, fixo.dados.intervalo_semanas)}.`
                  : 'Este horário fixo já foi encerrado.'}
            </p>
            <p className="text-xs text-cal-3">
              Para liberar só um dia, cancele aquele agendamento na agenda. Encerrar
              cancela todas as datas futuras deste cliente neste horário.
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 text-sm" onClick={() => setFixo(null)}>Voltar</button>
              {fixo.dados?.ativo && (
                fixo.armado
                  ? <button className="btn-destrutivo flex-1 text-sm" onClick={encerrarFixo}>Confirmar encerramento</button>
                  : <button className="btn-destrutivo flex-1 text-sm" onClick={() => setFixo(f => ({ ...f, armado: true }))}>Encerrar fixo</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmCliente} onClose={() => setConfirmCliente(null)} title="Confirmar cliente">
        <div className="space-y-4">
          <p className="text-sm text-cal-2">
            Este telefone está cadastrado como{' '}
            <strong className="text-cal">{confirmCliente?.nome}</strong>. Agendar para esse cliente?
          </p>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1 text-sm" onClick={() => setConfirmCliente(null)}>Cancelar</button>
            <button className="btn-primary flex-1 text-sm" onClick={confirmarFichaExistente}>Sim, agendar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
