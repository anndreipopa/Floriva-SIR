import { EnvironmentHistoryChart } from '../components/EnvironmentHistoryChart'
import { EnvironmentPageSkeleton } from '../components/EnvironmentPageSkeleton'
import { ReadingMetric } from '../components/ReadingMetric'
import { useEnvironmentReadings } from '../hooks/useEnvironmentReadings'
import type { EnvironmentReading } from '../types/sensorReading'

type Metric = 'temperature' | 'humidity' | 'lux'

const glassPanel =
  'rounded-2xl border border-white/85 bg-white/75 backdrop-blur-md ' +
  'shadow-[0_14px_32px_-20px_rgba(20,110,105,0.45)]'

function average(
  readings: EnvironmentReading[],
  metric: Metric,
): number | null {
  if (readings.length === 0) {
    return null
  }

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
    lastSensorReceivedAt,
    now,
  } = useEnvironmentReadings()

  if (isLoading) {
    return <EnvironmentPageSkeleton />
  }

  if (apiError) {
    return (
      <main className="w-full">
        <div
          className={`${glassPanel} border-accent/50 px-5 py-4`}
          role="alert"
        >
          <p className="m-0 font-bold text-ink">
            Could not load environment data.
          </p>

          <p className="m-0 mt-1 text-sm text-muted">
            {apiError}
          </p>
        </div>
      </main>
    )
  }

  const readingAgeMs = lastSensorReceivedAt
    ? now - lastSensorReceivedAt
    : null

  const isFresh =
    readingAgeMs !== null &&
    readingAgeMs >= 0 &&
    readingAgeMs < 2 * 60_000

  return (
    <main className="w-full">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Environment
          </h1>

          <p className="m-0 mt-2 text-sm text-muted sm:text-base">
            A live view of the conditions around your plants.
          </p>
        </div>

        {latest && (
          <div className="rounded-xl border border-white/85 bg-white/65 px-4 py-3 backdrop-blur-sm">
            <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
              Latest reading
            </p>

            <time
              className="text-sm font-bold text-ink"
              dateTime={latest.receivedAtUtc}
            >
              {new Date(latest.receivedAtUtc).toLocaleString()}
            </time>
          </div>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="conditions-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>

                <h2
                  id="conditions-heading"
                  className="m-0 text-xl font-extrabold text-ink"
                >
                  Current conditions
                </h2>
              </div>
            </div>

            {latest ? (
              <div
                className={`${glassPanel} grid overflow-hidden gap-px bg-white/70 sm:grid-cols-3`}
              >
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
              <div className={`${glassPanel} p-6`}>
                <p className="m-0 font-bold text-ink">
                  No live sensor reading is available.
                </p>

                <p className="m-0 mt-2 text-sm text-muted">
                  The dashboard will update when the robot sends another
                  reading.
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="history-heading">

            <EnvironmentHistoryChart readings={history} />
          </section>

          <section aria-labelledby="summary-heading">
            <div className="mb-3">

              <h2
                id="summary-heading"
                className="m-0 text-xl font-extrabold text-ink"
              >
                Daily summary
              </h2>
            </div>

            <div
              className={`${glassPanel} grid overflow-hidden gap-px bg-white/70 sm:grid-cols-3`}
            >
              <Summary
                label="Average temperature"
                value={average(history, 'temperature')}
                unit="°C"
                valueClass="text-temperature"
              />

              <Summary
                label="Average humidity"
                value={average(history, 'humidity')}
                unit="%"
                valueClass="text-humidity"
              />

              <Summary
                label="Average light"
                value={average(history, 'lux')}
                unit="lux"
                valueClass="text-light"
              />
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section
            className={`${glassPanel} p-5`}
            aria-labelledby="status-heading"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2
                id="status-heading"
                className="m-0 text-xl font-extrabold text-ink"
              >
                System status
              </h2>

              <span
                className={`h-3 w-3 rounded-full ${
                  realtimeStatus === 'connected'
                    ? 'animate-pulse bg-success'
                    : 'bg-warning'
                }`}
              />
            </div>

            <StatusRow
              label="Realtime connection"
              status={realtimeStatus}
              healthy={realtimeStatus === 'connected'}
            />

            <StatusRow
              label="Ambient sensors"
              status={
                latest === null
                  ? 'No data'
                  : isFresh
                    ? 'Receiving data'
                    : 'Data is stale'
              }
              healthy={isFresh}
            />

            <StatusRow
              label="Stored readings"
              status={
                history.length > 0
                  ? `${history.length} available`
                  : 'No history'
              }
              healthy={history.length > 0}
            />
          </section>

          <section
            className={`${glassPanel} p-5`}
            aria-labelledby="weather-heading"
          >
            <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.1em] text-accent">
              Local area
            </p>

            <h2
              id="weather-heading"
              className="m-0 text-xl font-extrabold text-ink"
            >
              Weather forecast
            </h2>

            <div className="mt-5 rounded-xl border border-cyan/30 bg-cyan-soft/60 p-4">
              <p className="mb-1 font-extrabold text-ink">
                Not configured
              </p>

              <p className="m-0 text-sm leading-6 text-muted">
                Weather information will appear after a forecast provider and
                location are configured.
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
  valueClass,
}: {
  label: string
  value: number | null
  unit: string
  valueClass: string
}) {
  return (
    <div className="bg-white/65 p-5 backdrop-blur-sm">
      <p className="mb-3 text-sm font-bold text-muted">
        {label}
      </p>

      <p className={`m-0 text-3xl font-extrabold ${valueClass}`}>
        {value === null ? '—' : value.toFixed(1)}

        {value !== null && (
          <span className="ml-1 text-base font-bold text-muted">
            {unit}
          </span>
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
    <div className="flex items-center justify-between gap-4 border-t border-border/70 py-3 first:border-t-0 first:pt-0">
      <span className="text-sm font-semibold text-muted">
        {label}
      </span>

      <span
        className={`flex items-center gap-2 text-right text-sm font-extrabold uppercase ${
          healthy ? 'text-success' : 'text-warning'
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            healthy ? 'bg-success' : 'bg-warning'
          }`}
        />

        {status}
      </span>
    </div>
  )
}