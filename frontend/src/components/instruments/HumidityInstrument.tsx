import { humidityBand } from '../../lib/conditions'
import { InstrumentCard } from './InstrumentCard'
import { ScaleBar } from './ScaleBar'
import { TwentyFourHourAverage } from './TwentyFourHourAverage'

/** Same thresholds as humidityBand(): Dry < 35 % ≤ Moderate < 65 % ≤ Humid. */
const HUMIDITY_SEGMENTS = [
  { label: 'Dry', weight: 35 },
  { label: 'Moderate', weight: 30 },
  { label: 'Humid', weight: 35 },
]

/** Relative humidity on a 0–100 % bar split into dry / moderate / humid. */
export function HumidityInstrument({ value, average }: { value: number; average: number | null }) {
  return (
    <InstrumentCard
      label="Humidity"
      value={Math.round(value).toString()}
      unit="%"
      tone="humidity"
      band={humidityBand(value)}
      footnote={<TwentyFourHourAverage value={average} unit="%" />}
    >
      <ScaleBar tone="humidity" marker={value} segments={HUMIDITY_SEGMENTS} />
    </InstrumentCard>
  )
}
