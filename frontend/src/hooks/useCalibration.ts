import { useCallback, useEffect, useState } from 'react'
import {
  CalibrationRefusedError,
  getCalibration,
  runCalibrationAction,
  type CalibrationAction,
} from '../api/calibrationApi'
import { getLatestWeight } from '../api/weightApi'
import {
  CALIBRATION_UPDATED_EVENT,
  createScaleConnection,
  WEIGHT_READING_EVENT,
} from '../realtime/scaleConnection'
import { timeOf } from '../lib/weight'
import type { Calibration } from '../types/calibration'
import type { WeightReading } from '../types/weight'
import type { RealtimeStatus } from './useEnvironmentReadings'

/** Countdowns show seconds, so the clock ticks every second. */
const CLOCK_TICK_MS = 1_000

/**
 * Calibration of one pot, kept live:
 *  - REST for the first load and after every reconnect (closes the gap while offline);
 *  - SignalR "CalibrationUpdated" for state changes (from any browser or from the robot);
 *  - SignalR "WeightReadingReceived" so the card shows the scale live during a session.
 * The backend owns every rule; this hook only stores what it says and sends the buttons.
 */
export function useCalibration(pot: number) {
  const [calibration, setCalibration] = useState<Calibration | null>(null)
  const [latestReading, setLatestReading] = useState<WeightReading | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<CalibrationAction | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
  const [syncToken, setSyncToken] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  // Live updates + clock.
  useEffect(() => {
    const connection = createScaleConnection()
    let active = true

    function receiveCalibration(update: Calibration) {
      if (active && update.pot === pot) setCalibration(update)
    }

    function receiveReading(reading: WeightReading) {
      if (!active || reading.pot !== pot) return
      setLatestReading((current) =>
        !current || timeOf(reading) > timeOf(current) ? reading : current,
      )
    }

    connection.on(CALIBRATION_UPDATED_EVENT, receiveCalibration)
    connection.on(WEIGHT_READING_EVENT, receiveReading)
    connection.onreconnecting(() => {
      if (active) setRealtimeStatus('reconnecting')
    })
    connection.onreconnected(() => {
      if (!active) return
      setRealtimeStatus('connected')
      setSyncToken((token) => token + 1)
    })
    connection.onclose(() => {
      if (active) setRealtimeStatus('disconnected')
    })

    connection
      .start()
      .then(() => {
        if (active) setRealtimeStatus('connected')
      })
      .catch(() => {
        if (active) setRealtimeStatus('disconnected')
      })

    const clock = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)

    return () => {
      active = false
      window.clearInterval(clock)
      connection.off(CALIBRATION_UPDATED_EVENT, receiveCalibration)
      connection.off(WEIGHT_READING_EVENT, receiveReading)
      void connection.stop()
    }
  }, [pot])

  // Initial load, and again after a reconnect.
  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function load() {
      try {
        const [current, reading] = await Promise.all([
          getCalibration(pot, controller.signal),
          getLatestWeight(pot, controller.signal),
        ])
        if (!active) return
        setCalibration(current)
        setLatestReading((live) =>
          live && reading && timeOf(live) > timeOf(reading) ? live : reading,
        )
        setLoadError(null)
      } catch (error) {
        if (active && error instanceof Error && error.name !== 'AbortError') {
          setLoadError(error.message)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void load()

    return () => {
      active = false
      controller.abort()
    }
  }, [pot, syncToken])

  /** Send one step to the backend. A refusal (409) shows its reason and the current state. */
  const run = useCallback(
    async (action: CalibrationAction) => {
      setPendingAction(action)
      setActionError(null)
      try {
        setCalibration(await runCalibrationAction(pot, action))
      } catch (error) {
        if (error instanceof CalibrationRefusedError) {
          setCalibration(error.calibration)
          setActionError(error.message)
        } else {
          setActionError(error instanceof Error ? error.message : 'Something went wrong.')
        }
      } finally {
        setPendingAction(null)
      }
    },
    [pot],
  )

  return {
    calibration,
    latestReading,
    isLoading,
    loadError,
    actionError,
    pendingAction,
    realtimeStatus,
    now,
    run,
  }
}
