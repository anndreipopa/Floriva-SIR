import type { Calibration, CalibrationError } from '../types/calibration'
import { apiBaseUrl } from './apiBaseUrl'

/** The five session actions; each is POST /api/calibration/{pot}/{action}. */
export type CalibrationAction = 'start' | 'dry' | 'watered' | 'wet' | 'cancel'

/**
 * Thrown when the backend refuses a step (409). Carries the user-facing reason and the
 * current state, so the card can show the message and re-render at once.
 */
export class CalibrationRefusedError extends Error {
  readonly calibration: Calibration

  constructor(body: CalibrationError) {
    super(body.message)
    this.name = 'CalibrationRefusedError'
    this.calibration = body.calibration
  }
}

export async function getCalibration(pot: number, signal?: AbortSignal): Promise<Calibration> {
  const response = await fetch(`${apiBaseUrl}/api/calibration/${pot}`, { signal })

  if (!response.ok) {
    throw new Error(`Could not load the calibration (${response.status})`)
  }

  return response.json() as Promise<Calibration>
}

export async function runCalibrationAction(
  pot: number,
  action: CalibrationAction,
): Promise<Calibration> {
  const response = await fetch(`${apiBaseUrl}/api/calibration/${pot}/${action}`, {
    method: 'POST',
  })

  if (response.status === 409) {
    throw new CalibrationRefusedError((await response.json()) as CalibrationError)
  }

  if (!response.ok) {
    throw new Error(`The server could not do that (${response.status})`)
  }

  return response.json() as Promise<Calibration>
}
