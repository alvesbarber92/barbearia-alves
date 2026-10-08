export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-14 h-14 mb-4 rounded-chapa bg-elevado flex items-center justify-center">
          <Icon size={24} className="text-cal-2" />
        </div>
      )}
      <h3 className="font-display text-card mb-1">{title}</h3>
      {description && <p className="text-apoio text-cal-2 mb-5 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
