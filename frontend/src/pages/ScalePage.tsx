import { useState } from 'react'
import { GlassPanel } from '../components/GlassPanel'
import { CurrentWeightCard } from '../components/scale/CurrentWeightCard'
import { DriftSummaryCard } from '../components/scale/DriftSummaryCard'
import { ScalePageSkeleton } from '../components/scale/ScalePageSkeleton'
import { ScaleStatusCard } from '../components/scale/ScaleStatusCard'
import { WeightChart } from '../components/scale/WeightChart'
import { useWeightReadings } from '../hooks/useWeightReadings'
import { HISTORY_WINDOWS, isWeightFresh, summarizeWeights, timeOf } from '../lib/weight'

/** Only pot 1 has a load cell so far. */
const POT = 1
/** The drift test runs for about two days, so that is the default view. */
const DEFAULT_WINDOW_HOURS = 48

/**
 * Remote view of the scale, built for the creep/drift test:
 *   left  = current weight / chart (flex)
 *   right = device status / drift numbers
 * Desktop: one screen, no scrolling. Mobile: stacked in reading order.
 */
export function ScalePage() {
  const [windowHours, setWindowHours] = useState<number>(DEFAULT_WINDOW_HOURS)
  const { latest, history, isLoading, apiError, realtimeStatus, now } = useWeightReadings(
    POT,
    windowHours,
  )

  if (isLoading) {
    return <ScalePageSkeleton />
  }

  const windowLabel =
    HISTORY_WINDOWS.find((option) => option.hours === windowHours)?.label ?? `${windowHours} h`
  const isFresh = isWeightFresh(latest ? now - timeOf(latest) : null)
  const summary = summarizeWeights(history)

  return (
    <main className="grid w-full gap-3 animate-rise-in lg:h-full lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
      <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 text-3xl font-extrabold tracking-tight text-ink">Scale</h1>
            <p className="m-0 mt-1 text-sm text-muted">Load cell under pot {POT}, live from the robot.</p>
          </div>

          <div className="flex gap-1.5" role="group" aria-label="Time window">
            {HISTORY_WINDOWS.map((option) => {
              const selected = option.hours === windowHours
              return (
                <button
                  key={option.hours}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setWindowHours(option.hours)}
                  className={`min-h-8 rounded-lg px-3 text-xs font-extrabold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 ${
                    selected
                      ? 'bg-white text-forest shadow-[0_3px_10px_-5px_rgba(20,110,105,0.45)]'
                      : 'bg-white/50 text-muted hover:bg-white/80 hover:text-ink'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </header>

        {apiError && (
          <GlassPanel className="border-accent/50 px-5 py-4" role="alert">
            <p className="m-0 font-bold text-ink">Could not load weight data.</p>
            <p className="m-0 mt-1 text-sm text-muted">{apiError}</p>
          </GlassPanel>
        )}

        <CurrentWeightCard pot={POT} latest={latest} now={now} isFresh={isFresh} />

        <div className="lg:min-h-0 lg:flex-1">
          <WeightChart readings={history} windowLabel={windowLabel} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <ScaleStatusCard
          latest={latest}
          realtimeStatus={realtimeStatus}
          isFresh={isFresh}
          now={now}
        />
        <DriftSummaryCard summary={summary} windowLabel={windowLabel} />
      </div>
    </main>
  )
}
