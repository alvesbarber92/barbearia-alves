export default function PageHeader({ title, subtitle, meta, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-baseline gap-2">
          <h1 className="font-display text-tela">{title}</h1>
          {meta && <span className="text-apoio text-cal-3">{meta}</span>}
        </div>
        {subtitle && <p className="text-apoio text-cal-2 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
