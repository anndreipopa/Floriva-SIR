import { useEffect, useRef, useState } from 'react'
import { getLatestWeight, getWeightHistory } from '../api/weightApi'
import { createScaleConnection, WEIGHT_READING_EVENT } from '../realtime/scaleConnection'
import { mergeWeight, timeOf } from '../lib/weight'
import type { WeightReading } from '../types/weight'
import type { RealtimeStatus } from './useEnvironmentReadings'

/** "x min ago" only needs to tick every few seconds. */
const CLOCK_TICK_MS = 5_000

/**
 * Weight readings for one pot: history for the chosen window (REST) plus live updates
 * (SignalR). Two effects on purpose:
 *  - the connection effect only depends on the pot, so changing the window does not
 *    reconnect;
 *  - the history effect re-runs when the pot or window changes, and after a reconnect
 *    (syncToken) to fill the gap while we were offline.
 */
export function useWeightReadings(pot: number, windowHours: number) {
  const [latest, setLatest] = useState<WeightReading | null>(null)
  const [history, setHistory] = useState<WeightReading[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
  const [syncToken, setSyncToken] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  // The live handler needs the current window without re-subscribing when it changes.
  const windowHoursRef = useRef(windowHours)
  useEffect(() => {
    windowHoursRef.current = windowHours
  }, [windowHours])

  // Live updates.
  useEffect(() => {
    const connection = createScaleConnection()
    let active = true

    function receive(reading: WeightReading) {
      if (!active || reading.pot !== pot) return
      setLatest((current) =>
        !current || timeOf(reading) > timeOf(current) ? reading : current,
      )
      setHistory((current) => mergeWeight(current, reading, windowHoursRef.current))
    }

    connection.on(WEIGHT_READING_EVENT, receive)
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
      connection.off(WEIGHT_READING_EVENT, receive)
      void connection.stop()
    }
  }, [pot])

  // History for the selected window.
  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function synchronize() {
      try {
        const [latestReading, readings] = await Promise.all([
          getLatestWeight(pot, controller.signal),
          getWeightHistory(pot, windowHours, controller.signal),
        ])
        if (!active) return

        setLatest(latestReading)
        // Keep live readings that arrived while the request was in flight.
        setHistory((current) =>
          current.reduce((merged, reading) => mergeWeight(merged, reading, windowHours), readings),
        )
        setApiError(null)
      } catch (error) {
        if (active && error instanceof Error && error.name !== 'AbortError') {
          setApiError(error.message)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void synchronize()

    return () => {
      active = false
      controller.abort()
    }
  }, [pot, windowHours, syncToken])

  return { latest, history, isLoading, apiError, realtimeStatus, now }
}
