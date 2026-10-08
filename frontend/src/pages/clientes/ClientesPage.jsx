import { useState, useEffect } from 'react'
import { Users, Phone, Mail, MessageCircle, Pencil, Trash2, Search, Plus } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/ui/Modal'
import { Skeleton } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import toast from 'react-hot-toast'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { formatarTelefone, mascararTelefone, telefoneValido, MSG_TELEFONE_INVALIDO, propsCampoTelefone } from '../../lib/telefone'
import PageHeader from '../../components/ui/PageHeader'

const SESSENTA_DIAS_MS = 60 * 24 * 60 * 60 * 1000

function formatarData(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleDateString('pt-BR')
}

function classificar(cliente) {
  const frequente = cliente.totalVisitas >= 3
  const inativa =
    cliente.totalVisitas > 0 &&
    Date.now() - new Date(cliente.ultimaVisita).getTime() > SESSENTA_DIAS_MS
  return { frequente, inativa }
}

async function buscarCarteira(salonId) {
  const { data: clientes, error } = await supabase
    .from('clientes')
    .select('id, nome, telefone, email, criado_em')
    .eq('salon_id', salonId)
    .order('nome')
  if (error) throw error

  const visitas = new Map()
  for (let de = 0; ;) {
    const { data: pagina, error: erroVisitas } = await supabase
      .from('agendamentos')
      .select('cliente_id, data_hora')
      .eq('salon_id', salonId)
      .eq('status', 'confirmado')
      .not('cliente_id', 'is', null)
      .order('data_hora', { ascending: false })
      .order('id')
      .range(de, de + 999)
    if (erroVisitas) throw erroVisitas
    if (pagina.length === 0) break

    for (const ag of pagina) {
      const v = visitas.get(ag.cliente_id)
      if (v) v.total++
      else visitas.set(ag.cliente_id, { total: 1, ultima: ag.data_hora })
    }
    de += pagina.length
  }

  return clientes.map(c => ({
    ...c,
    totalVisitas: visitas.get(c.id)?.total ?? 0,
    ultimaVisita: visitas.get(c.id)?.ultima ?? null,
  }))
}

const ABA = { todas: 'todas', frequentes: 'frequentes', inativas: 'inativas' }
const formVazio = { nome: '', telefone: '', email: '' }

export default function ClientesPage() {
  const { salon } = useAuth()
  const [clientes, setClientes] = useState([])
  const [carregadoDe, setCarregadoDe] = useState(null)
  const [busca, setBusca] = useState('')
  const [aba, setAba] = useState(ABA.todas)

  const confirmacao = useConfirmacao()

  const [modalAberto, setModalAberto] = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [form, setForm] = useState(formVazio)
  const [salvando, setSalvando] = useState(false)

  const salonId = salon?.id
  const loading = !salonId || carregadoDe !== salonId

  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao(v => v + 1)

  useEffect(() => {
    if (!salonId) return
    let cancelado = false
    buscarCarteira(salonId)
      .then(lista => {
        if (cancelado) return
        setClientes(lista)
        setCarregadoDe(salonId)
      })
      .catch(erro => {
        if (cancelado) return
        console.error(erro)
        toast.error('Erro ao carregar clientes. Tente novamente.')
        setClientes([])
        setCarregadoDe(salonId)
      })
    return () => { cancelado = true }
  }, [salonId, versao])

  const clientesFiltrados = clientes.filter((c) => {
    const termo = busca.toLowerCase()
    const termoDigitos = busca.replace(/\D/g, '')
    const buscaOk =
      !termo ||
      c.nome.toLowerCase().includes(termo) ||
      (c.telefone && c.telefone.includes(termo)) ||
      (termoDigitos && c.telefone && c.telefone.replace(/\D/g, '').includes(termoDigitos))

    if (!buscaOk) return false

    const { frequente, inativa } = classificar(c)
    if (aba === ABA.frequentes) return frequente
    if (aba === ABA.inativas) return inativa
    return true
  })

  function abrirNovo() {
    setClienteEditando(null)
    setForm(formVazio)
    setModalAberto(true)
  }

  function abrirEdicao(cliente) {
    setClienteEditando(cliente)
    setForm({ nome: cliente.nome, telefone: mascararTelefone(cliente.telefone), email: cliente.email ?? '' })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setClienteEditando(null)
    setForm(formVazio)
  }

  async function salvar(e) {
    e.preventDefault()
    const nome = form.nome.trim()
    const telefone = form.telefone.trim()
    const email = form.email.trim() || null

    if (!nome || !telefone) return
    if (!telefoneValido(telefone)) { toast.error(MSG_TELEFONE_INVALIDO); return }

    setSalvando(true)

    if (clienteEditando) {
      const { error } = await supabase
        .from('clientes')
        .update({ nome, telefone, email })
        .eq('id', clienteEditando.id)

      if (error) {
        console.error(error)
        toast.error('Erro ao salvar. Tente novamente.')
        setSalvando(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('clientes')
        .insert({ salon_id: salon.id, nome, telefone, email })

      if (error) {
        console.error(error)
        toast.error('Erro ao salvar. Tente novamente.')
        setSalvando(false)
        return
      }
    }

    setSalvando(false)
    fecharModal()
    toast.success('Cliente salvo')
    recarregar()
  }

  async function excluir(cliente) {
    confirmacao.desarmar()

    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id)
    if (error) {
      console.error(error)
      toast.error('Erro ao excluir. Tente novamente.')
      return
    }
    toast.success('Cliente removido.')
    recarregar()
  }

  const abasConfig = [
    { key: ABA.todas, label: 'Todos' },
    { key: ABA.frequentes, label: 'Frequentes' },
    { key: ABA.inativas, label: 'Inativos' },
  ]

  return (
    <div className="p-5 md:p-8 space-y-5">

      <PageHeader
        title="Clientes"
        meta={!loading && `(${clientes.length})`}
        action={
          <button onClick={abrirNovo} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={16} />
            Novo cliente
          </button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cal-3" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-base pl-9"
            aria-label="Buscar cliente"
          />
        </div>

        <div className="flex gap-1 rounded-controle p-1 w-fit border bg-bancada border-junta"
          role="tablist" aria-label="Filtrar clientes">
          {abasConfig.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              role="tab" aria-selected={aba === key}
              className={`px-3.5 py-1.5 text-apoio rounded-controle transition-colors ${aba === key ? "bg-elevado text-acento-texto font-semibold" : "text-cal-2 hover:text-cal"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))
        ) : clientesFiltrados.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Users}
              title="Nenhum cliente encontrado"
              description={busca ? 'Tente outro termo de busca.' : 'Adicione seu primeiro cliente.'}
            />
          </div>
        ) : (
          clientesFiltrados.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              onEditar={() => abrirEdicao(cliente)}
              confirmandoExclusao={confirmacao.armado === cliente.id}
              onPedirExclusao={() => confirmacao.armar(cliente.id)}
              onConfirmarExclusao={() => excluir(cliente)}
            />
          ))
        )}
      </div>

      <Modal
        open={modalAberto}
        onClose={fecharModal}
        title={clienteEditando ? 'Editar cliente' : 'Novo cliente'}
      >
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-cal-2" htmlFor="cli-nome">
              Nome <span className="text-danger">*</span>
            </label>
            <input
              id="cli-nome"
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="input-base"
              placeholder="Nome do cliente"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-cal-2" htmlFor="cli-fone">
              Telefone <span className="text-danger">*</span>
            </label>
            <input
              id="cli-fone"
              {...propsCampoTelefone}
              required
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: mascararTelefone(e.target.value) }))}
              className="input-base num"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-cal-2" htmlFor="cli-email">
              E-mail <span className="font-normal text-cal-3">(opcional)</span>
            </label>
            <input
              id="cli-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input-base"
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={fecharModal} className="btn-secondary flex-1 text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn-primary flex-1 text-sm">
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  )
}

function ClienteCard({ cliente, onEditar, confirmandoExclusao, onPedirExclusao, onConfirmarExclusao }) {
  const { frequente, inativa } = classificar(cliente)
  const inicial = cliente.nome.trim()[0]?.toUpperCase() ?? '?'
  const whatsappUrl = `https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`

  return (
    <div className="card h-full flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sobre-acento font-display text-card shrink-0 bg-acento"
          aria-hidden
        >
          {inicial}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate text-cal">{cliente.nome}</p>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {frequente && (
              <span className="text-xs px-2 py-0.5 rounded-chapa font-medium bg-ok-fundo text-ok">
                Frequente
              </span>
            )}
            {inativa && (
              <span className="text-xs px-2 py-0.5 rounded-chapa font-medium bg-warn-fundo text-warn">
                Inativo
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-sm text-cal-2">
          <Phone size={13} className="shrink-0 text-cal-3" />
          <span className="truncate num">{formatarTelefone(cliente.telefone)}</span>
        </div>
        {cliente.email && (
          <div className="flex items-center gap-1.5 text-sm text-cal-2">
            <Mail size={13} className="shrink-0 text-cal-3" />
            <span className="truncate">{cliente.email}</span>
          </div>
        )}
      </div>

      <div className="text-sm num text-cal-3">
        <span className="font-medium text-cal-2">
          {cliente.totalVisitas} {cliente.totalVisitas === 1 ? 'visita' : 'visitas'}
        </span>
        {' · '}
        {cliente.ultimaVisita
          ? `Última: ${formatarData(cliente.ultimaVisita)}`
          : 'Sem visitas'}
      </div>

      <div className="flex gap-1 pt-2 mt-auto border-t border-junta">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-controle transition-colors text-cal-2 hover:bg-elevado hover:text-ok"
          title="Abrir WhatsApp"
        >
          <MessageCircle size={16} />
        </a>
        <button
          onClick={onEditar}
          className="p-2 rounded-controle transition-colors text-cal-2 hover:bg-elevado hover:text-cal"
          title="Editar cliente"
        >
          <Pencil size={16} />
        </button>
        {confirmandoExclusao ? (
          <button
            onClick={onConfirmarExclusao}
            className="text-xs px-2.5 py-1 rounded-chapa text-cal font-semibold bg-danger-solido"
          >
            Confirmar exclusão
          </button>
        ) : (
          <button
            onClick={onPedirExclusao}
            className="p-2 rounded-controle transition-colors text-cal-2 hover:bg-danger-fundo hover:text-danger"
            title="Excluir cliente"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
