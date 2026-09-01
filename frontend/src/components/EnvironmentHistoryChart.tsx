import { useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EnvironmentReading } from '../types/sensorReading'

interface EnvironmentHistoryChartProps {
  readings: EnvironmentReading[]
}

type MetricKey = 'temperature' | 'humidity' | 'lux'

interface MetricDefinition {
  label: string
  unit: string
  color: string
  gradientId: string
  axis: 'ambient' | 'light'
}

const metrics: Record<MetricKey, MetricDefinition> = {
  temperature: {
    label: 'Temperature',
    unit: '°C',
    color: '#e15f47',
    gradientId: 'temperature-area',
    axis: 'ambient',
  },
  humidity: {
    label: 'Humidity',
    unit: '%',
    color: '#078a9c',
    gradientId: 'humidity-area',
    axis: 'ambient',
  },
  lux: {
    label: 'Light',
    unit: 'lux',
    color: '#b58b16',
    gradientId: 'light-area',
    axis: 'light',
  },
}

export function EnvironmentHistoryChart({
  readings,
}: EnvironmentHistoryChartProps) {
  const [visibleMetrics, setVisibleMetrics] = useState<
    Record<MetricKey, boolean>
  >({
    temperature: true,
    humidity: true,
    lux: false,
  })

  const chartData = readings.map((reading) => ({
    ...reading,
    timestamp: new Date(reading.receivedAtUtc).getTime(),
  }))

  function toggleMetric(metric: MetricKey) {
    setVisibleMetrics((current) => ({
      ...current,
      [metric]: !current[metric],
    }))
  }

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 px-6 py-5">
        <div>
          <h3 className="m-0 text-base font-semibold text-ink">
            Sensor history
          </h3>

          <p className="mb-0 mt-1 text-sm text-muted">
            Recorded at 30-minute intervals
          </p>
        </div>

        <div
          className="flex flex-wrap gap-1 rounded-md border border-border/70 bg-surface-muted/70 p-1"
          aria-label="Visible chart values"
        >
          {(Object.keys(metrics) as MetricKey[]).map((metric) => {
            const definition = metrics[metric]
            const isVisible = visibleMetrics[metric]

            return (
              <button
                key={metric}
                type="button"
                aria-pressed={isVisible}
                onClick={() => toggleMetric(metric)}
                className={`
                  flex min-h-9 items-center gap-2 rounded-sm px-3
                  text-sm font-semibold transition-colors
                  ${
                    isVisible
                      ? 'bg-surface text-ink ring-1 ring-border'
                      : 'text-muted hover:bg-surface/60 hover:text-ink'
                  }
                `}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: definition.color,
                    opacity: isVisible ? 1 : 0.35,
                  }}
                />

                {definition.label}
              </button>
            )
          })}
        </div>
      </header>

      {readings.length === 0 ? (
        <div className="grid h-[440px] place-items-center px-6 text-center">
          <div>
            <p className="mb-1 font-medium text-ink">
              No historical readings
            </p>

            <p className="m-0 text-sm text-muted">
              Recorded sensor values will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="h-[440px] w-full px-3 pb-5 pt-8 sm:px-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{
                top: 18,
                right: 12,
                bottom: 8,
                left: 4,
              }}
            >
              <defs>
                <linearGradient
                  id={metrics.temperature.gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={metrics.temperature.color}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="55%"
                    stopColor={metrics.temperature.color}
                    stopOpacity={0.1}
                  />
                  <stop
                    offset="100%"
                    stopColor={metrics.temperature.color}
                    stopOpacity={0.01}
                  />
                </linearGradient>

                <linearGradient
                  id={metrics.humidity.gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={metrics.humidity.color}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="55%"
                    stopColor={metrics.humidity.color}
                    stopOpacity={0.1}
                  />
                  <stop
                    offset="100%"
                    stopColor={metrics.humidity.color}
                    stopOpacity={0.01}
                  />
                </linearGradient>

                <linearGradient
                  id={metrics.lux.gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={metrics.lux.color}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="55%"
                    stopColor={metrics.lux.color}
                    stopOpacity={0.1}
                  />
                  <stop
                    offset="100%"
                    stopColor={metrics.lux.color}
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                stroke="#e3e7e3"
                strokeWidth={1}
              />

              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                axisLine={false}
                tickLine={false}
                minTickGap={45}
                tickMargin={14}
                tick={{
                  fill: '#737b74',
                  fontSize: 12,
                  fontWeight: 500,
                }}
                tickFormatter={formatTime}
              />

              <YAxis
                yAxisId="ambient"
                domain={[0, 'auto']}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                width={38}
                tick={{
                  fill: '#737b74',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              />

              <YAxis
                yAxisId="light"
                domain={[0, 'auto']}
                orientation="right"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                width={48}
                hide={!visibleMetrics.lux}
                tick={{
                  fill: '#737b74',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              />

              <Tooltip
                cursor={{
                  stroke: '#6d8b76',
                  strokeWidth: 24,
                  strokeOpacity: 0.08,
                }}
                labelFormatter={(timestamp) =>
                  new Date(Number(timestamp)).toLocaleString()
                }
                formatter={(value, name) => {
                  const metric = name as MetricKey
                  const definition = metrics[metric]

                  return [
                    `${Number(value).toLocaleString()} ${definition.unit}`,
                    definition.label,
                  ]
                }}
                contentStyle={{
                  padding: '12px 14px',
                  border: '1px solid #d8dfd8',
                  borderRadius: '6px',
                  backgroundColor: '#fcfdfb',
                  boxShadow: '0 10px 24px -12px rgb(16 43 32 / 25%)',
                }}
                labelStyle={{
                  marginBottom: '8px',
                  color: '#687269',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                itemStyle={{
                  paddingTop: '2px',
                  paddingBottom: '2px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              />

              {visibleMetrics.temperature && (
                <Area
                  type="linear"
                  yAxisId={metrics.temperature.axis}
                  dataKey="temperature"
                  name="temperature"
                  baseValue={0}
                  stroke={metrics.temperature.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={`url(#${metrics.temperature.gradientId})`}
                  dot={readings.length === 1}
                  activeDot={{
                    r: 5,
                    fill: metrics.temperature.color,
                    stroke: '#fcfdfb',
                    strokeWidth: 3,
                  }}
                  animationDuration={650}
                />
              )}

              {visibleMetrics.humidity && (
                <Area
                  type="linear"
                  yAxisId={metrics.humidity.axis}
                  dataKey="humidity"
                  name="humidity"
                  baseValue={0}
                  stroke={metrics.humidity.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={`url(#${metrics.humidity.gradientId})`}
                  dot={readings.length === 1}
                  activeDot={{
                    r: 5,
                    fill: metrics.humidity.color,
                    stroke: '#fcfdfb',
                    strokeWidth: 3,
                  }}
                  animationDuration={650}
                />
              )}

              {visibleMetrics.lux && (
                <Area
                  type="linear"
                  yAxisId={metrics.lux.axis}
                  dataKey="lux"
                  name="lux"
                  baseValue={0}
                  stroke={metrics.lux.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={`url(#${metrics.lux.gradientId})`}
                  dot={readings.length === 1}
                  activeDot={{
                    r: 5,
                    fill: metrics.lux.color,
                    stroke: '#fcfdfb',
                    strokeWidth: 3,
                  }}
                  animationDuration={650}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}