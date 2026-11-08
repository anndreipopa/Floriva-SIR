import { useState } from 'react'
import { ChartLineUp } from '@phosphor-icons/react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { EnvironmentReading } from '../types/sensorReading'
import { GlassPanel } from './GlassPanel'

interface EnvironmentHistoryChartProps {
  readings: EnvironmentReading[]
}

type MetricKey = 'temperature' | 'humidity' | 'lux'

interface MetricDefinition {
  label: string
  unit: string
  color: string
  /** Classes for the toggle chip while the series is shown. */
  chip: string
  /** Temperature and humidity share the 0–100 axis; light has its own. */
  axis: 'ambient' | 'light'
}

const metrics: Record<MetricKey, MetricDefinition> = {
  temperature: {
    label: 'Temperature',
    unit: '°C',
    color: 'var(--color-temperature)',
    chip: 'bg-temperature/15 text-temperature',
    axis: 'ambient',
  },
  humidity: {
    label: 'Humidity',
    unit: '%',
    color: 'var(--color-humidity)',
    chip: 'bg-humidity/15 text-humidity',
    axis: 'ambient',
  },
  lux: {
    label: 'Light',
    unit: 'lux',
    color: 'var(--color-light)',
    chip: 'bg-light/15 text-light-ink',
    axis: 'light',
  },
}

const metricKeys = Object.keys(metrics) as MetricKey[]

const defaultVisibleMetrics: Record<MetricKey, boolean> = {
  temperature: true,
  humidity: true,
  lux: true,
}

/** Left axis: °C and % both fit comfortably in 0–100 for an indoor room. */
const AMBIENT_TICKS = [0, 25, 50, 75, 100]
/** Right axis is split into the same number of steps so grid lines coincide. */
const LIGHT_STEPS = AMBIENT_TICKS.length - 1

const axisTick = { fontSize: 12, fontWeight: 700 }

interface ChartPoint extends EnvironmentReading {
  timestamp: number
}

/**
 * Right-axis ticks from 0 to the highest light reading, in as many equal
 * steps as the left axis. Rounded up to a whole step so labels stay tidy.
 */
function lightScale(maxLux: number) {
  const step = Math.max(1, Math.ceil(maxLux / LIGHT_STEPS))
  const ticks = Array.from({ length: LIGHT_STEPS + 1 }, (_, index) => index * step)

  return { domain: [0, ticks[LIGHT_STEPS]] as [number, number], ticks }
}

function formatLux(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `${value}`
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** One tooltip for all visible series, read straight from the hovered reading. */
function TrendTooltip({
  active,
  payload,
  visibleMetrics,
}: Partial<TooltipContentProps<number, string>> & {
  visibleMetrics: Record<MetricKey, boolean>
}) {
  const point = payload?.[0]?.payload as ChartPoint | undefined

  if (!active || !point) {
    return null
  }

  return (
    <div className="rounded-xl border border-white/95 bg-white/92 px-3 py-2.5 shadow-[0_14px_30px_-16px_rgba(20,110,105,0.45)] backdrop-blur-md">
      <p className="m-0 mb-1.5 text-xs font-bold text-muted">
        {new Date(point.timestamp).toLocaleString()}
      </p>

      {metricKeys
        .filter((metric) => visibleMetrics[metric])
        .map((metric) => (
          <p key={metric} className="m-0 flex items-center gap-2 py-px text-[13px] font-extrabold text-ink">
            <span
              className="h-[3px] w-3 rounded-full"
              style={{ backgroundColor: metrics[metric].color }}
              aria-hidden="true"
            />
            {metrics[metric].label}
            <span className="ml-auto pl-3 tabular">
              {point[metric].toLocaleString()} {metrics[metric].unit}
            </span>
          </p>
        ))}
    </div>
  )
}

export function EnvironmentHistoryChart({ readings }: EnvironmentHistoryChartProps) {
  const [visibleMetrics, setVisibleMetrics] =
    useState<Record<MetricKey, boolean>>(defaultVisibleMetrics)

  const chartData: ChartPoint[] = readings.map((reading) => ({
    ...reading,
    timestamp: new Date(reading.receivedAtUtc).getTime(),
  }))

  const light = lightScale(Math.max(0, ...readings.map((reading) => reading.lux)))
  const isSinglePoint = readings.length === 1

  function toggleMetric(metric: MetricKey) {
    setVisibleMetrics((current) => ({
      ...current,
      [metric]: !current[metric],
    }))
  }

  return (
    <GlassPanel
      as="section"
      className="flex h-full min-h-0 flex-col overflow-hidden"
      aria-labelledby="trends-heading"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-forest/10 text-forest">
            <ChartLineUp size={22} weight="duotone" aria-hidden="true" />
          </span>
          <div>
            <h2 id="trends-heading" className="m-0 text-sm font-bold text-ink">
              Trends
            </h2>
            <p className="m-0 text-xs font-semibold text-muted">
              Last 24 hours · {readings.length} {readings.length === 1 ? 'reading' : 'readings'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Visible chart values">
          {metricKeys.map((metric) => {
            const definition = metrics[metric]
            const isVisible = visibleMetrics[metric]

            return (
              <button
                key={metric}
                type="button"
                aria-pressed={isVisible}
                onClick={() => toggleMetric(metric)}
                className={`flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 ${
                  isVisible ? definition.chip : 'bg-white/50 text-muted hover:bg-white/80 hover:text-ink'
                }`}
              >
                <span
                  className="h-[3px] w-3.5 rounded-full"
                  style={{ backgroundColor: definition.color, opacity: isVisible ? 1 : 0.4 }}
                  aria-hidden="true"
                />
                {definition.label}
              </button>
            )
          })}
        </div>
      </header>

      {readings.length === 0 ? (
        <div className="grid h-[280px] place-items-center px-6 text-center lg:h-auto lg:min-h-0 lg:flex-1">
          <div>
            <p className="mb-1 font-extrabold text-ink">No historical readings</p>
            <p className="m-0 text-sm text-muted">Persisted sensor values will appear here.</p>
          </div>
        </div>
      ) : (
        // The absolute inner box gives Recharts a definite size to measure.
        <div className="relative h-[280px] shrink-0 sm:h-[320px] lg:h-auto lg:min-h-0 lg:flex-1">
          <div className="absolute inset-x-2 bottom-2 top-3 sm:inset-x-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  {metricKeys.map((metric) => (
                    <linearGradient key={metric} id={`trend-${metric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={metrics[metric].color} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={metrics[metric].color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>

                <CartesianGrid
                  vertical={false}
                  yAxisId="ambient"
                  stroke="var(--color-grid)"
                  strokeDasharray="3 6"
                />

                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={56}
                  tickMargin={10}
                  tick={{ ...axisTick, fill: 'var(--color-muted)' }}
                  tickFormatter={formatTime}
                />

                {/* Left: temperature (°C) and humidity (%) on one 0–100 scale */}
                <YAxis
                  yAxisId="ambient"
                  domain={[0, 100]}
                  ticks={AMBIENT_TICKS}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={6}
                  width={36}
                  tick={{ ...axisTick, fill: 'var(--color-muted)' }}
                />

                {/* Right: light from 0 to the highest reading; independent of the left axis */}
                <YAxis
                  yAxisId="light"
                  orientation="right"
                  domain={light.domain}
                  ticks={light.ticks}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={6}
                  width={44}
                  tick={visibleMetrics.lux ? { ...axisTick, fill: 'var(--color-light-ink)' } : false}
                  tickFormatter={formatLux}
                />

                <Tooltip
                  cursor={{ stroke: 'var(--color-forest)', strokeOpacity: 0.25, strokeWidth: 1.5 }}
                  content={<TrendTooltip visibleMetrics={visibleMetrics} />}
                />

                {metricKeys.map((metric) =>
                  visibleMetrics[metric] ? (
                    <Area
                      key={metric}
                      type="monotone"
                      yAxisId={metrics[metric].axis}
                      dataKey={metric}
                      name={metric}
                      stroke={metrics[metric].color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill={`url(#trend-${metric})`}
                      dot={isSinglePoint}
                      activeDot={{ r: 5, fill: metrics[metric].color, stroke: '#ffffff', strokeWidth: 3 }}
                      animationDuration={650}
                    />
                  ) : null,
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </GlassPanel>
  )
}
