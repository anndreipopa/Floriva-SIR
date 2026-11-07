import { GlassPanel } from './GlassPanel'

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/70 ${className}`}
      aria-hidden="true"
    />
  )
}

export function EnvironmentPageSkeleton() {
  return (
    <main
      className="w-full lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-3"
      aria-busy="true"
      aria-label="Loading environment data"
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-0">
        <div>
          <SkeletonBlock className="h-9 w-48" />
          <SkeletonBlock className="mt-2 h-4 w-80 max-w-full" />
        </div>

        <div className="rounded-xl border border-white/85 bg-white/45 px-3 py-2">
          <SkeletonBlock className="mb-2 h-3 w-24" />
          <SkeletonBlock className="h-4 w-40" />
        </div>
      </header>

      <div className="grid min-h-0 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5 lg:grid lg:min-h-0 lg:grid-rows-[auto_minmax(240px,1fr)_auto] lg:gap-3 lg:space-y-0">
          <section aria-label="Loading current conditions">
            <SkeletonBlock className="mb-2 h-6 w-40" />

            <GlassPanel
              variant="skeleton"
              className="grid overflow-hidden gap-px bg-white/70 sm:grid-cols-3"
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="min-w-0 bg-white/35 px-4 py-5"
                  key={index}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <SkeletonBlock className="h-8 w-8 rounded-lg" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>

                  <SkeletonBlock className="h-9 w-24" />
                </div>
              ))}
            </GlassPanel>
          </section>

          <section
            className="min-h-0"
            aria-label="Loading environment history"
          >
            <GlassPanel
              variant="skeleton"
              className="flex h-full min-h-[240px] flex-col overflow-hidden"
            >
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/80 px-5 py-5 sm:px-6">
                <div>
                  <SkeletonBlock className="h-5 w-28" />
                  <SkeletonBlock className="mt-2 h-4 w-56 max-w-full" />
                </div>

                <div className="flex flex-wrap gap-1 rounded-xl border border-white/80 bg-cyan-soft/50 p-1">
                  <SkeletonBlock className="h-9 w-24 rounded-lg" />
                  <SkeletonBlock className="h-9 w-20 rounded-lg" />
                  <SkeletonBlock className="h-9 w-16 rounded-lg" />
                </div>
              </header>

              <div className="min-h-[240px] flex-1 bg-white/20" />
            </GlassPanel>
          </section>

          <section aria-label="Loading daily summary">
            <SkeletonBlock className="mb-2 h-6 w-32" />

            <GlassPanel
              variant="skeleton"
              className="grid overflow-hidden gap-px bg-white/70 sm:grid-cols-3"
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="bg-white/35 px-4 py-3"
                  key={index}
                >
                  <SkeletonBlock className="mb-2 h-3 w-32" />
                  <SkeletonBlock className="h-7 w-20" />
                </div>
              ))}
            </GlassPanel>
          </section>
        </div>

        <aside className="space-y-4 lg:grid lg:min-h-0 lg:grid-rows-[auto_auto] lg:content-start lg:gap-3 lg:space-y-0">
          <GlassPanel
            as="section"
            variant="skeleton"
            className="p-4"
            aria-label="Loading system status"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <SkeletonBlock className="h-6 w-32" />
              <SkeletonBlock className="h-3 w-3 rounded-full" />
            </div>

            <div>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="flex items-center justify-between gap-3 border-t border-border/50 py-2 first:border-t-0 first:pt-0"
                  key={index}
                >
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-4 w-24" />
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel
            as="section"
            variant="skeleton"
            className="p-4"
            aria-label="Loading weather forecast"
          >
            <SkeletonBlock className="mb-2 h-3 w-24" />
            <SkeletonBlock className="h-6 w-40" />

            <div className="mt-3 rounded-xl border border-cyan/20 bg-cyan-soft/40 p-3">
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="mt-2 h-4 w-full" />
              <SkeletonBlock className="mt-2 h-4 w-4/5" />
            </div>
          </GlassPanel>
        </aside>
      </div>

      <span className="sr-only">Loading environment data...</span>
    </main>
  )
}