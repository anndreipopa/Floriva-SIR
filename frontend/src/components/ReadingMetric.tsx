import {
  Drop,
  Sun,
  ThermometerSimple,
} from '@phosphor-icons/react'

type MetricTone = 'temperature' | 'humidity' | 'light'

interface ReadingMetricProps {
  label: string
  value: number
  unit: string
  tone: MetricTone
}

const toneStyles = {
  temperature: {
    color: 'text-temperature',
    iconBackground: 'bg-temperature/15',
    gradient: 'from-temperature/10',
  },
  humidity: {
    color: 'text-humidity',
    iconBackground: 'bg-humidity/15',
    gradient: 'from-humidity/10',
  },
  light: {
    color: 'text-light',
    iconBackground: 'bg-light/15',
    gradient: 'from-light/10',
  },
} as const

function MetricIcon({ tone }: { tone: MetricTone }) {
  const iconProperties = {
    size: 23,
    weight: 'duotone' as const,
    'aria-hidden': true,
  }

  if (tone === 'temperature') {
    return <ThermometerSimple {...iconProperties} />
  }

  if (tone === 'humidity') {
    return <Drop {...iconProperties} />
  }

  return <Sun {...iconProperties} />
}

export function ReadingMetric({
  label,
  value,
  unit,
  tone,
}: ReadingMetricProps) {
  const styles = toneStyles[tone]

  return (
    <article
      className={`
        min-w-0 bg-gradient-to-br ${styles.gradient}
        via-white/25 to-white/10 px-5 py-5
      `}
    >
 <div className="mb-4 flex items-center gap-2">
  <span
    className={`
      grid h-8 w-8 shrink-0 place-items-center rounded-lg
      ${styles.iconBackground} ${styles.color}
    `}
  >
    <MetricIcon tone={tone} />
  </span>

  <p className="m-0 text-xs font-bold text-muted">
    {label}
  </p>
</div>

      <p className="m-0 flex flex-wrap items-baseline gap-2">
        <strong className="text-3xl font-bold leading-none text-ink lg:text-4xl">
          {value.toLocaleString()}
        </strong>

        <span className={`text-lg font-extrabold ${styles.color}`}>
          {unit}
        </span>
      </p>
    </article>
  )
}