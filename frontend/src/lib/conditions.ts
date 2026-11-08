// Pure helpers that turn raw readings into words, bands and colours.
// No React here, so every function can be unit tested on its own.

/**
 * Light bands on a log10 scale (0 lux … 100 000 lux).
 * Lux values are rough reference points, not plant requirements.
 */
export const LIGHT_BANDS: { label: string; minLux: number }[] = [
  { label: 'Dark', minLux: 0 },
  { label: 'Dim', minLux: 10 },
  { label: 'Indoor', minLux: 100 },
  { label: 'Bright', minLux: 1_000 },
  { label: 'Sunlight', minLux: 10_000 },
]

const MAX_LUX_LOG = 5 // log10(100 000 lux)

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** 0 for darkness, 1 for direct sunlight; log scale because the eye works that way. */
export function luxToScale(lux: number) {
  return clamp(Math.log10(Math.max(lux, 0) + 1) / MAX_LUX_LOG, 0, 1)
}

/** How "daylit" the hero scene should look. Saturates at ~10 000 lux. */
export function daylightFactor(lux: number) {
  return clamp(Math.log10(Math.max(lux, 0) + 1) / 4, 0, 1)
}

export function lightBand(lux: number) {
  let band = LIGHT_BANDS[0]

  for (const candidate of LIGHT_BANDS) {
    if (lux >= candidate.minLux) {
      band = candidate
    }
  }

  return band.label
}

export function humidityBand(humidity: number) {
  if (humidity < 35) return 'Dry'
  if (humidity < 65) return 'Moderate'
  return 'Humid'
}

function temperatureWord(temperature: number) {
  if (temperature < 12) return 'Cold'
  if (temperature < 18) return 'Cool'
  if (temperature < 22) return 'Mild'
  if (temperature < 28) return 'Warm'
  return 'Hot'
}

function lightPhrase(lux: number) {
  const band = lightBand(lux)

  if (band === 'Dark') return 'with the lights off'
  if (band === 'Dim') return 'in dim light'
  if (band === 'Indoor') return 'in soft indoor light'
  if (band === 'Bright') return 'in bright light'
  return 'in direct sun'
}

/** e.g. "Warm and humid, with the lights off." */
export function describeConditions(
  temperature: number,
  humidity: number,
  lux: number,
) {
  return `${temperatureWord(temperature)} and ${humidityBand(
    humidity,
  ).toLowerCase()}, ${lightPhrase(lux)}.`
}

/** Linear mix of two #rrggbb colours; t = 0 → a, t = 1 → b. */
export function mixHex(a: string, b: string, t: number) {
  const from = parseInt(a.slice(1), 16)
  const to = parseInt(b.slice(1), 16)
  const channel = (shift: number) => {
    const start = (from >> shift) & 0xff
    const end = (to >> shift) & 0xff
    return Math.round(start + (end - start) * t)
  }

  const mixed =
    (channel(16) << 16) | (channel(8) << 8) | channel(0)

  return `#${mixed.toString(16).padStart(6, '0')}`
}

/** A sensor reading younger than this counts as live. */
export const FRESH_READING_MS = 35_000

/** True when the last reading arrived recently enough to call the sensors live. */
export function isReadingFresh(ageMs: number | null) {
  return ageMs !== null && ageMs >= 0 && ageMs < FRESH_READING_MS
}
