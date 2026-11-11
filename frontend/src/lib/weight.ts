import type { WeightReading } from '../types/weight'

/**
 * How often the ESP32 weighs. MUST match WEIGHT_PERIOD_S in firmware/main/app_config.h
 * (300 s while testing, 7200 s later).
 */
export const WEIGHT_PERIOD_MS = 5 * 60_000

/** A reading is "fresh" until two and a half periods have passed (one miss is tolerated). */
export const WEIGHT_STALE_AFTER_MS = 2.5 * WEIGHT_PERIOD_MS

/** Below this much data, a "grams per day" figure would be mostly noise. */
const MIN_SPAN_FOR_RATE_MS = 60 * 60_000

export const HISTORY_WINDOWS = [
  { hours: 6, label: '6 h' },
  { hours: 24, label: '24 h' },
  { hours: 48, label: '48 h' },
  { hours: 168, label: '7 d' },
] as const

export function timeOf(reading: WeightReading) {
  return new Date(reading.receivedAtUtc).getTime()
}

export function isWeightFresh(ageMs: number | null) {
  return ageMs !== null && ageMs <= WEIGHT_STALE_AFTER_MS
}

/**
 * Adds one reading to a list: drops readings older than the window, removes a duplicate
 * with the same timestamp, keeps the list oldest-first.
 */
export function mergeWeight(
  readings: WeightReading[],
  incoming: WeightReading,
  windowHours: number,
  nowMs = Date.now(),
) {
  const cutoff = nowMs - windowHours * 60 * 60_000

  return [...readings.filter((r) => r.receivedAtUtc !== incoming.receivedAtUtc), incoming]
    .filter((r) => timeOf(r) >= cutoff)
    .sort((a, b) => timeOf(a) - timeOf(b))
}

/**
 * Timestamps where the device restarted: its uptime went down compared with the reading
 * before. Readings right after a restart are taken after the firmware's warm-up.
 */
export function findRestarts(readings: WeightReading[]) {
  const restarts: number[] = []
  for (let i = 1; i < readings.length; i++) {
    if (readings[i].deviceUptimeSeconds < readings[i - 1].deviceUptimeSeconds) {
      restarts.push(timeOf(readings[i]))
    }
  }
  return restarts
}

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export interface WeightSummary {
  count: number
  first: WeightReading
  last: WeightReading
  minGrams: number
  maxGrams: number
  /** Last minus first, in grams. With a sealed item on the scale this is pure drift/creep. */
  changeGrams: number
  /** changeGrams scaled to 24 h, or null if the data spans less than an hour. */
  changePerDayGrams: number | null
  medianSpreadRaw: number | null
  unstableCount: number
  restarts: number[]
}

/** Statistics for the drift check. Pure: easy to unit test. */
export function summarizeWeights(readings: WeightReading[]): WeightSummary | null {
  if (readings.length === 0) return null

  const first = readings[0]
  const last = readings[readings.length - 1]
  const grams = readings.map((r) => r.grams)
  const spanMs = timeOf(last) - timeOf(first)
  const changeGrams = last.grams - first.grams

  return {
    count: readings.length,
    first,
    last,
    minGrams: Math.min(...grams),
    maxGrams: Math.max(...grams),
    changeGrams,
    changePerDayGrams:
      spanMs >= MIN_SPAN_FOR_RATE_MS ? (changeGrams / spanMs) * 24 * 60 * 60_000 : null,
    medianSpreadRaw: median(readings.map((r) => r.spreadRaw)),
    unstableCount: readings.filter((r) => !r.stable).length,
    restarts: findRestarts(readings),
  }
}

/** 45 s · 12 min · 3 h 12 min · 2 d 5 h */
export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)

  if (days > 0) return `${days} d ${hours} h`
  if (hours > 0) return `${hours} h ${minutes} min`
  if (minutes > 0) return `${minutes} min`
  return `${seconds} s`
}

/** +3 g · −2 g · 0 g (true minus sign, so columns line up) */
export function formatSignedGrams(grams: number, fractionDigits = 0) {
  const rounded = Number(grams.toFixed(fractionDigits))
  if (rounded === 0) return `0 g`
  const sign = rounded > 0 ? '+' : '−'
  return `${sign}${Math.abs(rounded).toFixed(fractionDigits)} g`
}

export function formatClock(timestampMs: number) {
  return new Date(timestampMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(timestampMs: number) {
  return new Date(timestampMs).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
