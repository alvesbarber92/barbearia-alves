import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import { Settings, Scissors, Clock, Save, Plus, Trash2, Check, Pencil, ImagePlus, LogOut, Coffee } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import CalendarioMes from '../../components/ui/CalendarioMes'
import Monogram from '../../components/ui/Monogram'
import { brlCompacto, chaveDia, horarioPadrao, TETO_PRECO, MSG_TETO_PRECO, DURACOES_PAUSA, somarMinutos } from '../../lib/agenda'
import { useAccent, COR_PADRAO } from '../../hooks/useAccent'
import { useConfirmacao } from '../../hooks/useConfirmacao'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

const HORARIO_PADRAO = DIAS.map((_, i) => horarioPadrao(i))

const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp']

async function reduzirImagem(arquivo) {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao converter a imagem'))), 'image/webp', 0.9)
  })
}

function caminhoNoBucket(url) {
  const marca = '/storage/v1/object/public/logos/'
  const i = url ? url.indexOf(marca) : -1
  return i >= 0 ? decodeURIComponent(url.slice(i + marca.length)) : null
}

function horaNoDia(dia, hhmm) {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  const d = new Date(dia)
  d.setHours(h, m, 0, 0)
  return d
}

const MODOS_DIA = [
  { modo: 'semana',   rotulo: 'Segue a semana' },
  { modo: 'fechado',  rotulo: 'Fechado' },
  { modo: 'especial', rotulo: 'Horário especial' },
]

const ABAS = [
  { key: 'perfil',    label: 'Perfil',    icon: Settings  },
  { key: 'servicos',  label: 'Serviços',  icon: Scissors  },
  { key: 'horarios',  label: 'Horários',  icon: Clock     },
]

export default function ConfiguracoesPage() {
  const { salon, setSalon, signOut } = useAuth()
  const navigate = useNavigate()
  const [aba, setAba] = useState('perfil')

  const sair = async () => {
    await signOut()
    navigate('/login')
  }

  const [nome, setNome]         = useState('')
  const [cor, setCor]           = useState(COR_PADRAO)
  useAccent(cor)
  const confirmacao = useConfirmacao()
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  const perfilCarregado = useRef(null)
  useEffect(() => {
    if (!salon || perfilCarregado.current === salon.id) return
    perfilCarregado.current = salon.id
    setNome(salon.nome || '')
    setCor(salon.cor_primaria || COR_PADRAO)
  }, [salon])

  function handleCorChange(nova) {
    setCor(nova)
  }

  async function salvarPerfil(e) {
    e.preventDefault()
    if (!salon?.id) return
    setSalvandoPerfil(true)
    const { error } = await supabase
      .from('salons')
      .update({ nome: nome.trim(), cor_primaria: cor })
      .eq('id', salon.id)

    if (error) {
      toast.error('Erro ao salvar. Tente novamente.')
    } else {
      setSalon({ ...salon, nome: nome.trim(), cor_primaria: cor })
      toast.success('Salvo!')
    }
    setSalvandoPerfil(false)
  }

  const inputLogoRef = useRef(null)
  const [enviandoLogo, setEnviandoLogo] = useState(false)

  async function enviarLogo(e) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo || !salon?.id) return
    if (!TIPOS_LOGO.includes(arquivo.type)) {
      toast.error('Use uma imagem PNG, JPG ou WebP.')
      return
    }
    setEnviandoLogo(true)
    try {
      const blob = await reduzirImagem(arquivo)
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
      const caminho = `${salon.id}/logo-${Date.now()}.${ext}`
      const { error: erroEnvio } = await supabase.storage.from('logos').upload(caminho, blob, { contentType: blob.type, cacheControl: '31536000' })
      if (erroEnvio) throw erroEnvio

      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(caminho)
      const { error: erroSalao } = await supabase.from('salons').update({ logo_url: publicUrl }).eq('id', salon.id)
      if (erroSalao) {
        await supabase.storage.from('logos').remove([caminho])
        throw erroSalao
      }

      const anterior = caminhoNoBucket(salon.logo_url)
      setSalon({ ...salon, logo_url: publicUrl })
      if (anterior) supabase.storage.from('logos').remove([anterior])
      toast.success('Logo atualizado!')
    } catch (err) {
      console.error('[logo]', err)
      toast.error('Não foi possível enviar a imagem.')
    } finally {
      setEnviandoLogo(false)
    }
  }

  async function removerLogo() {
    if (!salon?.id || !salon.logo_url) return
    setEnviandoLogo(true)
    const anterior = caminhoNoBucket(salon.logo_url)
    const { error } = await supabase.from('salons').update({ logo_url: null }).eq('id', salon.id)
    setEnviandoLogo(false)
    if (error) {
      toast.error('Erro ao remover o logo.')
      return
    }
    setSalon({ ...salon, logo_url: null })
    if (anterior) supabase.storage.from('logos').remove([anterior])
    toast.success('Logo removido')
  }

  const [servicos, setServicos]       = useState([])
  const [servicosDe, setServicosDe]   = useState(null)
  const loadingServicos = !salon?.id || servicosDe !== salon.id
  const [novoNome, setNovoNome]       = useState('')
  const [novoPreco, setNovoPreco]     = useState('')
  const [novoDuracao, setNovoDuracao] = useState('60')
  const [adicionando, setAdicionando] = useState(false)

  const [versaoServicos, setVersaoServicos] = useState(0)
  const recarregarServicos = () => setVersaoServicos(v => v + 1)

  useEffect(() => {
    const salonId = salon?.id
    if (!salonId) return
    let cancelado = false
    supabase
      .from('servicos')
      .select('*')
      .eq('salon_id', salonId)
      .order('nome')
      .then(({ data }) => {
        if (cancelado) return
        setServicos(data || [])
        setServicosDe(salonId)
      })
    return () => { cancelado = true }
  }, [salon?.id, versaoServicos])

  async function adicionarServico(e) {
    e.preventDefault()
    if (!novoNome.trim()) return
    if (parseFloat(novoPreco) > TETO_PRECO) { toast.error(MSG_TETO_PRECO); return }
    setAdicionando(true)
    const { error } = await supabase.from('servicos').insert({
      salon_id:    salon.id,
      nome:        novoNome.trim(),
      preco:       parseFloat(novoPreco) || 0,
      duracao: parseInt(novoDuracao) || 60,
      ativo:       true,
    })
    if (error) {
      toast.error('Erro ao adicionar serviço.')
    } else {
      setNovoNome('')
      setNovoPreco('')
      setNovoDuracao('60')
      recarregarServicos()
      toast.success('Serviço adicionado!')
    }
    setAdicionando(false)
  }

  async function toggleServico(s) {
    const { error } = await supabase
      .from('servicos')
      .update({ ativo: !s.ativo })
      .eq('id', s.id)
    if (!error) recarregarServicos()
  }

  async function excluirServico(s) {
    confirmacao.desarmar()
    const { error } = await supabase.from('servicos').delete().eq('id', s.id)
    if (error) {
      toast.error('Erro ao excluir.')
    } else {
      recarregarServicos()
      toast.success('Serviço removido.')
    }
  }

  const [servicoEditando, setServicoEditando] = useState(null)
  const [editNome, setEditNome]       = useState('')
  const [editPreco, setEditPreco]     = useState('')
  const [editDuracao, setEditDuracao] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  function abrirEdicao(s) {
    setServicoEditando(s)
    setEditNome(s.nome)
    setEditPreco(String(s.preco ?? ''))
    setEditDuracao(String(s.duracao ?? 60))
  }

  function fecharEdicao() {
    setServicoEditando(null)
  }

  async function salvarEdicao(e) {
    e.preventDefault()
    if (!editNome.trim()) return
    if (parseFloat(editPreco) > TETO_PRECO) { toast.error(MSG_TETO_PRECO); return }
    setSalvandoEdicao(true)
    const { error } = await supabase
      .from('servicos')
      .update({
        nome:    editNome.trim(),
        preco:   parseFloat(editPreco) || 0,
        duracao: parseInt(editDuracao) || 60,
      })
      .eq('id', servicoEditando.id)

    if (error) {
      toast.error('Erro ao salvar.')
    } else {
      recarregarServicos()
      fecharEdicao()
      toast.success('Serviço atualizado!')
    }
    setSalvandoEdicao(false)
  }

  const [horarios, setHorarios]             = useState(HORARIO_PADRAO)
  const [loadingHorarios, setLoadingHorarios] = useState(true)
  const [salvandoHorarios, setSalvandoHorarios] = useState(false)
  const [pausaPadrao, setPausaPadrao] = useState({ ativa: false, inicio: '11:30', minutos: 60 })
  const [conflitosPausa, setConflitosPausa] = useState(null)

  useEffect(() => {
    if (!salon?.id) return
    supabase
      .from('horarios')
      .select('*')
      .eq('salon_id', salon.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setHorarios(
            HORARIO_PADRAO.map(pad => {
              const salvo = data.find(h => h.dia_semana === pad.dia_semana)
              return salvo
                ? { dia_semana: salvo.dia_semana, abertura: salvo.abertura?.slice(0, 5) || '09:00', fechamento: salvo.fechamento?.slice(0, 5) || '18:00', ativo: salvo.ativo }
                : pad
            })
          )
          const comPausa = data.find(h => h.pausa_inicio)
          if (comPausa) {
            setPausaPadrao({ ativa: true, inicio: comPausa.pausa_inicio.slice(0, 5), minutos: comPausa.pausa_minutos })
          }
        }
        setLoadingHorarios(false)
      })
  }, [salon?.id])

  function setHorarioDia(diaIdx, campo, valor) {
    setHorarios(prev => prev.map(h => h.dia_semana === diaIdx ? { ...h, [campo]: valor } : h))
  }

  async function conflitosDoAlmoco() {
    if (!pausaPadrao.ativa) return []
    const agora = new Date()
    const [{ data: ags }, { data: proprios }] = await Promise.all([
      supabase.from('agendamentos').select('id, data_hora, duracao, clientes(nome)')
        .eq('salon_id', salon.id).neq('status', 'cancelado')
        .gte('data_hora', agora.toISOString()).order('data_hora'),
      supabase.from('pausas_dia').select('data').eq('salon_id', salon.id).gte('data', chaveDia(agora)),
    ])
    const comAlmocoProprio = new Set((proprios || []).map(p => p.data))
    const [h, m] = pausaPadrao.inicio.split(':').map(Number)
    return (ags || []).filter(a => {
      const s = new Date(a.data_hora)
      if (comAlmocoProprio.has(chaveDia(s))) return false
      if (!horarios.find(x => x.dia_semana === s.getDay())?.ativo) return false
      const ini = new Date(s); ini.setHours(h, m, 0, 0)
      const fim = new Date(ini.getTime() + pausaPadrao.minutos * 60000)
      const e = new Date(s.getTime() + (a.duracao ?? 30) * 60000)
      return s < fim && e > ini
    })
  }

  async function salvarHorarios(mesmoAssim = false) {
    if (!salon?.id) return
    setSalvandoHorarios(true)
    if (!mesmoAssim) {
      const conflitos = await conflitosDoAlmoco()
      if (conflitos.length > 0) {
        setConflitosPausa(conflitos)
        setSalvandoHorarios(false)
        return
      }
    }
    setConflitosPausa(null)
    const rows = horarios.map(h => ({
      salon_id:   salon.id,
      dia_semana: h.dia_semana,
      abertura:   h.abertura,
      fechamento: h.fechamento,
      ativo:      h.ativo,
      pausa_inicio:  pausaPadrao.ativa ? pausaPadrao.inicio : null,
      pausa_minutos: pausaPadrao.ativa ? pausaPadrao.minutos : null,
    }))
    const { error } = await supabase
      .from('horarios')
      .upsert(rows, { onConflict: 'salon_id,dia_semana' })

    if (error) {
      toast.error('Erro ao salvar horários.')
    } else {
      toast.success('Horários salvos!')
    }
    setSalvandoHorarios(false)
  }

  const [especiais, setEspeciais]     = useState({})
  const [agendPorDia, setAgendPorDia] = useState({})
  const [mesCal, setMesCal]           = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() } })
  const [selecao, setSelecao]         = useState([])
  const [formDia, setFormDia]         = useState({ modo: 'semana', abertura: '09:00', fechamento: '18:00' })
  const [salvandoDia, setSalvandoDia] = useState(false)

  useEffect(() => {
    if (!salon?.id) return
    const desde = new Date(); desde.setDate(desde.getDate() - 31)
    supabase
      .from('dias_especiais')
      .select('data, fechado, abertura, fechamento')
      .eq('salon_id', salon.id)
      .gte('data', chaveDia(desde))
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(d => { map[d.data] = d })
        setEspeciais(map)
      })
  }, [salon?.id])

  useEffect(() => {
    if (!salon?.id) return
    const inicio = new Date(mesCal.ano, mesCal.mes, 1); inicio.setDate(inicio.getDate() - 7)
    const fim    = new Date(mesCal.ano, mesCal.mes + 1, 1); fim.setDate(fim.getDate() + 7)
    supabase
      .from('agendamentos')
      .select('data_hora, duracao')
      .eq('salon_id', salon.id)
      .neq('status', 'cancelado')
      .gte('data_hora', inicio.toISOString())
      .lt('data_hora', fim.toISOString())
      .then(({ data }) => {
        const map = {}
        for (const a of data || []) {
          const ini = new Date(a.data_hora)
          const k = chaveDia(ini)
          if (!map[k]) map[k] = []
          map[k].push({ inicio: ini, fim: new Date(ini.getTime() + (a.duracao ?? 30) * 60000) })
        }
        setAgendPorDia(map)
      })
  }, [salon?.id, mesCal.ano, mesCal.mes])

  function formDoDia(dia) {
    const esp = especiais[chaveDia(dia)]
    const semana = horarios.find(h => h.dia_semana === dia.getDay())
    const base = esp && !esp.fechado ? esp : semana
    return {
      modo: esp ? (esp.fechado ? 'fechado' : 'especial') : 'semana',
      abertura: (base?.abertura || '09:00').slice(0, 5),
      fechamento: (base?.fechamento || '18:00').slice(0, 5),
    }
  }

  function alternarDia(d) {
    const dia = new Date(d); dia.setHours(0, 0, 0, 0)
    const k = chaveDia(dia)
    const nova = selecao.includes(k) ? selecao.filter(x => x !== k) : [...selecao, k].sort()
    setSelecao(nova)
    if (selecao.length === 0 && nova.length === 1) setFormDia(formDoDia(dia))
  }

  function selecionarMesTodo() {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const ultimo = new Date(mesCal.ano, mesCal.mes + 1, 0).getDate()
    const dias = []
    for (let i = 1; i <= ultimo; i++) {
      const d = new Date(mesCal.ano, mesCal.mes, i)
      if (d >= hoje) dias.push(chaveDia(d))
    }
    if (selecao.length === 0 && dias.length) {
      setFormDia(formDoDia(new Date(dias[0] + 'T00:00:00')))
    }
    setSelecao(prev => [...new Set([...prev, ...dias])].sort())
  }

  const trocarMesCal = (delta) => setMesCal(({ ano, mes }) => {
    const d = new Date(ano, mes + delta, 1)
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })

  const hojeZero = new Date(); hojeZero.setHours(0, 0, 0, 0)
  const diaUnico = selecao.length === 1 ? new Date(selecao[0] + 'T00:00:00') : null
  const semanaSel = diaUnico ? horarios.find(h => h.dia_semana === diaUnico.getDay()) : null
  const agendAfetados = selecao.flatMap(k => {
    const doDia = agendPorDia[k] || []
    if (formDia.modo === 'fechado') return doDia
    if (formDia.modo !== 'especial') return []
    const dia = new Date(k + 'T00:00:00')
    return doDia.filter(a => a.inicio < horaNoDia(dia, formDia.abertura) || a.fim > horaNoDia(dia, formDia.fechamento))
  })

  const contagensCal = Object.fromEntries(Object.entries(agendPorDia).map(([k, v]) => [k, v.length]))
  const estadosCal = Object.fromEntries(
    Object.values(especiais).map(e => [e.data, e.fechado ? 'fechado' : 'especial'])
  )

  async function salvarDiasEspeciais() {
    if (!salon?.id || selecao.length === 0) return
    if (formDia.modo === 'especial' && formDia.fechamento <= formDia.abertura) {
      toast.error('O fechamento precisa ser depois da abertura.')
      return
    }
    setSalvandoDia(true)
    const linhas = formDia.modo === 'semana' ? null : selecao.map(data => ({
      salon_id:   salon.id,
      data,
      fechado:    formDia.modo === 'fechado',
      abertura:   formDia.modo === 'especial' ? formDia.abertura : null,
      fechamento: formDia.modo === 'especial' ? formDia.fechamento : null,
    }))
    const { error } = linhas
      ? await supabase.from('dias_especiais').upsert(linhas, { onConflict: 'salon_id,data' })
      : await supabase.from('dias_especiais').delete().eq('salon_id', salon.id).in('data', selecao)
    setSalvandoDia(false)

    if (error) {
      toast.error(selecao.length > 1 ? 'Erro ao salvar os dias.' : 'Erro ao salvar o dia.')
      return
    }
    setEspeciais(prev => {
      const map = { ...prev }
      if (linhas) linhas.forEach(l => { map[l.data] = l })
      else selecao.forEach(k => delete map[k])
      return map
    })
    const n = agendAfetados.length
    const quantos = selecao.length > 1 ? `${selecao.length} dias salvos.` : 'Dia salvo.'
    toast.success(n > 0
      ? `${quantos} ${n} agendamento${n > 1 ? 's continuam marcados' : ' continua marcado'}.`
      : quantos)
    setSelecao([])
  }

  return (
    <div className="p-5 md:p-8 space-y-5">

      <PageHeader title="Configurações" subtitle="Gerencie sua barbearia" />

      <div className="flex gap-0 border-b border-junta-forte">
        {ABAS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-apoio transition-colors relative ${aba === key ? "font-semibold text-acento-texto" : "text-cal-2 hover:text-cal"}`}
          >
            <Icon size={15} />
            {label}
            {aba === key && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-chapa bg-acento-marca"
              />
            )}
          </button>
        ))}
      </div>

      {aba === 'perfil' && (
        <div className="card max-w-lg">
          <h2 className="text-base font-semibold mb-4 text-cal">Perfil da Barbearia</h2>
          <form onSubmit={salvarPerfil} className="space-y-4">
            <div className="space-y-2">
              <span className="text-sm font-medium text-cal-2">Logo</span>
              <div className="flex items-center gap-4">
                <Monogram nome={nome || salon?.nome} logoUrl={salon?.logo_url} size="lg" />
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => inputLogoRef.current?.click()}
                      disabled={enviandoLogo}
                      className="btn-secondary"
                    >
                      <ImagePlus size={15} />
                      {enviandoLogo ? 'Enviando…' : salon?.logo_url ? 'Trocar imagem' : 'Enviar imagem'}
                    </button>
                    {salon?.logo_url && (
                      <button
                        type="button"
                        onClick={removerLogo}
                        disabled={enviandoLogo}
                        className="flex items-center gap-1.5 text-apoio rounded-controle px-2 py-1 transition-colors text-cal-2 hover:bg-danger-fundo hover:text-danger"
                      >
                        <Trash2 size={14} /> Remover
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-cal-3">
                    PNG, JPG ou WebP. Imagem quadrada fica melhor. Aparece no painel, na vitrine e no agendamento.
                  </p>
                </div>
              </div>
              <input
                ref={inputLogoRef}
                type="file"
                accept={TIPOS_LOGO.join(',')}
                onChange={enviarLogo}
                hidden
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-cal-2">
                Nome da barbearia
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="input-base"
                placeholder="Nome da sua barbearia"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-cal-2">
                Cor primária
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={cor}
                  onChange={e => handleCorChange(e.target.value)}
                  className="w-10 h-10 rounded-chapa cursor-pointer border border-junta-forte p-0.5 bg-bancada"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={cor}
                    onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleCorChange(e.target.value) }}
                    className="input-base tracking-wide"
                    placeholder={COR_PADRAO}
                    maxLength={7}
                  />
                </div>
                <div
                  className="w-10 h-10 rounded-chapa flex-shrink-0 border border-junta-forte"
                  style={{ backgroundColor: cor }}
                  title="Preview"
                />
              </div>
              <p className="text-xs text-cal-3">
                A cor é aplicada em tempo real na interface.
              </p>
            </div>

            <button
              type="submit"
              disabled={salvandoPerfil}
              className="btn-primary flex items-center gap-2"
            >
              <Save size={15} />
              {salvandoPerfil ? 'Salvando…' : 'Salvar'}
            </button>
          </form>
        </div>
      )}

      {aba === 'servicos' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-base font-semibold mb-4 text-cal">
              Adicionar serviço
            </h2>
            <form onSubmit={adicionarServico} className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1 flex-1 min-w-36">
                <label className="text-xs font-medium text-cal-2">Nome</label>
                <input
                  type="text"
                  required
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  className="input-base"
                  placeholder="Ex: Corte, Barba…"
                />
              </div>
              <div className="space-y-1 w-28">
                <label className="text-xs font-medium text-cal-2">Preço (R$)</label>
                <input
                  type="number"
                  min="0"
                  max="99999.99"
                  step="0.01"
                  value={novoPreco}
                  onChange={e => setNovoPreco(e.target.value)}
                  className="input-base"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1 w-28">
                <label className="text-xs font-medium text-cal-2">Duração (min)</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={novoDuracao}
                  onChange={e => setNovoDuracao(e.target.value)}
                  className="input-base"
                  placeholder="60"
                />
              </div>
              <button
                type="submit"
                disabled={adicionando}
                className="btn-primary flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus size={15} />
                {adicionando ? 'Adicionando…' : 'Adicionar'}
              </button>
            </form>
          </div>

          <Modal open={!!servicoEditando} onClose={fecharEdicao} title="Editar serviço">
            <form onSubmit={salvarEdicao} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-cal-2">Nome</label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  className="input-base"
                  placeholder="Nome do serviço"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-sm font-medium text-cal-2">Preço (R$)</label>
                  <input
                    type="number"
                    min="0"
                    max="99999.99"
                    step="0.01"
                    value={editPreco}
                    onChange={e => setEditPreco(e.target.value)}
                    className="input-base"
                    placeholder="0,00"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-sm font-medium text-cal-2">Duração (min)</label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={editDuracao}
                    onChange={e => setEditDuracao(e.target.value)}
                    className="input-base"
                    placeholder="60"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={fecharEdicao} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoEdicao} className="btn-primary flex items-center gap-2">
                  <Save size={14} />
                  {salvandoEdicao ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </Modal>

          <div className="card">
            <h2 className="text-base font-semibold mb-4 text-cal">
              Serviços cadastrados
            </h2>

            {loadingServicos ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 rounded-controle animate-pulse bg-elevado" />
                ))}
              </div>
            ) : servicos.length === 0 ? (
              <p className="text-sm py-4 text-center text-cal-3">
                Nenhum serviço cadastrado. Adicione um serviço acima.
              </p>
            ) : (
              <div className="space-y-2">
                {servicos.map(s => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-controle transition-colors bg-elevado"
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-corpo font-semibold truncate ${s.ativo ? "text-cal" : "text-cal-3 line-through"}`}>
                        {s.nome}
                      </p>
                      <p className="text-xs text-cal-3">
                        {brlCompacto(s.preco)} · {s.duracao} min
                      </p>
                    </div>

                    <button
                      onClick={() => abrirEdicao(s)}
                      className="p-1.5 rounded-controle transition-colors text-cal-2 hover:bg-elevado hover:text-cal"
                      title="Editar serviço"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      onClick={() => toggleServico(s)}
                      className={`flex items-center gap-1 text-micro font-semibold px-2.5 py-1 rounded-chapa border transition-colors ${s.ativo ? "bg-acento/15 text-acento-texto border-acento-filete" : "bg-concreto text-cal-2 border-junta-forte"}`}
                      title={s.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <Check size={11} />
                      {s.ativo ? 'Ativo' : 'Inativo'}
                    </button>

                    {confirmacao.armado === s.id ? (
                      <button
                        onClick={() => excluirServico(s)}
                        className="text-micro px-2.5 py-1 rounded-chapa text-cal font-semibold whitespace-nowrap bg-danger-solido"
                      >
                        Confirmar exclusão
                      </button>
                    ) : (
                      <button
                        onClick={() => confirmacao.armar(s.id)}
                        className="p-1.5 rounded-controle transition-colors text-cal-2 hover:bg-danger-fundo hover:text-danger"
                        title="Excluir serviço"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {aba === 'horarios' && (
        <div className="card max-w-lg">
          <h2 className="text-base font-semibold mb-4 text-cal">
            Horários de funcionamento
          </h2>

          {loadingHorarios ? (
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-10 rounded-controle animate-pulse bg-elevado" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {horarios.map(h => (
                <div key={h.dia_semana} className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none w-20 flex-shrink-0">
                    <div
                      onClick={() => setHorarioDia(h.dia_semana, 'ativo', !h.ativo)}
                      className={`w-9 h-5 rounded-controle relative transition-colors cursor-pointer flex-shrink-0 border border-junta-forte ${h.ativo ? 'bg-acento-marca' : 'bg-elevado'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-chapa transition-all ${h.ativo ? 'left-[calc(100%-1.125rem)] bg-sobre-acento' : 'left-px bg-cal-2'}`}
                      />
                    </div>
                    <span className={`text-apoio font-semibold w-8 flex-shrink-0 ${h.ativo ? "text-cal" : "text-cal-3"}`}>
                      {DIAS[h.dia_semana]}
                    </span>
                  </label>

                  {h.ativo ? (
                    <div className="flex items-center gap-2 flex-1 min-w-[15rem]">
                      <input
                        type="time"
                        value={h.abertura}
                        onChange={e => setHorarioDia(h.dia_semana, 'abertura', e.target.value)}
                        className="input-base num flex-1 min-w-0 sm:flex-none sm:w-[7.5rem]"
                      />
                      <span className="text-xs flex-shrink-0 text-cal-3">até</span>
                      <input
                        type="time"
                        value={h.fechamento}
                        onChange={e => setHorarioDia(h.dia_semana, 'fechamento', e.target.value)}
                        className="input-base num flex-1 min-w-0 sm:flex-none sm:w-[7.5rem]"
                      />
                    </div>
                  ) : (
                    <span className="text-sm flex-1 text-cal-3">Fechado</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loadingHorarios && (
            <div className="mt-5 pt-4 border-t border-junta-forte space-y-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => { setPausaPadrao(p => ({ ...p, ativa: !p.ativa })); setConflitosPausa(null) }}
                  className={`w-9 h-5 rounded-controle relative transition-colors cursor-pointer flex-shrink-0 border border-junta-forte ${pausaPadrao.ativa ? 'bg-acento-marca' : 'bg-elevado'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-chapa transition-all ${pausaPadrao.ativa ? 'left-[calc(100%-1.125rem)] bg-sobre-acento' : 'left-px bg-cal-2'}`}
                  />
                </div>
                <Coffee size={15} className="text-cal-2" aria-hidden="true" />
                <span className="text-sm font-semibold text-cal">Almoço todos os dias</span>
              </label>

              {pausaPadrao.ativa && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-cal-3">Começa às</span>
                    <input
                      type="time" step={300}
                      value={pausaPadrao.inicio}
                      onChange={e => { setPausaPadrao(p => ({ ...p, inicio: e.target.value })); setConflitosPausa(null) }}
                      className="input-base num w-[7.5rem]"
                      aria-label="Início do almoço"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Duração do almoço">
                    {DURACOES_PAUSA.map(d => {
                      const ativo = pausaPadrao.minutos === d.minutos
                      return (
                        <button key={d.minutos} type="button" role="radio" aria-checked={ativo}
                          onClick={() => { setPausaPadrao(p => ({ ...p, minutos: d.minutos })); setConflitosPausa(null) }}
                          className={`marca px-3.5 py-1.5 rounded-controle text-sm num border bg-bancada transition-colors ${ativo ? 'border-acento-filete text-cal' : 'border-junta-forte text-cal-2 hover:border-latao'}`}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                  {pausaPadrao.inicio && (
                    <p className="text-xs text-cal-3">
                      Os clientes não conseguem marcar das <span className="num">{pausaPadrao.inicio}</span> às{' '}
                      <span className="num">{somarMinutos(pausaPadrao.inicio, pausaPadrao.minutos)}</span>.
                      Para mudar só um dia, use "Almoço" na Agenda daquele dia.
                    </p>
                  )}
                </>
              )}

              {conflitosPausa?.length > 0 && (
                <div className="rounded-controle border border-danger bg-danger-fundo p-3 space-y-1">
                  <p className="text-sm font-semibold text-danger">
                    {conflitosPausa.length === 1 ? 'Um cliente já está marcado' : `${conflitosPausa.length} clientes já estão marcados`} no horário do almoço:
                  </p>
                  {conflitosPausa.slice(0, 6).map(a => (
                    <p key={a.id} className="text-sm text-cal num">
                      {new Date(a.data_hora).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}{' '}
                      {new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {a.clientes?.nome || '—'}
                    </p>
                  ))}
                  {conflitosPausa.length > 6 && <p className="text-xs text-cal-2">e mais {conflitosPausa.length - 6}.</p>}
                  <p className="text-xs text-cal-2">Ninguém é desmarcado. Escolha outro horário ou salve assim mesmo.</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-junta-forte">
            {conflitosPausa?.length > 0 ? (
              <button
                onClick={() => salvarHorarios(true)}
                disabled={salvandoHorarios || loadingHorarios}
                className="btn-destrutivo flex items-center gap-2"
              >
                <Save size={15} />
                {salvandoHorarios ? 'Salvando…' : 'Salvar mesmo assim'}
              </button>
            ) : (
              <button
                onClick={() => salvarHorarios()}
                disabled={salvandoHorarios || loadingHorarios}
                className="btn-primary flex items-center gap-2"
              >
                <Save size={15} />
                {salvandoHorarios ? 'Salvando…' : 'Salvar horários'}
              </button>
            )}
          </div>
        </div>
      )}

      {aba === 'horarios' && !loadingHorarios && (
        <section className="space-y-3 max-w-3xl">
          <div>
            <h2 className="font-display text-card">Dias especiais</h2>
            <p className="text-apoio text-cal-2 mt-0.5">
              Feche um feriado ou mude o horário de uma data. Toque nos dias no
              calendário — pode marcar vários e salvar todos de uma vez.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="space-y-2">
              <CalendarioMes
                ano={mesCal.ano}
                mes={mesCal.mes}
                selecionados={selecao}
                contagens={contagensCal}
                estados={estadosCal}
                de={chaveDia(hojeZero)}
                onSelecionar={alternarDia}
                onTrocarMes={trocarMesCal}
              />
              <div className="flex items-center gap-3">
                <button onClick={selecionarMesTodo}
                  className="text-apoio font-semibold underline underline-offset-2 text-cal-2 hover:text-acento-texto">
                  Mês todo
                </button>
                {selecao.length > 0 && (
                  <button onClick={() => setSelecao([])}
                    className="text-apoio font-semibold underline underline-offset-2 text-cal-2 hover:text-acento-texto">
                    Limpar ({selecao.length})
                  </button>
                )}
              </div>
              <p className="text-micro text-cal-2">
                <span className="line-through">riscado</span>: fechado · <span className="text-warn">âmbar</span>: horário especial · ponto: tem agendamento
              </p>
            </div>

            <div className="card flex-1 min-w-0 space-y-4">
              {selecao.length === 0 ? (
                <p className="text-apoio text-cal-2">Escolha um ou mais dias no calendário.</p>
              ) : (
                <>
                  <div>
                    <h3 className="font-display text-card first-letter:uppercase">
                      {diaUnico
                        ? diaUnico.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                        : `${selecao.length} dias selecionados`}
                    </h3>
                    <p className="text-apoio text-cal-2 mt-0.5">
                      {diaUnico
                        ? (semanaSel?.ativo
                            ? <>Pela semana: <span className="num">{semanaSel.abertura} até {semanaSel.fechamento}</span></>
                            : 'Pela semana: fechado')
                        : 'O que você escolher vale para todos eles.'}
                    </p>
                  </div>

                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Como fica este dia">
                        {MODOS_DIA.map(({ modo, rotulo }) => {
                          const ativo = formDia.modo === modo
                          return (
                            <button
                              key={modo}
                              type="button"
                              role="radio"
                              aria-checked={ativo}
                              onClick={() => setFormDia(f => ({ ...f, modo }))}
                              className={`marca px-3.5 py-2 rounded-controle text-apoio border bg-bancada transition-colors ${ativo ? 'border-acento-filete text-cal font-semibold' : 'border-junta-forte text-cal-2 hover:border-latao hover:text-cal'}`}
                            >
                              {rotulo}
                            </button>
                          )
                        })}
                      </div>

                      {formDia.modo === 'especial' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            aria-label="Abertura"
                            value={formDia.abertura}
                            onChange={e => setFormDia(f => ({ ...f, abertura: e.target.value }))}
                            className="input-base num w-[7.5rem]"
                          />
                          <span className="text-apoio flex-shrink-0 text-cal-3">até</span>
                          <input
                            type="time"
                            aria-label="Fechamento"
                            value={formDia.fechamento}
                            onChange={e => setFormDia(f => ({ ...f, fechamento: e.target.value }))}
                            className="input-base num w-[7.5rem]"
                          />
                        </div>
                      )}

                      {agendAfetados.length > 0 && (
                        <p className="text-apoio rounded-controle px-3 py-2 bg-warn-fundo text-warn" role="status">
                          {formDia.modo === 'fechado'
                            ? `${selecao.length > 1 ? 'Esses dias têm' : 'Este dia tem'} ${agendAfetados.length} agendamento${agendAfetados.length > 1 ? 's' : ''}.`
                            : `${agendAfetados.length} agendamento${agendAfetados.length > 1 ? 's ficam' : ' fica'} fora desse horário.`}
                          {agendAfetados.length > 1
                            ? ' Eles continuam marcados; avise os clientes se precisar.'
                            : ' Ele continua marcado; avise o cliente se precisar.'}
                        </p>
                      )}

                      <button
                        onClick={salvarDiasEspeciais}
                        disabled={salvandoDia}
                        className="btn-secondary"
                      >
                        {salvandoDia ? 'Salvando…'
                          : selecao.length > 1 ? `Salvar os ${selecao.length} dias`
                          : 'Salvar este dia'}
                      </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="md:hidden pt-2">
        <button
          onClick={sair}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-controle text-apoio font-semibold transition-colors text-cal-2 hover:text-danger hover:bg-danger-fundo"
        >
          <LogOut size={16} />
          Sair da conta
        </button>
      </div>

    </div>
  )
}
