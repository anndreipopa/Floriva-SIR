import { EnvironmentHistoryChart } from '../components/EnvironmentHistoryChart'
import { EnvironmentPageSkeleton } from '../components/EnvironmentPageSkeleton'
import { ReadingMetric } from '../components/ReadingMetric'
import type { EnvironmentReading } from '../types/sensorReading'
import { useEnvironmentReadings } from '../hooks/useEnvironmentReadings'


type Metric = 'temperature' | 'humidity' | 'lux'

function average(readings: EnvironmentReading[], metric: Metric) {
  if (readings.length === 0) return null

  const total = readings.reduce(
    (sum, reading) => sum + reading[metric],
    0,
  )

  return total / readings.length
}

export function EnvironmentPage() {
      const {
      latest,
      history,
      isLoading,
      apiError,
      realtimeStatus,
      now,
    } = useEnvironmentReadings()

  if (isLoading) return <EnvironmentPageSkeleton />

  if (apiError) {
    return (
      <p className="border-l-4 border-temperature bg-surface p-5" role="alert">
        Could not load environment data: {apiError}
      </p>
    )
  }

    const readingAgeMs = latest
      ? now - new Date(latest.receivedAtUtc).getTime()
      : null

    const isFresh = readingAgeMs !== null && readingAgeMs < 2 * 60_000

  return (
    <main className="mx-auto w-full max-w-[1500px]">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="m-0 text-3xl font-bold text-ink">Environment</h1>
        </div>

        {latest && (
          <time className="text-sm text-muted" dateTime={latest.receivedAtUtc}>
            Updated {new Date(latest.receivedAtUtc).toLocaleString()}
          </time>
        )}
      </header>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,2fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="m-0 text-lg font-semibold">Current conditions</h2>
              <span className="text-sm text-muted">Live sensors</span>
            </div>

            {latest ? (
              <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
                <ReadingMetric
                  label="Temperature"
                  value={latest.temperature}
                  unit="°C"
                  tone="temperature"
                />
                <ReadingMetric
                  label="Humidity"
                  value={latest.humidity}
                  unit="%"
                  tone="humidity"
                />
                <ReadingMetric
                  label="Illuminance"
                  value={latest.lux}
                  unit="lux"
                  tone="light"
                />
              </div>
            ) : (
              <div className="border border-border bg-surface p-6 text-muted">
                No live sensor reading is available.
              </div>
            )}
          </section>

          <section>
            <div className="mb-3">
              <h2 className="m-0 text-lg font-semibold">History</h2>
              <p className="mb-0 mt-1 text-sm text-muted">
                {history.length} readings from the last 24 hours
              </p>
            </div>

            <EnvironmentHistoryChart readings={history} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Daily summary</h2>

            <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
              <Summary label="Average temperature" value={average(history, 'temperature')} unit="°C" />
              <Summary label="Average humidity" value={average(history, 'humidity')} unit="%" />
              <Summary label="Average light" value={average(history, 'lux')} unit="lux" />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-md border border-border bg-surface p-5">
            <h2 className="mb-5 text-lg font-semibold">System status</h2>

            <StatusRow
            label="Realtime connection"
            status={realtimeStatus}
            healthy={realtimeStatus === 'connected'}
            />
            <StatusRow
              label="Ambient sensors"
              status={isFresh ? 'Receiving data' : 'Data is stale'}
              healthy={isFresh}
            />
            <StatusRow
              label="Stored readings"
              status={`${history.length} available`}
              healthy={history.length > 0}
            />
          </section>

          <section className="rounded-md border border-border bg-surface p-5">
            <p className="mb-1 text-sm font-semibold text-brand">Local area</p>
            <h2 className="mb-5 text-lg font-semibold">Weather forecast</h2>

            <div className="border-l-2 border-moss pl-4">
              <p className="mb-1 font-medium text-ink">Not configured</p>
              <p className="m-0 text-sm leading-6 text-muted">
                Weather data will appear after a forecast provider and location
                are configured.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function Summary({
  label,
  value,
  unit,
}: {
  label: string
  value: number | null
  unit: string
}) {
  return (
    <div className="bg-surface p-5">
      <p className="mb-3 text-sm font-medium text-muted">{label}</p>
      <p className="m-0 text-2xl font-semibold">
        {value === null ? '—' : value.toFixed(1)}
        {value !== null && (
          <span className="ml-1 text-base text-muted">{unit}</span>
        )}
      </p>
    </div>
  )
}

function StatusRow({
  label,
  status,
  healthy,
}: {
  label: string
  status: string
  healthy: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0 first:pt-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span
          className={`h-2 w-2 rounded-full ${
            healthy ? 'bg-success' : 'bg-warning'
          }`}
        />
        {status}
      </span>
    </div>
  )
}