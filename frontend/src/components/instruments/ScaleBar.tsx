import { clamp } from '../../lib/conditions'
import type { InstrumentTone } from './InstrumentCard'

export interface ScaleSegment {
  label: string
  /** Relative width of the segment. */
  weight: number
}

interface ScaleBarProps {
  tone: InstrumentTone
  /** Where the current value sits, 0–100 % of the bar. */
  marker: number
  /** Stepped bands with a label under each (light, humidity). */
  segments?: ScaleSegment[]
  /** A highlighted stretch of the bar, 0–100 % (temperature range). */
  range?: { from: number; to: number }
  /** Labels pinned to the two ends, used when there are no segments. */
  endLabels?: [string, string]
}

const toneClasses: Record<InstrumentTone, { fill: string; track: string; glow: string }> = {
  temperature: {
    fill: 'bg-temperature',
    track: 'bg-temperature/15',
    glow: 'shadow-[0_2px_8px_rgba(240,109,92,0.55)]',
  },
  humidity: {
    fill: 'bg-humidity',
    track: 'bg-humidity/15',
    glow: 'shadow-[0_2px_8px_rgba(22,184,200,0.55)]',
  },
  light: {
    fill: 'bg-light',
    track: 'bg-light/15',
    glow: 'shadow-[0_2px_8px_rgba(155,207,63,0.6)]',
  },
}

/** Lowest and highest opacity of the stepped segments. */
const SEGMENT_OPACITY_MIN = 0.18
const SEGMENT_OPACITY_MAX = 0.9

/**
 * The bar every instrument card uses, so all three line up:
 * a 10 px track, a marker for the current value, and one row of labels.
 */
export function ScaleBar({ tone, marker, segments, range, endLabels }: ScaleBarProps) {
  const styles = toneClasses[tone]
  const step =
    segments && segments.length > 1
      ? (SEGMENT_OPACITY_MAX - SEGMENT_OPACITY_MIN) / (segments.length - 1)
      : 0

  return (
    <div>
      <div className="relative">
        {segments ? (
          <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full">
            {segments.map((segment, index) => (
              <span
                key={segment.label}
                className={styles.fill}
                style={{ flex: segment.weight, opacity: SEGMENT_OPACITY_MIN + index * step }}
              />
            ))}
          </div>
        ) : (
          <div className={`relative h-2.5 rounded-full ${styles.track}`}>
            {range && (
              <div
                className={`absolute inset-y-0 rounded-full ${styles.fill} opacity-60`}
                style={{
                  left: `${clamp(range.from, 0, 100)}%`,
                  width: `${Math.max(clamp(range.to, 0, 100) - clamp(range.from, 0, 100), 1.5)}%`,
                }}
              />
            )}
          </div>
        )}

        <div
          className={`absolute top-1/2 h-4.5 w-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white ${styles.fill} ${styles.glow}`}
          style={{ left: `${clamp(marker, 0, 100)}%` }}
        />
      </div>

      <div className="mt-2 flex h-4 text-[11px] font-bold leading-4 text-muted">
        {segments
          ? segments.map((segment) => (
              <span
                key={segment.label}
                className="text-center"
                style={{ flex: segment.weight }}
              >
                {segment.label}
              </span>
            ))
          : endLabels && (
              <>
                <span>{endLabels[0]}</span>
                <span className="ml-auto">{endLabels[1]}</span>
              </>
            )}
      </div>
    </div>
  )
}
