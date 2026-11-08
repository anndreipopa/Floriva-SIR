import { InstrumentCard } from './InstrumentCard'
import { ScaleBar } from './ScaleBar'
import { TwentyFourHourAverage } from './TwentyFourHourAverage'

interface TemperatureInstrumentProps {
  value: number
  /** Lowest and highest temperature in the stored history (null if none). */
  min: number | null
  max: number | null
  /** Mean of the stored history (null if none). */
  average: number | null
}

/** Space left and right of the range so the marker never sits on the edge. */
const RANGE_PADDING_C = 1

function band(value: number) {
  if (value < 18) return 'Cool'
  if (value < 26) return 'Comfortable'
  return 'Warm'
}

/** Current temperature drawn on the bar of the last 24 h min–max range. */
export function TemperatureInstrument({ value, min, max, average }: TemperatureInstrumentProps) {
  const low = Math.min(min ?? value, value)
  const high = Math.max(max ?? value, value)
  const scaleMin = low - RANGE_PADDING_C
  const scaleMax = high + RANGE_PADDING_C
  const toPercent = (t: number) => ((t - scaleMin) / (scaleMax - scaleMin)) * 100

  return (
    <InstrumentCard
      label="Temperature"
      value={value.toFixed(1)}
      unit="°C"
      tone="temperature"
      band={band(value)}
      footnote={<TwentyFourHourAverage value={average} unit="°C" />}
    >
      <ScaleBar
        tone="temperature"
        marker={toPercent(value)}
        range={{ from: toPercent(low), to: toPercent(high) }}
        endLabels={
          min !== null && max !== null
            ? [`24 h min ${min.toFixed(1)}°`, `max ${max.toFixed(1)}°`]
            : ['No history yet', '']
        }
      />
    </InstrumentCard>
  )
}
