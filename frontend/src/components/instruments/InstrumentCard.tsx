import type { ReactNode } from 'react'
import { Drop, Sun, ThermometerSimple } from '@phosphor-icons/react'
import { GlassPanel } from '../GlassPanel'

export type InstrumentTone = 'temperature' | 'humidity' | 'light'

const toneStyles = {
  temperature: {
    color: 'text-temperature',
    chip: 'bg-temperature/15 text-temperature',
    gradient: 'from-temperature/10',
    Icon: ThermometerSimple,
  },
  humidity: {
    color: 'text-humidity',
    chip: 'bg-humidity/15 text-humidity',
    gradient: 'from-humidity/10',
    Icon: Drop,
  },
  light: {
    color: 'text-light',
    chip: 'bg-light/15 text-light-ink',
    gradient: 'from-light/10',
    Icon: Sun,
  },
} as const

interface InstrumentCardProps {
  label: string
  value: string
  unit: string
  tone: InstrumentTone
  /** Short word for the band the value falls in, e.g. "Humid". */
  band: string
  /** The scale under the value (a ScaleBar). */
  children: ReactNode
  /** One line at the bottom, e.g. the 24 h average. */
  footnote: ReactNode
}

/**
 * Shared frame for the three sensor instruments. Every card has the same
 * rows (header, value, scale, footnote) so the three line up side by side.
 */
export function InstrumentCard({
  label,
  value,
  unit,
  tone,
  band,
  children,
  footnote,
}: InstrumentCardProps) {
  const styles = toneStyles[tone]
  const Icon = styles.Icon

  return (
    <GlassPanel
      as="article"
      className={`flex h-full min-w-0 flex-col overflow-hidden bg-gradient-to-br ${styles.gradient} via-white/40 to-white/20 p-4`}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${styles.chip}`}
          >
            <Icon size={23} weight="duotone" aria-hidden="true" />
          </span>
          <h3 className="m-0 text-sm font-bold text-muted">{label}</h3>
        </div>

        <span
          className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${styles.chip}`}
        >
          {band}
        </span>
      </header>

      <p className="m-0 mt-3 flex items-baseline gap-2">
        <strong className="text-[34px] font-bold leading-none text-ink tabular">
          {value}
        </strong>
        <span className={`text-lg font-extrabold ${styles.color}`}>{unit}</span>
      </p>

      <div className="mt-4">{children}</div>

      <p className="m-0 mt-2 border-t border-white/80 pt-2 text-xs font-semibold text-muted">
        {footnote}
      </p>
    </GlassPanel>
  )
}
