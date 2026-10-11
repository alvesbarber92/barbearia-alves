import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { HandCoins, Plus, Check, Trash2, Undo2, MessageCircle, Users, Wallet } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'
import { Skeleton } from '../../components/ui/Skeleton'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { brl, brlCompacto, chaveDia, filtrarPreco, TETO_PRECO, MSG_TETO_PRECO } from '../../lib/agenda'
import { digitosTelefone, formatarTelefone, mascararTelefone, telefoneValido, MSG_TELEFONE_INVALIDO, propsCampoTelefone } from '../../lib/telefone'

const ABAS = [
  { valor: 'aberto',  label: 'Em aberto' },
  { valor: 'quitado', label: 'Quitados' },
]

const numero = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const normaliza = (s) => (s || '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')

const diaMes = (iso) => {
  const [, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}`
}

const chavePessoa = (d) => d.cliente_id
  ? `c:${d.cliente_id}`
  : `n:${normaliza(d.nome)}|${digitosTelefone(d.telefone)}`

const formVazio = () => ({ nome: '', telefone: '', descricao: '', valor: '', data: chaveDia(new Date()), cliente_id: null })

export default function DebitosPage() {
  const { salon } = useAuth()
  const salonId = salon?.id

  const [debitos, setDebitos] = useState([])
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [recarga, setRecarga] = useState(0)
  const recarregar = useCallback(() => setRecarga(v => v + 1), [])

  const [aba, setAba] = useState('aberto')
  const [filtro, setFiltro] = useState('')
  const [form, setForm] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const { armado, armar, desarmar } = useConfirmacao()

  useEffect(() => {
    if (!salonId) return
    let vivo = true
    Promise.all([
      supabase.from('debitos')
        .select('id, cliente_id, nome, telefone, descricao, valor, data, pago_em')
        .eq('salon_id', salonId)
        .order('data', { ascending: false })
        .order('criado_em', { ascending: false }),
      supabase.from('clientes').select('id, nome, telefone').eq('salon_id', salonId).order('nome'),
    ]).then(([resDebitos, resClientes]) => {
      if (!vivo) return
      if (resDebitos.error) toast.error('Erro ao carregar os débitos.')
      setDebitos(resDebitos.data || [])
      setClientes(resClientes.data || [])
      setCarregando(false)
    })
    return () => { vivo = false }
  }, [salonId, recarga])

  const abertos  = useMemo(() => debitos.filter(d => !d.pago_em), [debitos])
  const quitados = useMemo(() => debitos.filter(d => d.pago_em)
    .sort((a, b) => (a.pago_em < b.pago_em ? 1 : -1)), [debitos])

  const pessoas = useMemo(() => {
    const mapa = new Map()
    for (const d of abertos) {
      const k = chavePessoa(d)
      const p = mapa.get(k) || { chave: k, nome: d.nome, telefone: d.telefone, total: 0, itens: [] }
      p.total += Number(d.valor) || 0
      if (!p.telefone && d.telefone) p.telefone = d.telefone
      p.itens.push(d)
      mapa.set(k, p)
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total)
  }, [abertos])

  const resumo = useMemo(() => {
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    return {
      aberto: abertos.reduce((s, d) => s + (Number(d.valor) || 0), 0),
      recebidoMes: quitados
        .filter(d => new Date(d.pago_em) >= inicioMes)
        .reduce((s, d) => s + (Number(d.valor) || 0), 0),
    }
  }, [abertos, quitados])

  const bateFiltro = useCallback((nome, telefone) => {
    const termo = normaliza(filtro)
    if (!termo) return true
    const digitos = digitosTelefone(filtro)
    return normaliza(nome).includes(termo)
      || (digitos.length >= 3 && digitosTelefone(telefone).includes(digitos))
  }, [filtro])

  const pessoasFiltradas  = useMemo(() => pessoas.filter(p => bateFiltro(p.nome, p.telefone)), [pessoas, bateFiltro])
  const quitadosFiltrados = useMemo(() => quitados.filter(d => bateFiltro(d.nome, d.telefone)), [quitados, bateFiltro])

  const sugestoes = useMemo(() => {
    if (!form || form.cliente_id) return []
    const termo = normaliza(form.nome)
    const digitos = digitosTelefone(form.nome)
    if (!termo) return []
    return clientes.filter(c => normaliza(c.nome).includes(termo)
      || (digitos.length >= 3 && digitosTelefone(c.telefone).includes(digitos))).slice(0, 6)
  }, [clientes, form])

  const jaDeve = useMemo(() => {
    if (!form) return []
    const nome = normaliza(form.nome)
    const digitos = digitosTelefone(form.telefone)
    return abertos.filter(d =>
      (form.cliente_id && d.cliente_id === form.cliente_id)
      || (digitos.length >= 10 && digitosTelefone(d.telefone) === digitos)
      || (nome && normaliza(d.nome) === nome))
  }, [abertos, form])
  const totalJaDeve = jaDeve.reduce((s, d) => s + (Number(d.valor) || 0), 0)

  const escolherCliente = (c) => setForm(f => ({
    ...f, nome: c.nome, cliente_id: c.id, telefone: c.telefone ? mascararTelefone(c.telefone) : '',
  }))

  const trocarCliente = () => setForm(f => ({ ...f, nome: '', telefone: '', cliente_id: null }))

  const salvar = async (e) => {
    e.preventDefault()
    const nome = form.nome.trim()
    const valor = numero(form.valor)
    if (!nome) { toast.error('Informe quem ficou devendo.'); return }
    if (valor <= 0) { toast.error('Informe o valor.'); return }
    if (valor > TETO_PRECO) { toast.error(MSG_TETO_PRECO); return }
    if (!telefoneValido(form.telefone)) { toast.error(MSG_TELEFONE_INVALIDO); return }
    if (!form.data || form.data > chaveDia(new Date())) { toast.error('A data não pode ser no futuro.'); return }

    let clienteId = form.cliente_id
    const digitos = digitosTelefone(form.telefone)
    if (!clienteId && digitos) {
      clienteId = clientes.find(c => digitosTelefone(c.telefone) === digitos)?.id ?? null
    }

    setSalvando(true)
    const { error } = await supabase.from('debitos').insert({
      salon_id: salonId,
      cliente_id: clienteId,
      nome,
      telefone: form.telefone || null,
      descricao: form.descricao.trim() || null,
      valor,
      data: form.data,
    })
    setSalvando(false)
    if (error) { toast.error('Não foi possível salvar o débito.'); return }
    toast.success('Débito anotado')
    setForm(null)
    setAba('aberto')
    recarregar()
  }

  const quitar = async (ids, rotulo) => {
    const { error } = await supabase.from('debitos')
      .update({ pago_em: new Date().toISOString() })
      .in('id', ids)
    if (error) { toast.error('Não foi possível quitar.'); return }
    toast.success(rotulo)
    recarregar()
  }

  const reabrir = async (d) => {
    const { error } = await supabase.from('debitos').update({ pago_em: null }).eq('id', d.id)
    if (error) { toast.error('Não foi possível reabrir.'); return }
    toast.success('Débito voltou para em aberto')
    recarregar()
  }

  const excluir = async (d) => {
    desarmar()
    const { error } = await supabase.from('debitos').delete().eq('id', d.id)
    if (error) { toast.error('Não foi possível excluir.'); return }
    toast.success('Débito excluído')
    recarregar()
  }

  const linkCobranca = (p) => {
    const d = digitosTelefone(p.telefone)
    if (d.length < 10) return null
    const primeiroNome = p.nome.trim().split(/\s+/)[0]
    const texto = `Olá, ${primeiroNome}! Passando para lembrar do valor de ${brl(p.total)} em aberto aqui na ${salon?.nome || 'barbearia'}. Qualquer dúvida, é só chamar.`
    return `https://wa.me/55${d}?text=${encodeURIComponent(texto)}`
  }

  const botaoNovo = (
    <button onClick={() => setForm(formVazio())} className="btn-primary flex items-center gap-2">
      <Plus size={16} /> Novo débito
    </button>
  )

  if (carregando) {
    return (
      <div className="p-5 md:p-8 space-y-5">
        <PageHeader title="Débitos" subtitle="Quem ficou devendo" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 space-y-5">
      <PageHeader title="Débitos" subtitle="Quem ficou devendo" action={botaoNovo} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={Wallet} label="Em aberto" value={brlCompacto(resumo.aberto)}
          sub={`${abertos.length} ${abertos.length === 1 ? 'débito' : 'débitos'}`} />
        <StatCard icon={Users} label="Pessoas devendo" value={pessoas.length} sub="com valor em aberto" />
        <StatCard icon={HandCoins} label="Recebido no mês" value={brlCompacto(resumo.recebidoMes)}
          sub="débitos quitados" className="col-span-2 md:col-span-1" />
      </div>

      <div className="card space-y-4">
        <div className="flex gap-2" role="tablist" aria-label="Débitos">
          {ABAS.map(a => {
            const ativa = aba === a.valor
            const qtd = a.valor === 'aberto' ? abertos.length : quitados.length
            return (
              <button key={a.valor} type="button" role="tab" aria-selected={ativa}
                onClick={() => { setAba(a.valor); desarmar() }}
                className={`marca px-3.5 py-1.5 rounded-controle text-sm border bg-bancada transition-colors ${ativa ? 'border-acento-filete text-cal font-semibold' : 'border-junta-forte text-cal-2 hover:border-latao'}`}
              >
                {a.label} <span className="num text-cal-3">{qtd}</span>
              </button>
            )
          })}
        </div>

        {debitos.length > 0 && (
          <input className="input-base" type="search" aria-label="Buscar débito"
            placeholder="Buscar por nome ou telefone"
            value={filtro} onChange={e => setFiltro(e.target.value)} />
        )}

        {filtro && (aba === 'aberto'
          ? pessoas.length > 0 && pessoasFiltradas.length === 0
          : quitados.length > 0 && quitadosFiltrados.length === 0) && (
          <p className="text-sm py-6 text-center text-cal-3">Ninguém encontrado com essa busca.</p>
        )}

        {aba === 'aberto' && (pessoas.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Ninguém devendo"
            description="Quando alguém passar fiado, anote aqui quem foi, quanto e por quê. Quando pagar, é só marcar como quitado."
            action={botaoNovo}
          />
        ) : (
          <div className="divide-y divide-junta">
            {pessoasFiltradas.map(p => {
              const link = linkCobranca(p)
              return (
                <div key={p.chave} className="py-4 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate text-cal">{p.nome}</p>
                      {p.telefone && (
                        <a href={`tel:${digitosTelefone(p.telefone)}`}
                          className="text-xs num hover:underline text-cal-2">
                          {formatarTelefone(p.telefone)}
                        </a>
                      )}
                    </div>
                    <p className="num text-card font-semibold text-warn">{brlCompacto(p.total)}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" aria-label={`Cobrar ${p.nome} pelo WhatsApp`}
                          className="p-2 rounded-controle text-cal-2 transition-colors hover:bg-elevado hover:text-cal">
                          <MessageCircle size={16} />
                        </a>
                      )}
                      {p.itens.length > 1 && (
                        <button type="button" onClick={() => quitar(p.itens.map(d => d.id), `${p.nome}: tudo quitado`)}
                          className="btn-secondary text-micro px-2.5 py-1.5 whitespace-nowrap">
                          Quitar tudo
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {p.itens.map(d => (
                      <div key={d.id} className="flex items-center gap-3 rounded-controle px-3 py-2 bg-elevado">
                        <span className="text-xs num text-cal-3 flex-shrink-0">{diaMes(d.data)}</span>
                        <span className="text-sm truncate flex-1 min-w-0 text-cal-2">{d.descricao || '—'}</span>
                        <span className="text-sm font-semibold num text-cal">{brlCompacto(d.valor)}</span>
                        <button type="button" onClick={() => quitar([d.id], `${brlCompacto(d.valor)} quitado`)}
                          aria-label={`Quitar ${brlCompacto(d.valor)} de ${p.nome}`}
                          className="p-1.5 rounded-controle text-cal-2 transition-colors hover:bg-bancada hover:text-ok">
                          <Check size={16} />
                        </button>
                        {armado === d.id ? (
                          <button type="button" onClick={() => excluir(d)}
                            className="btn-destrutivo text-micro px-2.5 py-1 whitespace-nowrap">
                            Confirmar
                          </button>
                        ) : (
                          <button type="button" onClick={() => armar(d.id)} aria-label="Excluir débito"
                            className="p-1.5 rounded-controle text-cal-2 transition-colors hover:bg-danger-fundo hover:text-danger">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {aba === 'quitado' && (quitados.length === 0 ? (
          <p className="text-sm py-6 text-center text-cal-3">Nenhum débito quitado ainda.</p>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto divide-y divide-junta pr-1">
            {quitadosFiltrados.map(d => (
              <div key={d.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate text-cal">{d.nome}</p>
                  <p className="text-xs truncate text-cal-3">
                    <span className="num">{diaMes(d.data)}</span>{d.descricao ? ` · ${d.descricao}` : ''}
                    {' · '}pago em <span className="num">{new Date(d.pago_em).toLocaleDateString('pt-BR')}</span>
                  </p>
                </div>
                <span className="text-sm font-semibold num text-ok">{brlCompacto(d.valor)}</span>
                <button type="button" onClick={() => reabrir(d)} aria-label={`Reabrir débito de ${d.nome}`}
                  className="p-1.5 rounded-controle text-cal-2 transition-colors hover:bg-elevado hover:text-cal">
                  <Undo2 size={15} />
                </button>
                {armado === d.id ? (
                  <button type="button" onClick={() => excluir(d)}
                    className="btn-destrutivo text-micro px-2.5 py-1 whitespace-nowrap">
                    Confirmar
                  </button>
                ) : (
                  <button type="button" onClick={() => armar(d.id)} aria-label="Excluir débito"
                    className="p-1.5 rounded-controle text-cal-2 transition-colors hover:bg-danger-fundo hover:text-danger">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title="Novo débito">
        {form && (
          <form onSubmit={salvar} className="space-y-4">
            {form.cliente_id ? (
              <div className="space-y-2">
                <p className="text-apoio font-semibold text-cal-2">Cliente</p>
                <div className="flex items-center gap-3 rounded-controle border border-acento-filete px-3 py-2.5 bg-elevado">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate text-cal">{form.nome}</p>
                    <p className="text-xs num text-cal-3">
                      {form.telefone ? formatarTelefone(form.telefone) : 'sem telefone na ficha'}
                    </p>
                  </div>
                  <button type="button" onClick={trocarCliente}
                    className="text-apoio underline underline-offset-2 flex-shrink-0 text-cal-2 hover:text-cal">
                    Trocar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="deb-nome">Quem ficou devendo</label>
                  <input id="deb-nome" className="input-base" autoFocus autoComplete="off"
                    placeholder="Busque pelo nome ou telefone" value={form.nome}
                    onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
                  {sugestoes.length > 0 && (
                    <div className="rounded-controle border border-junta-forte divide-y divide-junta overflow-hidden">
                      {sugestoes.map(c => (
                        <button key={c.id} type="button" onClick={() => escolherCliente(c)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left bg-bancada transition-colors hover:bg-elevado">
                          <span className="text-sm truncate text-cal">{c.nome}</span>
                          <span className="text-xs num flex-shrink-0 text-cal-3">
                            {c.telefone ? formatarTelefone(c.telefone) : 'sem telefone'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {form.nome.trim() && sugestoes.length === 0 && (
                    <p className="text-micro text-cal-3">
                      Nenhum cliente cadastrado com esse nome. O débito fica anotado só com o nome digitado.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="deb-fone">
                    Telefone <span className="text-cal-3">(opcional)</span>
                  </label>
                  <input id="deb-fone" {...propsCampoTelefone} className="input-base num"
                    value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: mascararTelefone(e.target.value) }))} />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="deb-valor">Valor</label>
                <input id="deb-valor" className="input-base num" inputMode="decimal" placeholder="0,00"
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: filtrarPreco(e.target.value) }))} required />
              </div>
              <div className="space-y-2">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="deb-data">Data</label>
                <input id="deb-data" type="date" className="input-base num" max={chaveDia(new Date())}
                  value={form.data}
                  onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-apoio font-semibold text-cal-2" htmlFor="deb-desc">
                Do que é <span className="text-cal-3">(opcional)</span>
              </label>
              <input id="deb-desc" className="input-base" placeholder="Ex.: Corte e barba, pomada"
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            {jaDeve.length > 0 && (
              <div className="rounded-controle border border-warn bg-warn-fundo p-3 space-y-1.5" role="alert">
                <p className="text-sm font-semibold text-warn">
                  {form.nome.trim() || 'Essa pessoa'} já tem {jaDeve.length === 1 ? 'um débito' : `${jaDeve.length} débitos`} em
                  aberto: <span className="num">{brlCompacto(totalJaDeve)}</span>
                </p>
                {jaDeve.map(d => (
                  <p key={d.id} className="text-xs text-cal-2">
                    <span className="num">{diaMes(d.data)}</span> · {d.descricao || 'sem descrição'} ·{' '}
                    <span className="num">{brlCompacto(d.valor)}</span>
                  </p>
                ))}
                <p className="text-xs text-cal-2">Deseja abrir outro débito mesmo assim?</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={salvando} className="btn-primary flex-1">
                {salvando ? 'Salvando…' : jaDeve.length > 0 ? 'Abrir outro mesmo assim' : 'Anotar débito'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
