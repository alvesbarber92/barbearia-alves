import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { TERMOS_ATUALIZADO_EM, TERMOS_VERSAO } from '../../legal'

export default function LegalLayout({ titulo, resumo, children }) {
  return (
    <div className="min-h-screen bg-concreto">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-apoio mb-8 text-cal-2 hover:text-cal transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar
        </Link>

        <p className="text-apoio font-semibold text-cal-2 mb-2">BarberVez</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-cal">
          {titulo}
        </h1>
        {resumo && (
          <p className="mt-3 text-base leading-relaxed text-cal-2">
            {resumo}
          </p>
        )}

        <hr className="my-8 border-junta" />

        <div className="space-y-8">{children}</div>

        <hr className="my-8 border-junta" />

        <p className="text-micro text-cal-2">
          Atualizado em {TERMOS_ATUALIZADO_EM} · versão {TERMOS_VERSAO}
        </p>
      </div>
    </div>
  )
}

export function Secao({ numero, titulo, children }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-card text-cal">
        {numero}. {titulo}
      </h2>
      <div className="space-y-3 text-corpo leading-relaxed text-cal-2">
        {children}
      </div>
    </section>
  )
}
