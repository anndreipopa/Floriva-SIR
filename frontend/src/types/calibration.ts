// Matches CalibrationDto from the backend (/api/calibration/* and the "CalibrationUpdated"
// SignalR event). Dates arrive as ISO strings.

/** Backend-owned steps (CalibrationPhase.cs). */
export type CalibrationPhase = 'starting' | 'awaiting_dry' | 'watering' | 'draining' | 'failed'

/** Measurement states the ESP32 reports on the status topic. */
export type DeviceState = 'idle' | 'warming_up' | 'taring' | 'streaming' | 'error'

export interface CalibrationSession {
  id: string
  phase: CalibrationPhase
  startedAtUtc: string
  /** Dry point captured in this session (becomes the pot's dry point when wet is saved). */
  dryGrams: number | null
  dryCapturedAtUtc: string | null
  drainStartedAtUtc: string | null
  /** When "Save wet point" unlocks. */
  drainEndsAtUtc: string | null
  /** Why the session failed, e.g. "tare_failed" (only when phase is "failed"). */
  error: string | null
  deviceState: DeviceState | null
  deviceSecondsLeft: number | null
  deviceStatusAtUtc: string | null
}

export interface Calibration {
  pot: number
  /** "Would water now" weight = 0 %. Null until the first complete calibration. */
  dryGrams: number | null
  /** Watered and drained = 100 %. */
  wetGrams: number | null
  calibratedAtUtc: string | null
  /** The session in progress, or null. */
  session: CalibrationSession | null
}

/** Body of a 409 Conflict: why the step was refused + the current state. */
export interface CalibrationError {
  message: string
  calibration: Calibration
}
