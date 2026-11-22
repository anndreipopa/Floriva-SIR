import { Plant } from '@phosphor-icons/react'
import { GlassPanel } from '../components/GlassPanel'
import { CalibrationCard } from '../components/plants/CalibrationCard'
import { useCalibration } from '../hooks/useCalibration'

/** Only pot 1 has a load cell so far; slots 2 and 3 are placeholders. */
const CALIBRATED_POT = 1
const PLACEHOLDER_POTS = [2, 3] as const

/**
 * The three pot slots on the rail. Slot 1 = "Plant 1" with its moisture calibration.
 * Plant names, species and Trefle data come later (design D5: a calibration belongs to the
 * pot slot for now).
 */
export function PlantsPage() {
  const {
    calibration,
    latestReading,
    isLoading,
    loadError,
    actionError,
    pendingAction,
    now,
    run,
  } = useCalibration(CALIBRATED_POT)

  return (
    <main className="grid w-full gap-3 animate-rise-in lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <header className="lg:col-span-2">
        <h1 className="m-0 text-3xl font-extrabold tracking-tight text-ink">Plants</h1>
        <p className="m-0 mt-1 text-sm text-muted">Three pot slots on the rail, left to right.</p>
      </header>

      <div className="flex min-w-0 flex-col gap-3">
        <SlotHeader pot={CALIBRATED_POT} name="Plant 1" />

        {loadError && (
          <GlassPanel className="border-accent/50 px-5 py-4" role="alert">
            <p className="m-0 font-bold text-ink">Could not load the calibration.</p>
            <p className="m-0 mt-1 text-sm text-muted">{loadError}</p>
          </GlassPanel>
        )}

        {isLoading || !calibration ? (
          <CalibrationCardSkeleton />
        ) : (
          <CalibrationCard
            calibration={calibration}
            latestReading={latestReading}
            now={now}
            pendingAction={pendingAction}
            actionError={actionError}
            onAction={(action) => void run(action)}
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {PLACEHOLDER_POTS.map((pot) => (
          <GlassPanel key={pot} as="section" className="p-5" aria-labelledby={`slot-${pot}`}>
            <h2 id={`slot-${pot}`} className="m-0 flex items-center gap-2 text-lg font-extrabold text-muted">
              <Plant size={22} weight="duotone" aria-hidden="true" />
              Slot {pot}
            </h2>
            <p className="m-0 mt-2 text-sm text-muted">No scale under this pot yet.</p>
          </GlassPanel>
        ))}
      </div>
    </main>
  )
}

function SlotHeader({ pot, name }: { pot: number; name: string }) {
  return (
    <GlassPanel as="div" className="flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint/20 text-forest">
        <Plant size={26} weight="duotone" aria-hidden="true" />
      </span>
      <div>
        <p className="m-0 text-lg font-extrabold text-ink">{name}</p>
        <p className="m-0 text-sm text-muted">Slot {pot} · load cell under the pot</p>
      </div>
    </GlassPanel>
  )
}

/** Mirrors the card's layout while the first request is in flight. */
function CalibrationCardSkeleton() {
  return (
    <GlassPanel variant="skeleton" className="flex flex-col gap-4 p-5" aria-busy="true">
      <span className="sr-only">Loading calibration…</span>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-white/70" />
        <div className="h-5 w-48 animate-pulse rounded-lg bg-white/70" />
      </div>
      <div className="h-4 w-3/4 animate-pulse rounded-lg bg-white/70" />
      <div className="h-32 animate-pulse rounded-xl bg-white/70" />
    </GlassPanel>
  )
}
