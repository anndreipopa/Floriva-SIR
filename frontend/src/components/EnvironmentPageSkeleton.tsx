function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-sm bg-border/80 ${className}`}
      aria-hidden="true"
    />
  )
}

export function EnvironmentPageSkeleton() {
  return (
    <main
      className="mx-auto w-full max-w-[1500px]"
      aria-busy="true"
      aria-label="Loading environment data"
    >
      <header className="mb-10 flex items-end justify-between gap-4">
        <div>
          <SkeletonBlock className="mb-3 h-4 w-36" />
          <SkeletonBlock className="h-11 w-56" />
        </div>

        <div className="hidden sm:block">
          <SkeletonBlock className="mb-2 ml-auto h-4 w-24" />
          <SkeletonBlock className="h-4 w-44" />
        </div>
      </header>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-10">
          <section>
            <div className="mb-4 flex justify-between gap-4">
              <SkeletonBlock className="h-7 w-44" />
              <SkeletonBlock className="h-5 w-28" />
            </div>

            <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  className="min-h-40 bg-surface px-7 py-8"
                  key={index}
                >
                  <SkeletonBlock className="mb-6 h-4 w-24" />
                  <SkeletonBlock className="h-14 w-36" />
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-border pt-8">
            <SkeletonBlock className="mb-3 h-7 w-36" />
            <SkeletonBlock className="mb-4 h-4 w-48" />
            <SkeletonBlock className="h-96 w-full bg-surface" />
          </section>

          <section className="border-t border-border pt-8">
            <SkeletonBlock className="mb-4 h-7 w-40" />
            <SkeletonBlock className="h-32 w-full bg-surface" />
          </section>
        </div>

        <aside className="space-y-8">
          <div className="border border-border bg-surface p-6">
            <SkeletonBlock className="mb-6 h-7 w-36" />
            <SkeletonBlock className="mb-3 h-5 w-full" />
            <SkeletonBlock className="mb-3 h-5 w-4/5" />
            <SkeletonBlock className="h-5 w-3/5" />
          </div>

          <div className="border border-border bg-surface p-6">
            <SkeletonBlock className="mb-6 h-7 w-44" />
            <SkeletonBlock className="mb-3 h-5 w-full" />
            <SkeletonBlock className="h-5 w-2/3" />
          </div>
        </aside>
      </div>

      <span className="sr-only">Loading environment data...</span>
    </main>
  )
}