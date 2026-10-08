import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import PageHeader from '../../components/ui/PageHeader'
import { supabase } from '../../lib/supabase'
import { Skeleton, SkeletonCard } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import PainelConvites from './PainelConvites'
import { Eye, LogOut, Search, Store, X } from 'lucide-react'
import toast from 'react-hot-toast'

const MODULOS = {
  agendamento_online: 'Agendamento online',
  estoque:            'Estoque',
  financeiro:         'Financeiro',
}

const ORDEM_MODULOS = ['agendamento_online', 'estoque', 'financeiro']

function formatarData(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatarDataHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fraseAuditoria(ev) {
  const modulo = MODULOS[ev.detalhe?.modulo] || ev.detalhe?.modulo || 'Módulo'
  switch (ev.acao) {
    case 'modulo_habilitado':   return `${modulo} habilitado`
    case 'modulo_desabilitado': return `${modulo} desabilitado`
    case 'salao_ativado':       return 'Barbearia ativada'
    case 'salao_desativado':    return 'Barbearia desativada'
    case 'observacao_iniciada': return 'Painel aberto pela plataforma'
    case 'observacao_encerrada':return 'Painel fechado pela plataforma'
    default:                    return ev.acao
  }
}

function AvatarSalao({ nome, logoUrl }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
  }
  return (
    <span aria-hidden="true"
      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-display text-sobre-acento bg-acento">
      {(nome || 'S').trim().charAt(0).toUpperCase()}
    </span>
  )
}

function SeloSituacao({ ativo }) {
  return (
    <span className={`text-micro px-2.5 py-0.5 rounded-chapa font-semibold flex-shrink-0 ${ativo ? "bg-ok-fundo text-ok" : "bg-danger-fundo text-danger"}`}>
      {ativo ? 'Ativa' : 'Desativada'}
    </span>
  )
}

function Toggle({ ligado, pendente, onClick, rotulo }) {
  return (
    <button type="button" onClick={onClick} disabled={pendente}
      aria-pressed={ligado} aria-label={rotulo}
      className={`relative w-10 h-6 rounded-controle flex-shrink-0 border-none cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${ligado ? 'bg-ok' : 'bg-danger-solido'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-chapa bg-cal transition-all ${ligado ? 'left-[1.125rem]' : 'left-[0.125rem]'}`} />
    </button>
  )
}

export default function AdminPage() {
  const { signOut } = useAuth()
  const [saloes, setSaloes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [auditoria, setAuditoria] = useState([])
  const [auditoriaCarregando, setAuditoriaCarregando] = useState(false)
  const [pendentes, setPendentes] = useState(() => new Set())
  const [confirmandoDesativar, setConfirmandoDesativar] = useState(false)

  useEffect(() => {
    supabase.rpc('admin_listar_saloes').then(({ data, error }) => {
      if (error) toast.error('Não foi possível carregar as barbearias.')
      setSaloes(data || [])
      setCarregando(false)
    })
  }, [])

  const selecionado = useMemo(
    () => saloes.find(s => s.id === selecionadoId) || null,
    [saloes, selecionadoId]
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return saloes
    return saloes.filter(s =>
      [s.nome, s.slug, s.dono_email].some(v => (v || '').toLowerCase().includes(q))
    )
  }, [saloes, busca])

  const carregarAuditoria = useCallback((salonId) => {
    setAuditoriaCarregando(true)
    supabase.rpc('admin_auditoria_salao', { p_salon_id: salonId, p_limite: 20 })
      .then(({ data, error }) => {
        if (error) toast.error('Não foi possível carregar o histórico.')
        setAuditoria(data || [])
        setAuditoriaCarregando(false)
      })
  }, [])

  const abrirSalao = (id) => {
    setSelecionadoId(id)
    setConfirmandoDesativar(false)
    setAuditoria([])
    carregarAuditoria(id)
  }

  const observarSalao = async (id) => {
    const { data: slug, error } = await supabase.rpc('admin_observar_salao', { p_salon_id: id })
    if (error) { toast.error('Não foi possível abrir o painel desta barbearia.'); return }
    window.location.href = `/${slug}/dashboard`
  }

  useEffect(() => {
    if (!selecionadoId) return
    const handler = (e) => e.key === 'Escape' && setSelecionadoId(null)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selecionadoId])

  const comPendencia = useCallback(async (chave, fn) => {
    setPendentes(prev => new Set(prev).add(chave))
    try {
      await fn()
    } finally {
      setPendentes(prev => {
        const proximo = new Set(prev)
        proximo.delete(chave)
        return proximo
      })
    }
  }, [])

  const definirModulo = (salon, modulo, disponivel) => {
    const chave = `${salon.id}:${modulo}`
    if (pendentes.has(chave)) return
    const modulosAnteriores = salon.modulos

    setSaloes(prev => prev.map(s => s.id !== salon.id ? s : {
      ...s,
      modulos: (s.modulos || []).map(m => m.modulo === modulo ? { ...m, disponivel } : m),
    }))

    comPendencia(chave, async () => {
      const { error } = await supabase.rpc('admin_definir_modulo', {
        p_salon_id: salon.id, p_modulo: modulo, p_disponivel: disponivel,
      })
      if (error) {
        setSaloes(prev => prev.map(s => s.id === salon.id ? { ...s, modulos: modulosAnteriores } : s))
        toast.error(`Não foi possível alterar "${MODULOS[modulo] || modulo}".`)
      } else {
        carregarAuditoria(salon.id)
      }
    })
  }

  const definirSituacao = (salon, ativo) => {
    const chave = `${salon.id}:situacao`
    if (pendentes.has(chave)) return
    setConfirmandoDesativar(false)

    setSaloes(prev => prev.map(s => s.id === salon.id ? { ...s, ativo } : s))

    comPendencia(chave, async () => {
      const { error } = await supabase.rpc('admin_definir_situacao_salao', {
        p_salon_id: salon.id, p_ativo: ativo,
      })
      if (error) {
        setSaloes(prev => prev.map(s => s.id === salon.id ? { ...s, ativo: !ativo } : s))
        toast.error('Não foi possível alterar a situação da barbearia.')
      } else {
        carregarAuditoria(salon.id)
      }
    })
  }

  const situacaoPendente = selecionado && pendentes.has(`${selecionado.id}:situacao`)

  return (
    <div className="min-h-screen bg-concreto">
      <div className="max-w-6xl mx-auto p-5 md:p-8 space-y-5">

        <PageHeader
          title="Painel da Plataforma"
          subtitle={carregando
            ? 'Carregando barbearias…'
            : `${saloes.length} ${saloes.length === 1 ? 'barbearia cadastrada' : 'barbearias cadastradas'}`}
          action={
            <button onClick={signOut}
              className="btn-secondary text-apoio px-4 flex items-center gap-1.5 whitespace-nowrap">
              <LogOut size={14} />
              Sair
            </button>
          }
        />

        <PainelConvites />

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cal-3" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, slug ou e-mail"
            aria-label="Buscar barbearia"
            className="input-base pl-9"
          />
        </div>

        {carregando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : saloes.length === 0 ? (
          <EmptyState icon={Store} title="Nenhuma barbearia cadastrada"
            description="As barbearias aparecem aqui assim que se cadastram na plataforma." />
        ) : filtrados.length === 0 ? (
          <EmptyState icon={Search} title="Nada encontrado"
            description="Nenhuma barbearia corresponde à busca. Tente outro nome, slug ou e-mail." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtrados.map(s => (
              <button key={s.id} onClick={() => abrirSalao(s.id)}
                className="group card aspect-square w-full text-left cursor-pointer transition-colors hover:bg-elevado hover:border-latao flex flex-col">

                <div className="flex items-start justify-between gap-2">
                  <AvatarSalao nome={s.nome} logoUrl={s.logo_url} />
                  <SeloSituacao ativo={s.ativo} />
                </div>

                <div className="flex-1 min-h-0 flex flex-col justify-center py-2">
                  <p className="font-display text-base font-semibold line-clamp-2 text-cal">
                    {s.nome}
                  </p>
                  <p className="text-xs mt-0.5 truncate text-cal-2">
                    /{s.slug}
                  </p>
                  <p className="text-xs mt-0.5 truncate text-cal-3 group-hover:text-cal-2">
                    {s.dono_email}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {ORDEM_MODULOS.map(chave => {
                    const m = (s.modulos || []).find(x => x.modulo === chave)
                    if (!m) return null
                    return (
                      <span key={chave}
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.disponivel ? 'bg-ok' : 'bg-danger-solido'}`}
                        title={`${MODULOS[chave]}: ${m.disponivel ? 'disponível' : 'indisponível'}`} />
                    )
                  })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selecionado && (
        <div className="fixed inset-0 z-50 bg-piche/80"
          onClick={e => e.target === e.currentTarget && setSelecionadoId(null)}>
          <div
            className="absolute inset-y-0 right-0 w-full max-w-md h-full overflow-y-auto border-l shadow-flutua bg-bancada border-junta"
            role="dialog" aria-modal="true" aria-label={`Detalhes de ${selecionado.nome}`}>

            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b sticky top-0 z-10 border-junta bg-bancada">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold truncate text-cal">
                  {selecionado.nome}
                </h2>
                <p className="text-xs mt-0.5 truncate text-cal-3">
                  /{selecionado.slug} · {selecionado.dono_email}
                </p>
                <p className="text-xs mt-0.5 num text-cal-3">
                  Cadastro em {formatarData(selecionado.criado_em)}
                  {selecionado.plano ? ` · Plano ${selecionado.plano}` : ''}
                </p>
              </div>
              <button onClick={() => setSelecionadoId(null)} aria-label="Fechar"
                className="p-1.5 rounded-controle transition-colors flex-shrink-0 text-cal-2 hover:bg-elevado hover:text-cal">
                <X size={18} />
              </button>
            </div>

            <section className="px-5 py-4 border-b border-junta">
              <button onClick={() => observarSalao(selecionado.id)}
                className="btn-secondary w-full flex items-center justify-center gap-2">
                <Eye size={15} aria-hidden />
                Abrir o painel desta barbearia
              </button>
              <p className="text-micro mt-2 text-cal-3">
                Você vê agenda, clientes e caixa como o dono vê. Somente leitura —
                o banco recusa qualquer alteração sua. A entrada fica registrada
                no histórico abaixo.
              </p>
            </section>

            <section className="px-5 py-4 border-b border-junta">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-cal-2">Situação da barbearia</p>
                  <p className={`text-micro mt-0.5 font-semibold ${selecionado.ativo ? "text-ok" : "text-danger"}`}>
                    {selecionado.ativo ? 'Ativa' : 'Desativada'}
                  </p>
                </div>
                {selecionado.ativo ? (
                  confirmandoDesativar ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setConfirmandoDesativar(false)}
                        className="btn-secondary text-micro px-3.5">
                        Cancelar
                      </button>
                      <button onClick={() => definirSituacao(selecionado, false)} disabled={situacaoPendente}
                        className="btn-destrutivo text-micro px-3.5 whitespace-nowrap">
                        Confirmar desativação
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmandoDesativar(true)} disabled={situacaoPendente}
                      className="btn-secondary text-micro px-3.5 whitespace-nowrap text-danger hover:text-danger">
                      Desativar barbearia
                    </button>
                  )
                ) : (
                  <button onClick={() => definirSituacao(selecionado, true)} disabled={situacaoPendente}
                    className="btn-secondary text-micro px-3.5 whitespace-nowrap">
                    Reativar barbearia
                  </button>
                )}
              </div>
            </section>

            <section className="px-5 py-4 border-b border-junta">
              <p className="text-sm font-semibold mb-1 text-cal-2">Módulos</p>
              <div>
                {(selecionado.modulos || []).map(m => {
                  const pendente = pendentes.has(`${selecionado.id}:${m.modulo}`)
                  return (
                    <div key={m.modulo}
                      className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0 border-junta">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-cal">
                          {MODULOS[m.modulo] || m.modulo}
                        </p>
                        {m.disponivel && !m.ativo && (
                          <p className="text-xs mt-0.5 text-cal-3">
                            Disponível, mas desligado pelo dono
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-micro font-semibold ${m.disponivel ? "text-ok" : "text-danger"}`}>
                          {m.disponivel ? 'Ativo' : 'Desativado'}
                        </span>
                        <Toggle
                          ligado={m.disponivel}
                          pendente={pendente}
                          rotulo={`${m.disponivel ? 'Desabilitar' : 'Habilitar'} ${MODULOS[m.modulo] || m.modulo}`}
                          onClick={() => definirModulo(selecionado, m.modulo, !m.disponivel)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="px-5 py-4">
              <p className="text-sm font-semibold mb-1 text-cal-2">Histórico</p>
              {auditoriaCarregando ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              ) : auditoria.length === 0 ? (
                <p className="text-xs py-2 text-cal-3">
                  Nenhuma alteração registrada
                </p>
              ) : (
                <ul>
                  {auditoria.map((ev, i) => (
                    <li key={i} className="py-2 border-b last:border-b-0 border-junta">
                      <p className="text-sm text-cal-2">{fraseAuditoria(ev)}</p>
                      <p className="text-xs mt-0.5 num text-cal-3">
                        {formatarDataHora(ev.criado_em)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

          </div>
        </div>
      )}
    </div>
  )
}
