import { GlassPanel } from './GlassPanel'

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/70 ${className}`}
      aria-hidden="true"
    />
  )
}

/** Mirrors the Environment page layout (one screen on desktop) while data loads. */
export function EnvironmentPageSkeleton() {
  return (
    <main
      className="grid w-full gap-3 lg:h-full lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]"
      aria-busy="true"
      aria-label="Loading environment data"
    >
      <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
        <GlassPanel
          variant="skeleton"
          className="flex h-[260px] flex-col justify-between p-5 sm:h-[300px] sm:p-6 lg:h-auto lg:min-h-0 lg:flex-[1_1_0] lg:p-7"
        >
          <SkeletonBlock className="h-3 w-52" />
          <div>
            <SkeletonBlock className="h-16 w-52" />
            <SkeletonBlock className="mt-3 h-5 w-72 max-w-full" />
          </div>
        </GlassPanel>

        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <GlassPanel variant="skeleton" className="p-4" key={index}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SkeletonBlock className="h-8 w-8" />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
                <SkeletonBlock className="h-5 w-16" />
              </div>
              <SkeletonBlock className="mt-3 h-8 w-24" />
              <SkeletonBlock className="mt-4 h-2.5 w-full rounded-full" />
              <SkeletonBlock className="mt-2 h-4 w-full" />
              <SkeletonBlock className="mt-3 h-4 w-full" />
            </GlassPanel>
          ))}
        </div>

        <GlassPanel
          variant="skeleton"
          className="flex h-[380px] flex-col overflow-hidden lg:h-auto lg:min-h-[240px] lg:flex-[1.35_1_0]"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-8 w-8" />
              <div>
                <SkeletonBlock className="h-4 w-20" />
                <SkeletonBlock className="mt-1 h-3 w-36" />
              </div>
            </div>

            <div className="flex gap-1.5">
              <SkeletonBlock className="h-8 w-28" />
              <SkeletonBlock className="h-8 w-24" />
              <SkeletonBlock className="h-8 w-16" />
            </div>
          </header>

          <div className="flex-1 bg-white/20" />
        </GlassPanel>
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
        <GlassPanel variant="skeleton" className="flex flex-col overflow-hidden lg:flex-1">
          <div className="min-h-[150px] flex-1 bg-gradient-to-b from-sky-day/40 to-white/30 p-4">
            <SkeletonBlock className="h-3 w-32" />
            <SkeletonBlock className="mt-3 h-12 w-20" />
            <SkeletonBlock className="mt-2 h-4 w-36" />
          </div>
          <div className="space-y-2 p-4">
            <SkeletonBlock className="h-9 w-full" />
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock className="h-7 w-full" key={index} />
            ))}
          </div>
        </GlassPanel>

        <GlassPanel variant="skeleton" className="p-4">
          <SkeletonBlock className="mb-3 h-6 w-36" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="flex items-center justify-between py-1.5" key={index}>
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-6 w-16" />
            </div>
          ))}
        </GlassPanel>
      </div>

      <span className="sr-only">Loading environment data...</span>
    </main>
  )
}
