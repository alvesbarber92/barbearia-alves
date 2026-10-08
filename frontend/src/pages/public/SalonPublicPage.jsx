import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { lerSalaoGuardado, guardarSalao } from '../../lib/salaoGuardado'
import { formatDuracao, brlCompacto } from '../../lib/agenda'
import { Skeleton } from '../../components/ui/Skeleton'
import Monogram from '../../components/ui/Monogram'
import { useAccent } from '../../hooks/useAccent'

export default function SalonPublicPage() {
  const { slug } = useParams()
  const [salon, setSalon] = useState(() => lerSalaoGuardado(slug) ?? undefined)
  useAccent(salon?.cor_primaria)
  const [servicos, setServicos] = useState([])
  const [expediente, setExpediente] = useState(null)

  useEffect(() => {
    if (!slug) return
    supabase.rpc('vitrine_servicos', { p_slug: slug })
      .then(({ data }) => setServicos(data || []))
    supabase.rpc('vitrine_horarios', { p_slug: slug })
      .then(({ data }) => {
        const ativos = (data || []).filter(h => h.ativo)
        if (ativos.length) {
          setExpediente({
            abertura:   ativos.reduce((m, h) => (h.abertura < m ? h.abertura : m), ativos[0].abertura).slice(0, 5),
            fechamento: ativos.reduce((m, h) => (h.fechamento > m ? h.fechamento : m), ativos[0].fechamento).slice(0, 5),
          })
        }
      })
  }, [slug])

  useEffect(() => {
    supabase.rpc('salao_publico', { p_slug: slug }).maybeSingle()
      .then(({ data, error }) => {
        if (!error) guardarSalao(slug, data)
        setSalon(salonAtual => (error && salonAtual ? salonAtual : data ?? null))
      })
  }, [slug])

  if (salon === undefined) {
    return (
      <div className="min-h-screen bg-concreto flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-24 w-20 mx-auto" />
          <Skeleton className="h-8 w-2/3 mx-auto" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  if (salon === null) {
    return (
      <div className="min-h-screen bg-concreto flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <h1 className="font-display text-2xl text-cal">Barbearia não encontrada</h1>
          <p className="text-sm text-cal-3">Confira o link com a barbearia e tente de novo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-concreto flex flex-col items-center px-6 py-12">
      <main className="w-full max-w-sm flex flex-col items-center text-center anim-pop">

        <Monogram nome={salon.nome} logoUrl={salon.logo_url} size="lg" />

        <p className="text-apoio font-semibold text-cal-2 mt-6">Agendamento online</p>
        <h1 className="font-display text-4xl text-cal mt-2 leading-tight">{salon.nome}</h1>
        <p className="text-sm text-cal-2 mt-3">
          Escolha o serviço, o dia e o horário — em menos de um minuto.
        </p>

        <Link to={`/${slug}/agendar`} state={{ salon }} className="btn-primary w-full mt-8">
          Agendar horário
        </Link>

        {servicos.length > 0 && (
          <div className="card w-full mt-8 text-left p-0 overflow-hidden">
            <p className="text-apoio font-semibold text-cal-2 px-5 pt-4 pb-2">Serviços</p>
            {servicos.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-baseline justify-between px-5 py-3.5 ${i > 0 ? "border-t border-junta" : ""}`}
              >
                <div>
                  <p className="font-semibold text-cal text-sm">{s.nome}</p>
                  <p className="text-xs text-cal-3 mt-0.5 tabular-nums">{formatDuracao(s.duracao || 60)}</p>
                </div>
                <p className="font-display text-lg text-acento-texto tabular-nums">{brlCompacto(s.preco || 0)}</p>
              </div>
            ))}
          </div>
        )}

        {expediente && (
          <p className="text-xs text-cal-3 mt-6 tabular-nums">
            Atendimento das {expediente.abertura} às {expediente.fechamento}
          </p>
        )}
      </main>
    </div>
  )
}
