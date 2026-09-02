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
    color: '#ff6f61',
    gradientId: 'temperature-area',
    axis: 'ambient',
  },
  humidity: {
    label: 'Humidity',
    unit: '%',
    color: '#00bfd3',
    gradientId: 'humidity-area',
    axis: 'ambient',
  },
  lux: {
    label: 'Light',
    unit: 'lux',
    color: '#a7d83c',
    gradientId: 'light-area',
    axis: 'light',
  },
}

const defaultVisibleMetrics: Record<MetricKey, boolean> = {
  temperature: true,
  humidity: true,
  lux: false,
}

export function EnvironmentHistoryChart({
  readings,
}: EnvironmentHistoryChartProps) {
  const [visibleMetrics, setVisibleMetrics] =
    useState<Record<MetricKey, boolean>>(
      defaultVisibleMetrics,
    )

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
    <section className="overflow-hidden rounded-2xl border border-white/85 bg-white/75 backdrop-blur-md shadow-[0_14px_32px_-20px_rgba(20,110,105,0.45)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/80 px-5 py-5 sm:px-6">
        <div>
          <h3 className="m-0 text-base font-extrabold text-ink">
            Sensor history
          </h3>

          <p className="m-0 mt-1 text-sm font-medium text-muted">
            Persisted readings from the last 24 hours
          </p>
        </div>

        <div
          className="flex flex-wrap gap-1 rounded-xl border border-white/80 bg-cyan-soft/70 p-1 backdrop-blur-sm"
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
                  flex min-h-9 items-center gap-2 rounded-lg px-3
                  text-sm font-extrabold transition-colors
                  ${
                    isVisible
                      ? 'bg-white/95 text-ink shadow-[0_3px_10px_-5px_rgba(20,110,105,0.45)]'
                      : 'text-muted hover:bg-white/60 hover:text-ink'
                  }
                `}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
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
        <div className="grid h-[360px] place-items-center px-6 text-center sm:h-[420px]">
          <div>
            <p className="mb-1 font-extrabold text-ink">
              No historical readings
            </p>

            <p className="m-0 text-sm text-muted">
              Persisted sensor values will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="h-[320px] w-full px-2 pb-5 pt-7 sm:h-[380px] sm:px-5 lg:h-[420px]">
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
                    stopOpacity={0.42}
                  />
                  <stop
                    offset="58%"
                    stopColor={metrics.temperature.color}
                    stopOpacity={0.16}
                  />
                  <stop
                    offset="100%"
                    stopColor={metrics.temperature.color}
                    stopOpacity={0.015}
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
                    stopOpacity={0.42}
                  />
                  <stop
                    offset="58%"
                    stopColor={metrics.humidity.color}
                    stopOpacity={0.16}
                  />
                  <stop
                    offset="100%"
                    stopColor={metrics.humidity.color}
                    stopOpacity={0.015}
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
                    stopOpacity={0.42}
                  />
                  <stop
                    offset="58%"
                    stopColor={metrics.lux.color}
                    stopOpacity={0.16}
                  />
                  <stop
                    offset="100%"
                    stopColor={metrics.lux.color}
                    stopOpacity={0.015}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                stroke="#c9e1e1"
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
                  fill: '#628083',
                  fontSize: 12,
                  fontWeight: 700,
                }}
                tickFormatter={formatTime}
              />

              <YAxis
                yAxisId="ambient"
                domain={[0, 'auto']}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                width={40}
                tick={{
                  fill: '#628083',
                  fontSize: 12,
                  fontWeight: 700,
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
                  fill: '#628083',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />

              <Tooltip
                cursor={{
                  stroke: '#25c7d8',
                  strokeWidth: 24,
                  strokeOpacity: 0.14,
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
                  border: '1px solid rgba(255, 255, 255, 0.95)',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.92)',
                  boxShadow:
                    '0 14px 30px -16px rgba(20, 110, 105, 0.45)',
                  backdropFilter: 'blur(12px)',
                }}
                labelStyle={{
                  marginBottom: '8px',
                  color: '#628083',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
                itemStyle={{
                  paddingTop: '2px',
                  paddingBottom: '2px',
                  fontSize: '13px',
                  fontWeight: 800,
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
                    stroke: '#ffffff',
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
                    stroke: '#ffffff',
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
                    stroke: '#ffffff',
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