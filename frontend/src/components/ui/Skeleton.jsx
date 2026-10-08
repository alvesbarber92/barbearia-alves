export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-chapa bg-elevado ${className}`} />
  )
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}
