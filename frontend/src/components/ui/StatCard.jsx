const TAMANHO_DO_VALOR = 'clamp(1rem, 5.5vw, 2.125rem)'

export default function StatCard({ icon: Icon, label, value, sub, alert, className = '' }) {
  return (
    <div className={`card p-4 md:p-5 space-y-3 min-w-0 ${alert ? 'border-danger bg-danger-fundo' : ''} ${className}`}>
      <div className={`w-9 h-9 rounded-chapa flex items-center justify-center ${alert ? 'bg-danger/15' : 'bg-elevado'}`}>
        <Icon size={17} className={alert ? 'text-danger' : 'text-cal-2'} />
      </div>
      <p className="num font-semibold leading-[1.05] tracking-[-0.01em] [overflow-wrap:anywhere]"
         style={{ fontSize: TAMANHO_DO_VALOR }}>{value}</p>
      <div>
        <p className={`text-apoio font-semibold ${alert ? 'text-danger' : 'text-cal-2'}`}>{label}</p>
        {sub && <p className="text-micro text-cal-3 mt-0.5 [overflow-wrap:anywhere]">{sub}</p>}
      </div>
    </div>
  )
}

export function MiniStat({ label, value, sub }) {
  return (
    <div className="rounded-superficie bg-elevado p-4 min-w-0">
      <p className="text-micro font-semibold text-cal-2 mb-1">{label}</p>
      <p className="num text-card font-semibold [overflow-wrap:anywhere]">{value}</p>
      {sub && <p className="text-micro text-cal-2 mt-0.5 [overflow-wrap:anywhere]">{sub}</p>}
    </div>
  )
}
