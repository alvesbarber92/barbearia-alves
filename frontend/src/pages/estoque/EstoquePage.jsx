import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import { Package, Plus, Minus, Pencil, Trash2, TrendingUp, Boxes } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import StatCard from '../../components/ui/StatCard'
import { Skeleton } from '../../components/ui/Skeleton'
import { useConfirmacao } from '../../hooks/useConfirmacao'
import { brlCompacto, filtrarPreco, TETO_PRECO, MSG_TETO_PRECO } from '../../lib/agenda'

const CATEGORIAS = [
  { valor: 'pomada',    label: 'Pomada' },
  { valor: 'gel',       label: 'Gel' },
  { valor: 'shampoo',   label: 'Shampoo' },
  { valor: 'barba',     label: 'Barba' },
  { valor: 'lamina',    label: 'Lâmina' },
  { valor: 'bebida',    label: 'Bebida' },
  { valor: 'vestuario', label: 'Vestuário' },
  { valor: 'acessorio', label: 'Acessório' },
  { valor: 'outro',     label: 'Outro' },
]
const rotuloCategoria = (v) => CATEGORIAS.find(c => c.valor === v)?.label ?? 'Sem categoria'

const FORMA_VAZIA = {
  nome: '', categoria: 'outro', quantidade: '', quantidade_minima: '2',
  preco_custo: '', preco_venda: '',
}

const numero = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const formatarData = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const ERROS_MOVIMENTACAO = {
  estoque_insuficiente:  'Não há essa quantidade em estoque.',
  quantidade_invalida:   'Informe uma quantidade maior que zero.',
  produto_nao_encontrado:'Produto não encontrado — recarregue a página.',
  sem_permissao:         'Você não tem permissão para alterar este estoque.',
}
const mensagemErro = (err, padrao) => {
  const bruto = String(err?.message || '')
  const chave = Object.keys(ERROS_MOVIMENTACAO).find(k => bruto.includes(k))
  return chave ? ERROS_MOVIMENTACAO[chave] : padrao
}

export default function EstoquePage() {
  const { salon } = useAuth()
  const salonId = salon?.id

  const [produtos, setProdutos] = useState([])
  const [vendas, setVendas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [recarga, setRecarga] = useState(0)
  const recarregar = useCallback(() => setRecarga(v => v + 1), [])

  const [formProduto, setFormProduto] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const [mov, setMov] = useState(null)
  const [movQtd, setMovQtd] = useState('')
  const [movCusto, setMovCusto] = useState('')
  const [movendo, setMovendo] = useState(false)

  const { armado, armar, desarmar } = useConfirmacao()

  useEffect(() => {
    if (!salonId) return
    let vivo = true

    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()

    Promise.all([
      supabase.from('estoque').select('*').eq('salon_id', salonId).order('nome'),
      supabase.from('vendas')
        .select('id, produto_id, quantidade, valor_total, custo_total, data_venda')
        .eq('salon_id', salonId)
        .gte('data_venda', inicioMes)
        .order('data_venda', { ascending: false }),
    ]).then(([resProdutos, resVendas]) => {
      if (!vivo) return
      if (resProdutos.error || resVendas.error) toast.error('Erro ao carregar o estoque.')
      setProdutos(resProdutos.data || [])
      setVendas(resVendas.data || [])
      setCarregando(false)
    })

    return () => { vivo = false }
  }, [salonId, recarga])

  const resumo = useMemo(() => {
    const lucro = vendas.reduce((s, v) => s + (Number(v.valor_total) || 0) - (Number(v.custo_total) || 0), 0)
    const receita = vendas.reduce((s, v) => s + (Number(v.valor_total) || 0), 0)
    const parado = produtos.reduce((s, p) => s + (Number(p.preco_custo) || 0) * (Number(p.quantidade) || 0), 0)
    const baixos = produtos.filter(p => (Number(p.quantidade) || 0) <= (Number(p.quantidade_minima) || 0))
    return { lucro, receita, parado, baixos }
  }, [produtos, vendas])

  const nomeDoProduto = useCallback(
    (id) => produtos.find(p => p.id === id)?.nome ?? 'Produto removido',
    [produtos],
  )

  const abrirNovo = () => { setEditandoId(null); setFormProduto({ ...FORMA_VAZIA }) }
  const abrirEdicao = (p) => {
    setEditandoId(p.id)
    setFormProduto({
      nome: p.nome ?? '',
      categoria: p.categoria ?? 'outro',
      quantidade: String(p.quantidade ?? 0),
      quantidade_minima: String(p.quantidade_minima ?? 0),
      preco_custo: p.preco_custo == null ? '' : String(p.preco_custo),
      preco_venda: p.preco_venda == null ? '' : String(p.preco_venda),
    })
  }

  const salvarProduto = async (e) => {
    e.preventDefault()
    const nome = formProduto.nome.trim()
    if (!nome) { toast.error('Dê um nome ao produto.'); return }
    if (numero(formProduto.preco_custo) > TETO_PRECO ||
        numero(formProduto.preco_venda) > TETO_PRECO) {
      toast.error(MSG_TETO_PRECO)
      return
    }

    const linha = {
      nome,
      categoria: formProduto.categoria,
      quantidade_minima: Math.max(0, Math.trunc(numero(formProduto.quantidade_minima))),
      preco_custo: formProduto.preco_custo === '' ? null : numero(formProduto.preco_custo),
      preco_venda: formProduto.preco_venda === '' ? null : numero(formProduto.preco_venda),
    }

    setSalvando(true)
    const { error } = editandoId
      ? await supabase.from('estoque').update(linha).eq('id', editandoId)
      : await supabase.from('estoque').insert({
          ...linha,
          salon_id: salonId,
          quantidade: Math.max(0, Math.trunc(numero(formProduto.quantidade))),
        })
    setSalvando(false)

    if (error) { toast.error('Não foi possível salvar o produto.'); return }
    toast.success(editandoId ? 'Produto atualizado' : 'Produto cadastrado')
    setFormProduto(null)
    recarregar()
  }

  const excluirProduto = async (p) => {
    const { error } = await supabase.from('estoque').delete().eq('id', p.id)
    if (error) { toast.error('Não foi possível excluir.'); return }
    desarmar()
    toast.success('Produto excluído')
    recarregar()
  }

  const abrirMov = (produto, tipo) => {
    setMov({ produto, tipo })
    setMovQtd('1')
    setMovCusto('')
  }

  const confirmarMov = async (e) => {
    e.preventDefault()
    const qtd = Math.trunc(numero(movQtd))
    if (qtd <= 0) { toast.error('Informe uma quantidade maior que zero.'); return }

    setMovendo(true)
    const { error } = mov.tipo === 'entrada'
      ? await supabase.rpc('estoque_entrada', {
          p_produto_id: mov.produto.id,
          p_quantidade: qtd,
          p_preco_custo: movCusto === '' ? null : numero(movCusto),
        })
      : await supabase.rpc('estoque_saida', {
          p_produto_id: mov.produto.id,
          p_quantidade: qtd,
        })
    setMovendo(false)

    if (error) {
      toast.error(mensagemErro(error, 'Não foi possível registrar a movimentação.'))
      return
    }
    toast.success(mov.tipo === 'entrada' ? 'Entrada registrada' : 'Saída registrada')
    setMov(null)
    recarregar()
  }

  if (carregando) {
    return (
      <div className="p-5 md:p-8 space-y-5">
        <PageHeader title="Estoque" subtitle="Produtos, entradas e saídas" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8 space-y-5">
      <PageHeader
        title="Estoque"
        subtitle="Produtos, entradas e saídas"
        action={
          <button onClick={abrirNovo} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Novo produto
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Lucro do mês" value={brlCompacto(resumo.lucro)}
          sub={`sobre ${brlCompacto(resumo.receita)} vendidos`} />
        <StatCard icon={Boxes} label="Parado em estoque" value={brlCompacto(resumo.parado)}
          sub="pelo preço de custo" />
        <StatCard icon={Package} label="Abaixo do mínimo" value={resumo.baixos.length}
          sub="produtos para repor" alert={resumo.baixos.length > 0} />
      </div>

      <div className="card">
        <h2 className="font-display text-base font-semibold mb-4 flex items-center gap-2 text-cal">
          <Package size={16} className="text-cal-2" /> Produtos
        </h2>

        {produtos.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto ainda"
            description="Cadastre o que você revende — pomada, bebida, camiseta, boné — e acompanhe quanto sai e quanto sobra."
            action={
              <button onClick={abrirNovo} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Cadastrar o primeiro
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-junta">
            {produtos.map(p => {
              const qtd = Number(p.quantidade) || 0
              const baixo = qtd <= (Number(p.quantidade_minima) || 0)
              const margem = (Number(p.preco_venda) || 0) - (Number(p.preco_custo) || 0)
              return (
                <div key={p.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate text-cal">{p.nome}</p>
                    <p className="text-micro text-cal-3">
                      {rotuloCategoria(p.categoria)}
                      {p.preco_venda != null && <> · vende por <span className="num">{brlCompacto(p.preco_venda)}</span></>}
                      {margem > 0 && <> · margem <span className="num">{brlCompacto(margem)}</span></>}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`num text-card font-semibold ${baixo ? 'text-danger' : 'text-cal'}`}>{qtd}</p>
                    <p className="text-micro text-cal-3">mín. {p.quantidade_minima ?? 0}</p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => abrirMov(p, 'entrada')} aria-label={`Entrada de ${p.nome}`}
                      className="p-2 rounded-controle text-cal-2 transition-colors hover:bg-elevado hover:text-ok">
                      <Plus size={16} />
                    </button>
                    <button onClick={() => abrirMov(p, 'saida')} aria-label={`Saída de ${p.nome}`}
                      className="p-2 rounded-controle text-cal-2 transition-colors hover:bg-elevado hover:text-cal">
                      <Minus size={16} />
                    </button>
                    <button onClick={() => abrirEdicao(p)} aria-label={`Editar ${p.nome}`}
                      className="p-2 rounded-controle text-cal-2 transition-colors hover:bg-elevado hover:text-cal">
                      <Pencil size={15} />
                    </button>
                    {armado === p.id ? (
                      <button onClick={() => excluirProduto(p)}
                        className="btn-destrutivo text-micro px-2.5 py-1.5 whitespace-nowrap">
                        Confirmar
                      </button>
                    ) : (
                      <button onClick={() => armar(p.id)} aria-label={`Excluir ${p.nome}`}
                        className="p-2 rounded-controle text-cal-2 transition-colors hover:bg-danger-fundo hover:text-danger">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {vendas.length > 0 && (
        <div className="card">
          <h2 className="font-display text-base font-semibold mb-4 flex items-center gap-2 text-cal">
            <TrendingUp size={16} className="text-cal-2" /> Saídas do mês
          </h2>
          <div className="max-h-72 overflow-y-auto divide-y divide-junta pr-1">
            {vendas.map(v => {
              const lucro = (Number(v.valor_total) || 0) - (Number(v.custo_total) || 0)
              return (
                <div key={v.id} className="py-2.5 flex items-center gap-3">
                  <p className="text-xs num text-cal-3 flex-shrink-0">{formatarData(v.data_venda)}</p>
                  <p className="text-sm truncate flex-1 min-w-0 text-cal">
                    {nomeDoProduto(v.produto_id)}
                    <span className="text-cal-3"> ×{v.quantidade}</span>
                  </p>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold num text-cal">{brlCompacto(v.valor_total)}</p>
                    <p className="text-micro num text-ok">lucro {brlCompacto(lucro)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal open={!!formProduto} onClose={() => setFormProduto(null)}
        title={editandoId ? 'Editar produto' : 'Novo produto'}>
        {formProduto && (
          <form onSubmit={salvarProduto} className="p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-apoio font-semibold text-cal-2" htmlFor="prod-nome">Nome</label>
              <input id="prod-nome" className="input-base" value={formProduto.nome} autoFocus
                onChange={e => setFormProduto({ ...formProduto, nome: e.target.value })}
                placeholder="Ex.: Pomada modeladora, Camiseta, Energético" required />
            </div>

            <div className="space-y-2">
              <label className="text-apoio font-semibold text-cal-2" htmlFor="prod-cat">Categoria</label>
              <select id="prod-cat" className="input-base" value={formProduto.categoria}
                onChange={e => setFormProduto({ ...formProduto, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="prod-custo">Custo</label>
                <input id="prod-custo" className="input-base" inputMode="decimal" placeholder="0,00"
                  value={formProduto.preco_custo}
                  onChange={e => setFormProduto({ ...formProduto, preco_custo: filtrarPreco(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="prod-venda">Venda</label>
                <input id="prod-venda" className="input-base" inputMode="decimal" placeholder="0,00"
                  value={formProduto.preco_venda}
                  onChange={e => setFormProduto({ ...formProduto, preco_venda: filtrarPreco(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!editandoId && (
                <div className="space-y-2">
                  <label className="text-apoio font-semibold text-cal-2" htmlFor="prod-qtd">Quantidade inicial</label>
                  <input id="prod-qtd" className="input-base" inputMode="numeric" placeholder="0"
                    value={formProduto.quantidade}
                    onChange={e => setFormProduto({ ...formProduto, quantidade: e.target.value })} />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="prod-min">Avisar abaixo de</label>
                <input id="prod-min" className="input-base" inputMode="numeric" placeholder="2"
                  value={formProduto.quantidade_minima}
                  onChange={e => setFormProduto({ ...formProduto, quantidade_minima: e.target.value })} />
              </div>
            </div>

            {editandoId && (
              <p className="text-micro text-cal-3">
                A quantidade não se edita aqui: use entrada e saída, para todo movimento
                do saldo ter uma razão registrada.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setFormProduto(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className="btn-primary flex-1">
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!mov} onClose={() => setMov(null)}
        title={mov?.tipo === 'entrada' ? 'Entrada de estoque' : 'Saída de estoque'}>
        {mov && (
          <form onSubmit={confirmarMov} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-cal">{mov.produto.nome}</p>
              <p className="text-micro text-cal-3">
                Em estoque agora: <span className="num">{mov.produto.quantidade ?? 0}</span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-apoio font-semibold text-cal-2" htmlFor="mov-qtd">Quantidade</label>
              <input id="mov-qtd" className="input-base" inputMode="numeric" value={movQtd} autoFocus
                onChange={e => setMovQtd(e.target.value)} required />
            </div>

            {mov.tipo === 'entrada' ? (
              <div className="space-y-2">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="mov-custo">
                  Custo unitário <span className="text-cal-3">(opcional)</span>
                </label>
                <input id="mov-custo" className="input-base" inputMode="decimal" placeholder="manter o atual"
                  value={movCusto} onChange={e => setMovCusto(filtrarPreco(e.target.value))} />
                <p className="text-micro text-cal-3">
                  Comprou por outro preço? Informe aqui. As vendas já feitas não mudam —
                  o custo delas ficou gravado no momento da venda.
                </p>
              </div>
            ) : (
              <p className="text-micro text-cal-3">
                A saída registra a venda pelo preço atual de{' '}
                <span className="num">{brlCompacto(mov.produto.preco_venda)}</span> e entra no lucro do mês.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setMov(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" disabled={movendo} className="btn-primary flex-1">
                {movendo ? 'Registrando…' : mov.tipo === 'entrada' ? 'Dar entrada' : 'Dar baixa'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
