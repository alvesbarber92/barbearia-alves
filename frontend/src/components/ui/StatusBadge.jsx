const SELOS = {
  confirmado: null,
  concluido:  { texto: 'concluído', classe: 'bg-ok-fundo text-ok' },
  cancelado:  { texto: 'cancelado', classe: 'bg-danger-fundo text-danger' },
  faltou:     { texto: 'faltou',    classe: 'bg-warn-fundo text-warn' },
  pendente:   { texto: 'pendente',  classe: 'bg-warn-fundo text-warn' },
}

export default function StatusBadge({ status }) {
  const selo = SELOS[status]

  if (selo) {
    return (
      <span className={`inline-flex text-micro font-semibold px-2 py-0.5 rounded-chapa ${selo.classe}`}>
        {selo.texto}
      </span>
    )
  }

  if (status && !(status in SELOS)) {
    return (
      <span className="inline-flex text-micro font-semibold px-2 py-0.5 rounded-chapa border border-junta-forte text-cal-3">
        {status}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-micro font-semibold px-2 py-0.5 rounded-chapa border border-junta-forte text-cal-2">
      <span className="w-1.5 h-1.5 rounded-full bg-ok" />
      confirmado
    </span>
  )
}
