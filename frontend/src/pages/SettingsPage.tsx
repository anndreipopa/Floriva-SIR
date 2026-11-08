import { GlassPanel } from '../components/GlassPanel'
import { SystemStatusCard } from '../components/SystemStatusCard'
import { useEnvironmentReadings } from '../hooks/useEnvironmentReadings'
import { isReadingFresh } from '../lib/conditions'

export function SettingsPage() {
  const { latest, history, isLoading, apiError, realtimeStatus, lastSensorReceivedAt, now } =
    useEnvironmentReadings()

  const readingAgeMs = lastSensorReceivedAt === null ? null : now - lastSensorReceivedAt

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 animate-rise-in">
      <header>
        <h1 className="m-0 text-3xl font-extrabold tracking-tight text-ink">Settings</h1>
        <p className="m-0 mt-1 text-sm text-muted">
          Connection health now; robot configuration will live here later.
        </p>
      </header>

      {apiError && (
        <GlassPanel className="border-accent/50 px-5 py-4" role="alert">
          <p className="m-0 font-bold text-ink">Could not load environment data.</p>
          <p className="m-0 mt-1 text-sm text-muted">{apiError}</p>
        </GlassPanel>
      )}

      <div aria-busy={isLoading}>
        <SystemStatusCard
          realtimeStatus={realtimeStatus}
          latestReceivedAtUtc={latest?.receivedAtUtc ?? null}
          isFresh={isReadingFresh(readingAgeMs)}
          storedReadings={history.length}
        />
      </div>
    </main>
  )
}
