import type { CSSProperties, ReactNode } from 'react'
import { ConditionsHero } from '../components/ConditionsHero'
import { EnvironmentHistoryChart } from '../components/EnvironmentHistoryChart'
import { EnvironmentPageSkeleton } from '../components/EnvironmentPageSkeleton'
import { GlassPanel } from '../components/GlassPanel'
import { SystemStatusCard } from '../components/SystemStatusCard'
import { HumidityInstrument } from '../components/instruments/HumidityInstrument'
import { LightInstrument } from '../components/instruments/LightInstrument'
import { TemperatureInstrument } from '../components/instruments/TemperatureInstrument'
import { useEnvironmentReadings } from '../hooks/useEnvironmentReadings'
import { isReadingFresh } from '../lib/conditions'
import type { EnvironmentReading } from '../types/sensorReading'
import { useWeather } from '../hooks/useWeather'
import { WeatherForecastCard } from '../components/WeatherForecastCard'
type Metric = 'temperature' | 'humidity' | 'lux'

/** Delay between the entrance animations of consecutive blocks. */
const STAGGER_MS = 90

/** Fades a block in, a little after the one before it. */
function Reveal({
  order,
  className = '',
  children,
}: {
  order: number
  className?: string
  children: ReactNode
}) {
  const style: CSSProperties = { animationDelay: `${order * STAGGER_MS}ms` }

  return (
    <div className={`animate-rise-in ${className}`} style={style}>
      {children}
    </div>
  )
}

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

/**
 * Desktop: one screen, no scrolling.
 *   left  = hero (flex) / instruments (fixed) / chart (flex)
 *   right = weather / system status
 * Mobile: the same blocks stacked in reading order.
 */
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

  const {
    weather,
    isLoading: isWeatherLoading,
    error: weatherError,
  } = useWeather()

  if (isLoading) {
    return <EnvironmentPageSkeleton />
  }

  if (apiError) {
    return (
      <main className="w-full">
        <GlassPanel
          className="border-accent/50 px-5 py-4"
          role="alert"
        >
          <p className="m-0 font-bold text-ink">
            Could not load environment data.
          </p>

          <p className="m-0 mt-1 text-sm text-muted">
            {apiError}
          </p>
        </GlassPanel>
      </main>
    )
  }

  const readingAgeMs =
    lastSensorReceivedAt === null
      ? null
      : now - lastSensorReceivedAt

  const isFresh = isReadingFresh(readingAgeMs)

  const temperatures = history.map((reading) => reading.temperature)
  const minTemperature = temperatures.length > 0 ? Math.min(...temperatures) : null
  const maxTemperature = temperatures.length > 0 ? Math.max(...temperatures) : null

  return (
    <main className="grid w-full gap-3 lg:h-full lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
      <div className="flex min-w-0 flex-col gap-3 lg:min-h-0">
        <Reveal order={0} className="lg:min-h-0 lg:flex-[1_1_0]">
          <ConditionsHero latest={latest} />
        </Reveal>

        {latest && (
          <section aria-labelledby="conditions-heading">
            <h2 id="conditions-heading" className="sr-only">
              Current conditions
            </h2>

            <div className="grid gap-3 md:grid-cols-3">
              <Reveal order={1}>
                <TemperatureInstrument
                  value={latest.temperature}
                  min={minTemperature}
                  max={maxTemperature}
                  average={average(history, 'temperature')}
                />
              </Reveal>
              <Reveal order={2}>
                <HumidityInstrument value={latest.humidity} average={average(history, 'humidity')} />
              </Reveal>
              <Reveal order={3}>
                <LightInstrument value={latest.lux} average={average(history, 'lux')} />
              </Reveal>
            </div>
          </section>
        )}

        <Reveal order={4} className="lg:min-h-[240px] lg:flex-[1.35_1_0]">
          <EnvironmentHistoryChart readings={history} />
        </Reveal>
      </div>

      <Reveal order={5} className="flex min-w-0 flex-col gap-3 lg:min-h-0">
        <WeatherForecastCard
          weather={weather}
          isLoading={isWeatherLoading}
          error={weatherError}
          indoorTemperature={latest?.temperature ?? null}
          className="lg:min-h-0 lg:flex-1"
        />

        <SystemStatusCard
          realtimeStatus={realtimeStatus}
          latestReceivedAtUtc={latest?.receivedAtUtc ?? null}
          isFresh={isFresh}
          storedReadings={history.length}
        />
      </Reveal>
    </main>
  )
}
