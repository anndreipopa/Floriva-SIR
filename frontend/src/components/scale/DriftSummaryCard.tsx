import { Gauge } from '@phosphor-icons/react'
import type { WeightSummary } from '../../lib/weight'
import { formatSignedGrams } from '../../lib/weight'
import { GlassPanel } from '../GlassPanel'

interface DriftSummaryCardProps {
  summary: WeightSummary | null
  windowLabel: string
}

/**
 * Numbers for the creep/drift test. With a sealed item on the scale nothing real changes,
 * so "change" and "range" are exactly the measurement error over the window.
 */
export function DriftSummaryCard({ summary, windowLabel }: DriftSummaryCardProps) {
  return (
    <GlassPanel as="section" className="p-4" aria-labelledby="drift-heading">
      <header className="mb-2 flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-forest/10 text-forest">
          <Gauge size={22} weight="duotone" aria-hidden="true" />
        </span>
        <div>
          <h2 id="drift-heading" className="m-0 text-lg font-extrabold text-ink">
            Drift check
          </h2>
          <p className="m-0 text-xs font-semibold text-muted">Last {windowLabel}</p>
        </div>
      </header>

      {!summary ? (
        <p className="m-0 border-t border-border/70 pt-2 text-sm text-muted">
          No readings in this window yet.
        </p>
      ) : (
        <dl className="m-0">
          <Row label="Change since first reading" value={formatSignedGrams(summary.changeGrams)} />
          <Row
            label="Change per day"
            value={
              summary.changePerDayGrams === null
                ? 'needs 1 h of data'
                : formatSignedGrams(summary.changePerDayGrams, 1)
            }
          />
          <Row
            label="Lowest / highest"
            value={`${summary.minGrams} / ${summary.maxGrams} g`}
          />
          <Row label="Range" value={`${summary.maxGrams - summary.minGrams} g`} />
          <Row
            label="Typical spread"
            value={
              summary.medianSpreadRaw === null
                ? '—'
                : `${Math.round(summary.medianSpreadRaw).toLocaleString()} counts`
            }
          />
          <Row
            label="Unstable readings"
            value={`${summary.unstableCount} of ${summary.count}`}
          />
          <Row label="Restarts" value={`${summary.restarts.length}`} />
        </dl>
      )}
    </GlassPanel>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/70 py-1.5">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="m-0 text-sm font-extrabold text-ink tabular">{value}</dd>
    </div>
  )
}
