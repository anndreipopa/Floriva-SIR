function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/70 ${className}`}
      aria-hidden="true"
    />
  )
}

const glassPanel =
  'rounded-2xl border border-white/85 bg-white/55 ' +
  'backdrop-blur-md shadow-[0_14px_32px_-20px_rgba(20,110,105,0.35)]'

export function EnvironmentPageSkeleton() {
  return (
    <main
      className="mx-auto w-full max-w-[1500px]"
      aria-busy="true"
      aria-label="Loading environment data"
    >
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <SkeletonBlock className="mb-3 h-4 w-40" />
          <SkeletonBlock className="h-11 w-64" />
          <SkeletonBlock className="mt-3 h-4 w-80 max-w-full" />
        </div>

        <div className="hidden sm:block">
          <SkeletonBlock className="mb-2 ml-auto h-4 w-28" />
          <SkeletonBlock className="h-5 w-48" />
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          <section>
            <div className="mb-3 flex justify-between gap-4">
              <div>
                <SkeletonBlock className="mb-2 h-3 w-24" />
                <SkeletonBlock className="h-7 w-48" />
              </div>

              <SkeletonBlock className="h-5 w-28" />
            </div>

            <div className={`${glassPanel} grid gap-px bg-white/70 sm:grid-cols-3`}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="min-h-40 p-6" key={index}>
                  <SkeletonBlock className="mb-6 h-4 w-28" />
                  <SkeletonBlock className="h-12 w-36" />
                </div>
              ))}
            </div>
          </section>

          <section>
            <SkeletonBlock className="mb-2 h-3 w-32" />
            <SkeletonBlock className="mb-2 h-7 w-40" />
            <SkeletonBlock className="mb-3 h-4 w-48" />
            <SkeletonBlock className={`${glassPanel} h-[440px] w-full`} />
          </section>

          <section>
            <SkeletonBlock className="mb-2 h-3 w-28" />
            <SkeletonBlock className="mb-3 h-7 w-40" />

            <div className={`${glassPanel} grid gap-px bg-white/70 sm:grid-cols-3`}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="p-5" key={index}>
                  <SkeletonBlock className="mb-4 h-4 w-32" />
                  <SkeletonBlock className="h-9 w-24" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <div className={`${glassPanel} p-5`}>
            <SkeletonBlock className="mb-6 h-7 w-36" />
            <SkeletonBlock className="mb-4 h-5 w-full" />
            <SkeletonBlock className="mb-4 h-5 w-full" />
            <SkeletonBlock className="mb-4 h-5 w-full" />
            <SkeletonBlock className="h-5 w-4/5" />
          </div>

          <div className={`${glassPanel} p-5`}>
            <SkeletonBlock className="mb-2 h-3 w-24" />
            <SkeletonBlock className="mb-6 h-7 w-44" />
            <SkeletonBlock className="h-24 w-full" />
          </div>
        </aside>
      </div>

      <span className="sr-only">Loading environment data...</span>
    </main>
  )
}