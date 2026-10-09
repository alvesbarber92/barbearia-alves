import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Skeleton } from '../../components/ui/Skeleton'
import { Database, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

// Limites do plano Free do Supabase. Ao passar para o Pro (US$ 25/mês), trocar
// por 8 GB de banco, 100 GB de arquivos e 100.000 usuários ativos.
const LIMITES = {
  banco:    500 * 1024 * 1024,
  arquivos: 1024 * 1024 * 1024,
  usuarios: 50000,
}

function formatarBytes(bytes) {
  if (!bytes) return '0 B'
  const unidades = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < unidades.length - 1) { v /= 1024; i++ }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: i < 2 ? 0 : 1 })} ${unidades[i]}`
}

function Medidor({ titulo, valor, limite, texto, detalhe }) {
  const pct = Math.min(100, (valor / limite) * 100)
  const cor = pct >= 90 ? 'bg-danger-solido' : pct >= 70 ? 'bg-warn' : 'bg-ok'
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-cal">{titulo}</p>
        <p className="text-xs num text-cal-3">{pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p>
      </div>
      <div className="h-2 rounded-full bg-elevado overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <p className="text-xs num text-cal-2">{texto}</p>
      {detalhe && <p className="text-micro text-cal-3">{detalhe}</p>}
    </div>
  )
}

export default function PainelUso() {
  const [uso, setUso] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(() => {
    supabase.rpc('admin_uso_banco').then(({ data, error }) => {
      if (error) toast.error('Não foi possível carregar o uso do banco.')
      setUso(data || null)
      setCarregando(false)
    })
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="card space-y-4">

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-cal-3" />
          <h2 className="font-display text-base font-semibold text-cal">
            Uso do banco de dados
          </h2>
        </div>
        <button onClick={() => { setCarregando(true); carregar() }} className="p-1.5 rounded-controle transition-colors hover:bg-elevado"
          aria-label="Recarregar uso">
          <RefreshCw size={14} className="text-cal-3" />
        </button>
      </div>

      <p className="text-sm text-cal-3">
        Comparado com os limites do plano Free do Supabase. Passando deles, o projeto
        precisa do plano Pro. O valor da fatura fica no painel do Supabase, em Billing.
      </p>

      {carregando && !uso ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !uso ? (
        <p className="text-sm py-2 text-cal-3">Uso indisponível.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Medidor titulo="Banco de dados"
              valor={uso.banco_bytes} limite={LIMITES.banco}
              texto={`${formatarBytes(uso.banco_bytes)} de ${formatarBytes(LIMITES.banco)}`} />
            <Medidor titulo="Arquivos (fotos e logos)"
              valor={uso.arquivos_bytes} limite={LIMITES.arquivos}
              texto={`${formatarBytes(uso.arquivos_bytes)} de ${formatarBytes(LIMITES.arquivos)}`}
              detalhe={`${uso.arquivos_qtd.toLocaleString('pt-BR')} arquivos`} />
            <Medidor titulo="Usuários ativos no mês"
              valor={uso.usuarios_ativos_30d} limite={LIMITES.usuarios}
              texto={`${uso.usuarios_ativos_30d.toLocaleString('pt-BR')} de ${LIMITES.usuarios.toLocaleString('pt-BR')}`}
              detalhe={`${uso.usuarios_total.toLocaleString('pt-BR')} ${uso.usuarios_total === 1 ? 'conta' : 'contas'} no total · login nos últimos 30 dias`} />
          </div>

          {uso.tabelas.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-1 text-cal-2">Maiores tabelas</p>
              <ul>
                {uso.tabelas.map(t => (
                  <li key={t.nome}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-junta">
                    <span className="text-sm text-cal truncate">{t.nome}</span>
                    <span className="text-xs num text-cal-3 whitespace-nowrap">
                      {t.linhas.toLocaleString('pt-BR')} linhas · {formatarBytes(t.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
