import { Scales } from '@phosphor-icons/react'
import type { WeightReading } from '../../types/weight'
import { formatClock, formatDuration, timeOf } from '../../lib/weight'
import { GlassPanel } from '../GlassPanel'

interface CurrentWeightCardProps {
  pot: number
  latest: WeightReading | null
  now: number
  isFresh: boolean
}

/** The one focal number of the page: the latest weight, when it was taken, and how clean it was. */
export function CurrentWeightCard({ pot, latest, now, isFresh }: CurrentWeightCardProps) {
  return (
    <GlassPanel
      as="section"
      className="flex flex-col justify-between gap-4 bg-gradient-to-br from-cyan/10 via-white/40 to-white/20 p-5 sm:p-6"
      aria-labelledby="current-weight-heading"
    >
      <header className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-forest/10 text-forest">
          <Scales size={22} weight="duotone" aria-hidden="true" />
        </span>
        <h2 id="current-weight-heading" className="m-0 text-sm font-bold text-muted">
          Pot {pot} · current weight
        </h2>
      </header>

      {latest ? (
        <>
          <p className="m-0 flex items-baseline gap-2 text-ink">
            <span className="text-6xl font-extrabold tracking-tight tabular sm:text-7xl">
              {latest.grams.toLocaleString()}
            </span>
            <span className="text-2xl font-bold text-muted">g</span>
          </p>

          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
            <time dateTime={latest.receivedAtUtc}>
              Measured {formatDuration((now - timeOf(latest)) / 1000)} ago ·{' '}
              {formatClock(timeOf(latest))}
            </time>

            <span
              className={`rounded-lg px-2 py-0.5 text-xs font-extrabold uppercase ${
                latest.stable ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
              }`}
            >
              {latest.stable ? 'Stable' : 'Unstable'}
            </span>

            {!isFresh && (
              <span className="rounded-lg bg-warning/15 px-2 py-0.5 text-xs font-extrabold uppercase text-warning">
                Stale
              </span>
            )}

            <span className="tabular">spread {latest.spreadRaw.toLocaleString()} counts</span>
          </div>
        </>
      ) : (
        <div>
          <p className="m-0 font-extrabold text-ink">No weight readings yet</p>
          <p className="m-0 mt-1 text-sm text-muted">
            The ESP32 sends its first weighing after its warm-up (about 5 minutes after it
            starts).
          </p>
        </div>
      )}
    </GlassPanel>
  )
}
