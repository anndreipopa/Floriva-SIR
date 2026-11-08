import { LIGHT_BANDS, lightBand, luxToScale } from '../../lib/conditions'
import { InstrumentCard } from './InstrumentCard'
import { ScaleBar } from './ScaleBar'
import { TwentyFourHourAverage } from './TwentyFourHourAverage'

/** Each band is one decade of lux (log scale), so they are drawn equally wide. */
const LIGHT_SEGMENTS = LIGHT_BANDS.map((band) => ({ label: band.label, weight: 1 }))

/** Illuminance on a logarithmic scale: each step is ten times brighter. */
export function LightInstrument({ value, average }: { value: number; average: number | null }) {
  return (
    <InstrumentCard
      label="Light"
      value={Math.round(value).toLocaleString()}
      unit="lux"
      tone="light"
      band={lightBand(value)}
      footnote={<TwentyFourHourAverage value={average} unit="lux" digits={0} />}
    >
      <div title="Log scale: each step is 10× brighter">
        <ScaleBar tone="light" marker={luxToScale(value) * 100} segments={LIGHT_SEGMENTS} />
      </div>
    </InstrumentCard>
  )
}
