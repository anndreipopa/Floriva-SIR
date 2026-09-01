type MetricTone = 'temperature' | 'humidity' | 'light'

interface ReadingMetricProps {
  label: string
  value: number
  unit: string
  tone: MetricTone
}

const toneStyles: Record<
  MetricTone,
  { marker: string; value: string }
> = {
  temperature: {
    marker: 'bg-temperature',
    value: 'text-temperature',
  },
  humidity: {
    marker: 'bg-humidity',
    value: 'text-humidity',
  },
  light: {
    marker: 'bg-light',
    value: 'text-light',
  },
}

export function ReadingMetric({
  label,
  value,
  unit,
  tone,
}: ReadingMetricProps) {
  const styles = toneStyles[tone]

  return (
    <article className="min-w-0 bg-surface px-5 py-6">
      <div className="mb-6 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${styles.marker}`} />
        <p className="m-0 text-sm font-semibold text-muted">{label}</p>
      </div>

      <p className="m-0 flex flex-wrap items-baseline gap-2">
        <strong className="text-4xl font-semibold leading-none text-ink lg:text-5xl">
          {value.toLocaleString()}
        </strong>

        <span className={`text-lg font-semibold ${styles.value}`}>
          {unit}
        </span>
      </p>
    </article>
  )
}