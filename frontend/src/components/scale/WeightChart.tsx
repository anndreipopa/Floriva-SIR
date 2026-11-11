import { useState } from 'react'
import { ChartLineUp } from '@phosphor-icons/react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { WeightReading } from '../../types/weight'
import { findRestarts, formatClock, formatDuration, timeOf } from '../../lib/weight'
import { GlassPanel } from '../GlassPanel'

interface WeightChartProps {
  readings: WeightReading[]
  windowLabel: string
}

interface ChartPoint extends WeightReading {
  timestamp: number
}

const WEIGHT_COLOR = 'var(--color-forest)'
const TEMPERATURE_COLOR = 'var(--color-temperature)'
const axisTick = { fontSize: 12, fontWeight: 700 }

/**
 * Weight axis range: the data plus some headroom, never thinner than ±MIN_HALF_SPAN_G,
 * so a flat line with 1 g of noise does not get blown up to fill the whole chart.
 */
const MIN_HALF_SPAN_G = 5

function weightDomain(readings: WeightReading[]): [number, number] {
  const grams = readings.map((r) => r.grams)
  const min = Math.min(...grams)
  const max = Math.max(...grams)
  const middle = (min + max) / 2
  const halfSpan = Math.max(MIN_HALF_SPAN_G, ((max - min) / 2) * 1.2)
  return [Math.floor(middle - halfSpan), Math.ceil(middle + halfSpan)]
}

function WeightTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const point = payload?.[0]?.payload as ChartPoint | undefined
  if (!active || !point) return null

  return (
    <div className="rounded-xl border border-white/95 bg-white/92 px-3 py-2.5 shadow-[0_14px_30px_-16px_rgba(20,110,105,0.45)] backdrop-blur-md">
      <p className="m-0 mb-1.5 text-xs font-bold text-muted">
        {new Date(point.timestamp).toLocaleString()}
      </p>
      <TooltipRow color={WEIGHT_COLOR} label="Weight" value={`${point.grams} g`} />
      {point.ambientTemperatureC !== null && (
        <TooltipRow
          color={TEMPERATURE_COLOR}
          label="Room"
          value={`${point.ambientTemperatureC.toFixed(1)} °C`}
        />
      )}
      <p className="m-0 mt-1 text-xs font-semibold text-muted">
        spread {point.spreadRaw.toLocaleString()} · {point.stable ? 'stable' : 'unstable'} · up{' '}
        {formatDuration(point.deviceUptimeSeconds)}
      </p>
    </div>
  )
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="m-0 flex items-center gap-2 py-px text-[13px] font-extrabold text-ink">
      <span className="h-[3px] w-3 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
      <span className="ml-auto pl-3 tabular">{value}</span>
    </p>
  )
}

/** Only unstable readings get a dot, in the warm accent, so they stand out on the line. */
function UnstableDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined || !payload || payload.stable) {
    return <g />
  }
  return <circle cx={cx} cy={cy} r={4} fill="var(--color-accent)" stroke="#ffffff" strokeWidth={2} />
}

export function WeightChart({ readings, windowLabel }: WeightChartProps) {
  const [showTemperature, setShowTemperature] = useState(true)

  const data: ChartPoint[] = readings.map((r) => ({ ...r, timestamp: timeOf(r) }))
  const restarts = findRestarts(readings)
  const hasTemperature = readings.some((r) => r.ambientTemperatureC !== null)

  return (
    <GlassPanel
      as="section"
      className="flex h-full min-h-0 flex-col overflow-hidden"
      aria-labelledby="weight-chart-heading"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-forest/10 text-forest">
            <ChartLineUp size={22} weight="duotone" aria-hidden="true" />
          </span>
          <div>
            <h2 id="weight-chart-heading" className="m-0 text-sm font-bold text-ink">
              Weight over time
            </h2>
            <p className="m-0 text-xs font-semibold text-muted">
              Last {windowLabel} · {readings.length}{' '}
              {readings.length === 1 ? 'reading' : 'readings'}
              {restarts.length > 0 && ` · dashed line = device restart`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Visible chart values">
          <span className="flex min-h-8 items-center gap-1.5 rounded-lg bg-forest/10 px-2.5 text-xs font-extrabold text-forest">
            <span className="h-[3px] w-3.5 rounded-full" style={{ backgroundColor: WEIGHT_COLOR }} aria-hidden="true" />
            Weight
          </span>
          <button
            type="button"
            aria-pressed={showTemperature}
            disabled={!hasTemperature}
            onClick={() => setShowTemperature((value) => !value)}
            className={`flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 disabled:cursor-default disabled:opacity-50 ${
              showTemperature && hasTemperature
                ? 'bg-temperature/15 text-temperature'
                : 'bg-white/50 text-muted hover:bg-white/80 hover:text-ink'
            }`}
          >
            <span
              className="h-[3px] w-3.5 rounded-full"
              style={{ backgroundColor: TEMPERATURE_COLOR, opacity: showTemperature ? 1 : 0.4 }}
              aria-hidden="true"
            />
            Room temperature
          </button>
        </div>
      </header>

      {readings.length === 0 ? (
        <div className="grid h-[280px] place-items-center px-6 text-center lg:h-auto lg:min-h-0 lg:flex-1">
          <div>
            <p className="mb-1 font-extrabold text-ink">No readings in this window</p>
            <p className="m-0 text-sm text-muted">Weighings will appear here as they arrive.</p>
          </div>
        </div>
      ) : (
        // The absolute inner box gives Recharts a definite size to measure.
        <div className="relative h-[300px] shrink-0 sm:h-[340px] lg:h-auto lg:min-h-0 lg:flex-1">
          <div className="absolute inset-x-2 bottom-2 top-3 sm:inset-x-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={WEIGHT_COLOR} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={WEIGHT_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  yAxisId="grams"
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
                  tickFormatter={formatClock}
                />

                <YAxis
                  yAxisId="grams"
                  domain={weightDomain(readings)}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={6}
                  width={48}
                  tick={{ ...axisTick, fill: 'var(--color-muted)' }}
                  tickFormatter={(value: number) => `${value} g`}
                />

                <YAxis
                  yAxisId="temperature"
                  orientation="right"
                  domain={['dataMin - 1', 'dataMax + 1']}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={6}
                  width={showTemperature && hasTemperature ? 44 : 0}
                  tick={
                    showTemperature && hasTemperature
                      ? { ...axisTick, fill: 'var(--color-temperature)' }
                      : false
                  }
                  tickFormatter={(value: number) => `${Math.round(value)}°`}
                />

                <Tooltip
                  cursor={{ stroke: 'var(--color-forest)', strokeOpacity: 0.25, strokeWidth: 1.5 }}
                  content={<WeightTooltip />}
                />

                {restarts.map((timestamp) => (
                  <ReferenceLine
                    key={timestamp}
                    x={timestamp}
                    yAxisId="grams"
                    stroke="var(--color-warning)"
                    strokeDasharray="4 4"
                  />
                ))}

                {showTemperature && hasTemperature && (
                  <Line
                    type="monotone"
                    yAxisId="temperature"
                    dataKey="ambientTemperatureC"
                    stroke={TEMPERATURE_COLOR}
                    strokeWidth={2}
                    strokeOpacity={0.7}
                    dot={false}
                    connectNulls
                    animationDuration={650}
                  />
                )}

                <Area
                  type="monotone"
                  yAxisId="grams"
                  dataKey="grams"
                  stroke={WEIGHT_COLOR}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="url(#weight-fill)"
                  dot={<UnstableDot />}
                  activeDot={{ r: 5, fill: WEIGHT_COLOR, stroke: '#ffffff', strokeWidth: 3 }}
                  animationDuration={650}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </GlassPanel>
  )
}
