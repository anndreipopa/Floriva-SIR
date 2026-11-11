import { GlassPanel } from '../GlassPanel'

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/70 ${className}`} aria-hidden="true" />
}

/** Mirrors the Scale page layout while the first data loads. */
export function ScalePageSkeleton() {
  return (
    <main
      className="grid w-full gap-3 lg:h-full lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]"
      aria-busy="true"
      aria-label="Loading scale data"
    >
      <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
        <SkeletonBlock className="h-9 w-64" />
        <GlassPanel variant="skeleton" className="flex flex-col gap-4 p-5 sm:p-6">
          <SkeletonBlock className="h-4 w-44" />
          <SkeletonBlock className="h-16 w-48" />
          <SkeletonBlock className="h-4 w-72 max-w-full" />
        </GlassPanel>
        <GlassPanel variant="skeleton" className="h-[300px] p-4 lg:h-auto lg:min-h-0 lg:flex-1">
          <SkeletonBlock className="h-4 w-40" />
        </GlassPanel>
      </div>

      <div className="flex flex-col gap-3">
        {[5, 7].map((rows) => (
          <GlassPanel variant="skeleton" className="p-4" key={rows}>
            <SkeletonBlock className="mb-3 h-6 w-32" />
            {Array.from({ length: rows }).map((_, index) => (
              <SkeletonBlock className="mb-2 h-4 w-full" key={index} />
            ))}
          </GlassPanel>
        ))}
      </div>
      <span className="sr-only">Loading scale data…</span>
    </main>
  )
}
