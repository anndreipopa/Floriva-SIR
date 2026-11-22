import type { Calibration, DeviceState } from '../types/calibration'
import type { WeightReading } from '../types/weight'
import { timeOf } from './weight'

/**
 * After the user says "the pot is on the scale", the save button stays locked this long so
 * the pot and the hand are off-load and the reading settles (design D3, step 4).
 */
export const SETTLE_MS = 5_000

/**
 * The backend only accepts a dry/wet point from a stable reading at most 15 s old
 * (CalibrationService.PointReadingMaxAge). Same number here so the button is only enabled
 * when the backend will accept it.
 */
export const POINT_READING_MAX_AGE_MS = 15_000

/** No status from the robot this long after "Start" → it is probably offline. */
export const NO_ANSWER_AFTER_MS = 30_000

/** Where the user is in the flow. Derived only from backend state + the clock. */
export type CalibrationStep =
  | { kind: 'idle' }
  | { kind: 'no_answer' }
  | { kind: 'preparing'; deviceState: DeviceState | null; secondsLeft: number | null }
  | { kind: 'place_dry' }
  | { kind: 'watering'; dryGrams: number }
  | { kind: 'draining'; msLeft: number }
  | { kind: 'save_wet'; dryGrams: number }
  | { kind: 'failed'; error: string }

/** Pure: easy to unit test. `now` is passed in so the countdowns re-render with the clock. */
export function calibrationStep(calibration: Calibration | null, now: number): CalibrationStep {
  const session = calibration?.session
  if (!session) return { kind: 'idle' }

  switch (session.phase) {
    case 'starting': {
      if (!session.deviceStatusAtUtc) {
        return now - Date.parse(session.startedAtUtc) > NO_ANSWER_AFTER_MS
          ? { kind: 'no_answer' }
          : { kind: 'preparing', deviceState: null, secondsLeft: null }
      }
      // The device sends secondsLeft every 5 s; count down smoothly in between.
      const sinceStatus = (now - Date.parse(session.deviceStatusAtUtc)) / 1000
      const secondsLeft =
        session.deviceSecondsLeft === null
          ? null
          : Math.max(0, Math.ceil(session.deviceSecondsLeft - sinceStatus))
      return { kind: 'preparing', deviceState: session.deviceState, secondsLeft }
    }
    case 'awaiting_dry':
      return { kind: 'place_dry' }
    case 'watering':
      return { kind: 'watering', dryGrams: session.dryGrams ?? 0 }
    case 'draining': {
      const endsAt = session.drainEndsAtUtc ? Date.parse(session.drainEndsAtUtc) : now
      return endsAt > now
        ? { kind: 'draining', msLeft: endsAt - now }
        : { kind: 'save_wet', dryGrams: session.dryGrams ?? 0 }
    }
    case 'failed':
      return { kind: 'failed', error: session.error ?? 'unknown_error' }
  }
}

/** The four steps shown in the progress list, and which one a CalibrationStep belongs to. */
export const STEP_LABELS = ['Prepare the scale', 'Dry point', 'Water and drain', 'Wet point'] as const

export function stepIndex(step: CalibrationStep): number {
  switch (step.kind) {
    case 'preparing':
    case 'no_answer':
      return 0
    case 'place_dry':
      return 1
    case 'watering':
    case 'draining':
      return 2
    case 'save_wet':
      return 3
    default:
      return -1
  }
}

/** True if this reading is good enough for the backend to save as a point right now. */
export function isUsableForPoint(reading: WeightReading | null, sessionId: string, now: number) {
  return (
    reading !== null &&
    reading.sessionId === sessionId &&
    reading.stable &&
    now - timeOf(reading) <= POINT_READING_MAX_AGE_MS
  )
}

/** Plain-language text for the error codes the firmware and backend send. */
export function describeCalibrationError(code: string) {
  switch (code) {
    case 'tare_failed':
      return 'The robot could not zero the scale. It must be empty and still during the countdown.'
    case 'pot_not_available':
      return 'This pot has no scale yet.'
    case 'device_ended_session':
      return 'The robot ended the session on its own (90-minute safety timeout).'
    default:
      return `The robot reported a problem (${code}).`
  }
}

/** 4:05 for countdowns. */
export function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
