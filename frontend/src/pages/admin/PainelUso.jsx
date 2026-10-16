import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Skeleton } from '../../components/ui/Skeleton'
import { Gauge, RefreshCw, ExternalLink, CalendarClock, Archive } from 'lucide-react'
import toast from 'react-hot-toast'

const MB = 1024 * 1024
const GB = 1024 * MB

const LIMITES = {
  banco:    500 * MB,
  arquivos: 1 * GB,
  ativos:   50000,
}

const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
const LINK_USO = `https://supabase.com/dashboard/project/${ref}/usage`

const NOME_TABELA = {
  agendamentos:      'Agendamentos',
  clientes:          'Clientes',
  auditoria_admin:   'Registro do admin',
  horarios:          'Horários de funcionamento',
  salons:            'Barbearias',
  vendas:            'Vendas',
  admin_observando:  'Observação do admin',
  estoque:           'Estoque',
  horarios_fixos:    'Horários fixos',
  servicos:          'Serviços',
  pausas_dia:        'Pausas do dia',
  dias_especiais:    'Dias especiais',
  convites:          'Convites',
  plataforma_admins: 'Admins da plataforma',
  salon_modulos:     'Módulos das barbearias',
  bloqueios_horario: 'Bloqueios de horário',
  debitos:           'Débitos',
  uso_historico:     'Histórico de uso',
}

function formatarDia(dia) {
  const [, m, d] = String(dia).split('-')
  return d && m ? `${d}/${m}` : '—'
}

function renovacao(fim) {
  const [a, m, d] = String(fim).split('-').map(Number)
  if (!a || !m || !d) return null
  const [ha, hm, hd] = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).split('-').map(Number)
  const dias = Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000)
  return { data: formatarDia(fim), dias }
}

function textoRenovacao(ciclo) {
  if (!ciclo) return 'Zera na virada do ciclo'
  if (ciclo.dias <= 0) return `Zera hoje, ${ciclo.data}`
  return `Zera em ${ciclo.data}, ${ciclo.dias === 1 ? 'amanhã' : `daqui a ${ciclo.dias} dias`}`
}

function formatarBytes(n) {
  if (n == null) return '—'
  if (n >= 1000 * MB) return `${(n / GB).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`
  if (n >= MB) return `${(n / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
  return `${Math.round(n / 1024).toLocaleString('pt-BR')} KB`
}

function formatarNumero(n) {
  return n == null ? '—' : Number(n).toLocaleString('pt-BR')
}

function formatarHora(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function corDaFaixa(pct) {
  if (pct >= 90) return { barra: 'bg-danger-solido', texto: 'text-danger' }
  if (pct >= 70) return { barra: 'bg-warn', texto: 'text-warn' }
  return { barra: 'bg-ok', texto: 'text-ok' }
}

function Tendencia({ pontos, campo, formatar, rotulo }) {
  const [ativo, setAtivo] = useState(null)
  const serie = pontos.map(p => ({ dia: p.dia, v: Number(p[campo]) }))

  if (serie.length < 2) {
    return (
      <p className="text-micro text-cal-3">
        {serie.length ? `Histórico começou em ${formatarDia(serie[0].dia)}; a linha aparece com a próxima medição.`
                      : 'Sem histórico ainda.'}
      </p>
    )
  }

  const valores = serie.map(s => s.v)
  let min = Math.min(...valores)
  let max = Math.max(...valores)
  if (max === min) { const folga = max * 0.05 || 1; min -= folga; max += folga }
  const respiro = (max - min) * 0.12
  min -= respiro; max += respiro

  const x = i => (i / (serie.length - 1)) * 100
  const y = v => (1 - (v - min) / (max - min)) * 100
  const linha = serie.map((s, i) => `${i ? 'L' : 'M'}${x(i)},${y(s.v)}`).join('')
  const i = ativo ?? serie.length - 1
  const ponto = serie[i]

  function apontar(e) {
    const caixa = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - caixa.left) / caixa.width
    setAtivo(Math.max(0, Math.min(serie.length - 1, Math.round(frac * (serie.length - 1)))))
  }

  function teclar(e) {
    if (e.key === 'ArrowLeft') setAtivo(Math.max(0, i - 1))
    else if (e.key === 'ArrowRight') setAtivo(Math.min(serie.length - 1, i + 1))
    else return
    e.preventDefault()
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-micro">
        <span className="text-cal-3">
          {ativo == null ? `${formatarDia(serie[0].dia)} a ${formatarDia(ponto.dia)}` : formatarDia(ponto.dia)}
        </span>
        <span className="num font-semibold text-cal">{formatar(ponto.v)}</span>
      </div>

      <div className="relative h-12 cursor-crosshair outline-none focus-visible:ring-1 focus-visible:ring-junta-forte rounded-chapa"
        tabIndex={0} role="img"
        aria-label={`${rotulo}: de ${formatar(serie[0].v)} em ${formatarDia(serie[0].dia)} para ${formatar(serie.at(-1).v)} em ${formatarDia(serie.at(-1).dia)}`}
        onPointerMove={apontar} onPointerLeave={() => setAtivo(null)}
        onKeyDown={teclar} onBlur={() => setAtivo(null)}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
          <line x1="0" y1="100" x2="100" y2="100" className="stroke-junta" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={`${linha}L100,100L0,100Z`} className="fill-gelo" fillOpacity="0.1" />
          <path d={linha} fill="none" className="stroke-gelo" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {ativo != null && (
          <span className="absolute top-0 bottom-0 w-px bg-junta-forte pointer-events-none"
            style={{ left: `${x(i)}%` }} />
        )}
        <span className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gelo ring-2 ring-bancada pointer-events-none"
          style={{ left: `${x(i)}%`, top: `${y(ponto.v)}%` }} />
      </div>

      <table className="sr-only">
        <caption>{rotulo} por dia</caption>
        <tbody>
          {serie.map(s => <tr key={s.dia}><th>{formatarDia(s.dia)}</th><td>{formatar(s.v)}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

function BarrasTabelas({ tabelas }) {
  const maior = Math.max(...tabelas.map(t => Number(t.bytes) || 0), 1)
  return (
    <ul className="mt-2 space-y-0.5">
      {tabelas.map(t => {
        const pct = (Number(t.bytes) / maior) * 100
        return (
          <li key={t.nome} title={t.nome}
            className="group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-x-3 gap-y-1 py-1 px-1.5 -mx-1.5 rounded-controle text-xs transition-colors hover:bg-elevado">
            <span className="truncate text-cal-2 group-hover:text-cal">{NOME_TABELA[t.nome] ?? t.nome}</span>
            <div className="h-2 col-span-2 order-last sm:col-span-1 sm:order-none">
              <div className="h-full bg-gelo rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
            <span className="num text-cal-3 group-hover:text-cal-2 whitespace-nowrap text-right">
              {formatarNumero(t.linhas)} {Number(t.linhas) === 1 ? 'linha' : 'linhas'} · {formatarBytes(t.bytes)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Medidor({ titulo, usado, limite, formatar, detalhe, renova, ciclico = false, children }) {
  const pct = limite ? Math.min(100, (usado / limite) * 100) : 0
  const falta = Math.max(0, (limite ?? 0) - (usado ?? 0))
  const cor = corDaFaixa(pct)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-cal">{titulo}</p>
        <p className={`text-micro font-semibold num ${cor.texto}`}>
          {pct.toLocaleString('pt-BR', { maximumFractionDigits: pct < 1 ? 2 : 0 })}%
        </p>
      </div>
      <div className="h-2 rounded-chapa bg-elevado overflow-hidden"
        role="meter" aria-label={titulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={`h-full ${cor.barra}`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
      </div>
      <dl className="grid grid-cols-2 gap-3 pt-0.5">
        <div>
          <dt className="text-micro text-cal-3">Gasto</dt>
          <dd className="text-sm num font-semibold text-cal">{formatar(usado)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-micro text-cal-3">Falta</dt>
          <dd className="text-sm num font-semibold text-cal">{formatar(falta)}</dd>
        </div>
      </dl>
      <p className="text-micro text-cal-3">
        Limite de {formatar(limite)}
        {detalhe && <span> · {detalhe}</span>}
      </p>
      {renova && (
        <p className="text-micro text-cal-2 flex items-center gap-1.5">
          {ciclico
            ? <CalendarClock size={11} className="text-cal-3 flex-shrink-0" aria-hidden="true" />
            : <Archive size={11} className="text-cal-3 flex-shrink-0" aria-hidden="true" />}
          {renova}
        </p>
      )}
      {children && <div className="pt-2">{children}</div>}
    </div>
  )
}

export default function PainelUso() {
  const [uso, setUso] = useState(null)
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(() => {
    Promise.all([
      supabase.rpc('admin_uso_plataforma'),
      supabase.rpc('admin_uso_historico', { p_dias: 90 }),
    ]).then(([agora, hist]) => {
      if (agora.error) toast.error('Não foi possível carregar o uso do Supabase.')
      else setUso(agora.data)
      if (!hist.error) setHistorico(hist.data ?? [])
      setCarregando(false)
    })
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const ciclo = uso ? renovacao(uso.ciclo_fim) : null

  return (
    <div className="card space-y-4">

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-cal-3" />
          <h2 className="font-display text-base font-semibold text-cal">
            Uso do Supabase
          </h2>
          <span className="text-micro px-2 py-0.5 rounded-chapa bg-elevado text-cal-2">Plano Free</span>
        </div>
        <button onClick={() => { setCarregando(true); carregar() }} disabled={carregando}
          className="p-1.5 rounded-controle transition-colors hover:bg-elevado disabled:opacity-50"
          aria-label="Recarregar uso">
          <RefreshCw size={14} className={`text-cal-3 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {carregando && !uso ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : !uso ? (
        <p className="text-sm py-2 text-cal-3">Sem dados de uso no momento.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Medidor titulo="Banco de dados" usado={uso.banco_bytes} limite={LIMITES.banco}
              formatar={formatarBytes} detalhe="conta os bancos internos, como o Supabase"
              renova="Não renova: é o que está guardado">
              <Tendencia pontos={historico} campo="banco_bytes" formatar={formatarBytes} rotulo="Banco de dados" />
            </Medidor>
            <Medidor titulo="Arquivos (logos)" usado={uso.arquivos_bytes} limite={LIMITES.arquivos}
              formatar={formatarBytes}
              detalhe={`${formatarNumero(uso.arquivos_qtd)} ${Number(uso.arquivos_qtd) === 1 ? 'arquivo' : 'arquivos'}`}
              renova="Não renova: é o que está guardado">
              <Tendencia pontos={historico} campo="arquivos_bytes" formatar={formatarBytes} rotulo="Arquivos" />
            </Medidor>
            <Medidor titulo="Usuários ativos no ciclo" usado={uso.usuarios_ativos} limite={LIMITES.ativos}
              formatar={formatarNumero}
              detalhe={`${formatarNumero(uso.usuarios_total)} ${Number(uso.usuarios_total) === 1 ? 'conta' : 'contas'} no total`}
              ciclico renova={textoRenovacao(ciclo)}>
              <Tendencia pontos={historico} campo="usuarios_ativos" formatar={formatarNumero} rotulo="Usuários ativos" />
            </Medidor>
          </div>

          {uso.tabelas?.length > 0 && (
            <details className="group" open>
              <summary className="text-sm font-medium cursor-pointer text-cal-2 hover:text-cal">
                Maiores tabelas, por espaço
              </summary>
              <BarrasTabelas tabelas={uso.tabelas} />
            </details>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-micro text-cal-3">
              Medido em {formatarHora(uso.medido_em)} · {formatarNumero(uso.barbearias)} {Number(uso.barbearias) === 1 ? 'barbearia' : 'barbearias'}.
              Tráfego: 5 GB por ciclo, também zera {ciclo ? `em ${ciclo.data}` : 'na virada'}; o gasto só aparece no painel do Supabase.
            </p>
            <a href={LINK_USO} target="_blank" rel="noreferrer"
              className="btn-secondary text-micro px-3 flex items-center gap-1.5 whitespace-nowrap">
              Ver no Supabase
              <ExternalLink size={13} />
            </a>
          </div>
        </>
      )}
    </div>
  )
}
