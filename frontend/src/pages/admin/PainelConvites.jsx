import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Ticket, Copy, Check, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const PRAZOS = [
  { minutos: 5,   label: '5 min' },
  { minutos: 30,  label: '30 min' },
  { minutos: 240, label: '4 horas' },
]

function formatarQuando(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function restante(expiraEm, agora) {
  const ms = new Date(expiraEm).getTime() - agora
  if (Number.isNaN(ms) || ms <= 0) return null
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function situacao(c, agora) {
  if (c.usado_em) return { texto: `Usado por ${c.usado_por_email || '—'}`, cor: 'text-cal-3' }
  const falta = restante(c.expira_em, agora)
  if (!falta) return { texto: 'Expirado', cor: 'text-cal-3' }
  return { texto: `Expira em ${falta}`, cor: 'text-ok' }
}

export default function PainelConvites() {
  const [convites, setConvites] = useState([])
  const [nota, setNota] = useState('')
  const [minutos, setMinutos] = useState(5)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(null)
  const [agora, setAgora] = useState(() => Date.now())

  const carregar = useCallback(() => {
    supabase.rpc('admin_listar_convites', { p_limite: 12 }).then(({ data, error }) => {
      if (error) { toast.error('Não foi possível carregar os convites.'); return }
      setConvites(data || [])
    })
  }, [])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const gerar = async () => {
    setGerando(true)
    const { data, error } = await supabase.rpc('admin_gerar_convite', {
      p_nota: nota || null,
      p_minutos: minutos,
    })
    setGerando(false)
    if (error) { toast.error('Não foi possível gerar o convite.'); return }

    const novo = Array.isArray(data) ? data[0] : data
    setNota('')
    carregar()
    copiar(novo.codigo)
    toast.success('Convite gerado e copiado.')
  }

  const copiar = (codigo) => {
    const link = `${window.location.origin}/cadastro?convite=${codigo}`
    navigator.clipboard.writeText(link)
    setCopiado(codigo)
    setTimeout(() => setCopiado(c => (c === codigo ? null : c)), 2000)
  }

  return (
    <div className="card space-y-4">

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ticket size={16} className="text-cal-3" />
          <h2 className="font-display text-base font-semibold text-cal">
            Convites
          </h2>
        </div>
        <button onClick={carregar} className="p-1.5 rounded-controle transition-colors hover:bg-elevado"
          aria-label="Recarregar convites">
          <RefreshCw size={14} className="text-cal-3" />
        </button>
      </div>

      <p className="text-sm text-cal-3">
        Sem convite não se cria barbearia. Cada código serve uma vez só e vence no prazo
        escolhido — o botão copia o link pronto para mandar no WhatsApp.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[10rem] space-y-1">
          <label className="text-sm font-medium text-cal-2" htmlFor="conv-nota">
            Para quem <span className="text-cal-3">(opcional)</span>
          </label>
          <input id="conv-nota" value={nota} onChange={e => setNota(e.target.value)}
            className="input-base" placeholder="Ex.: Barbearia do Zé — José" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-cal-2" htmlFor="conv-prazo">
            Vale por
          </label>
          <select id="conv-prazo" value={minutos} onChange={e => setMinutos(Number(e.target.value))}
            className="input-base w-auto">
            {PRAZOS.map(p => <option key={p.minutos} value={p.minutos}>{p.label}</option>)}
          </select>
        </div>
        <button onClick={gerar} disabled={gerando} className="btn-primary whitespace-nowrap">
          {gerando ? 'Gerando…' : 'Gerar convite'}
        </button>
      </div>

      {convites.length === 0 ? (
        <p className="text-sm py-2 text-cal-3">
          Nenhum convite emitido ainda.
        </p>
      ) : (
        <ul className="divide-y border-junta">
          {convites.map(c => {
            const s = situacao(c, agora)
            const usavel = !c.usado_em && restante(c.expira_em, agora)
            return (
              <li key={c.codigo} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`font-display text-card tracking-wide ${usavel ? "text-cal" : "text-cal-3"}`}>
                    {c.codigo}
                  </p>
                  <p className={`text-micro truncate ${s.cor}`}>
                    {s.texto}
                    {c.nota && <span className="text-cal-3"> · {c.nota}</span>}
                  </p>
                  {c.salao_nome && (
                    <p className="text-xs truncate text-cal-3">
                      Virou {c.salao_nome} · {formatarQuando(c.usado_em)}
                    </p>
                  )}
                </div>
                {usavel && (
                  <button onClick={() => copiar(c.codigo)}
                    className="btn-secondary text-micro px-3 flex items-center gap-1.5 whitespace-nowrap">
                    {copiado === c.codigo ? <Check size={13} /> : <Copy size={13} />}
                    {copiado === c.codigo ? 'Copiado' : 'Copiar link'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
