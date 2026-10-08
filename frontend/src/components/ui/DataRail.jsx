const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export default function DataRail({ iso }) {
  const d = new Date(iso)
  return (
    <div className="w-12 flex-shrink-0 text-center rounded-chapa bg-elevado py-1.5">
      <p className="num text-card font-semibold leading-none">{d.getDate()}</p>
      <p className="text-micro text-cal-2 mt-0.5">{MESES[d.getMonth()]}</p>
    </div>
  )
}
