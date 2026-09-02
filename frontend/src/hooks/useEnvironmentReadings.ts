import {useEffect, useState} from 'react'
import {
    getLatestReading,
    getReadingHistory,
} from '../api/sensorReadingsApi'
import { createEnvironmentConnection } from '../realtime/environmentConnection'
import type { EnvironmentReading } from '../types/sensorReading'

export type RealtimeStatus =
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'disconnected'
const DAY_MS = 24*60*60*1_000

function mergeReading(
    readings: EnvironmentReading[],
    incoming: EnvironmentReading,
){
    const cutoff = Date.now() - DAY_MS

    return [...readings, incoming].filter((reading) => new Date(reading.receivedAtUtc).getTime() >= cutoff,
    ).filter((reading, index, all) => all.findIndex((candidate) => candidate.receivedAtUtc === reading.receivedAtUtc, ) === index, 
    ).sort((left, right) => 
    new Date(left.receivedAtUtc).getTime() - new Date(right.receivedAtUtc).getTime(),
    )
}

export function useEnvironmentReadings(){
    const [latest, setLatest] = useState<EnvironmentReading | null>(null)
    const [history, setHistory] = useState<EnvironmentReading[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [apiError, setApiError] = useState<string | null>(null)
    const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
    const [now, setNow] = useState(Date.now())
    const [lastSensorReceivedAt, setLastSensorReceivedAt] =
    useState<number | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        const connection = createEnvironmentConnection()
        let active = true

        function receiveReading(reading: EnvironmentReading, receivedAt = Date.now()) {
            if (!active) return

            setLastSensorReceivedAt(receivedAt)

            setLatest((current) => {
                if (!current) return reading

                return new Date(reading.receivedAtUtc) > new Date(current.receivedAtUtc) ? reading : current
            })

        }

        async function synchronize() {
            try {
                const [latestReading, historicalReadings] = await Promise.all([
                getLatestReading(controller.signal),
                getReadingHistory(controller.signal),
                ])

                if (!active) return

                if (latestReading) {
                receiveReading(
                    latestReading,
                    new Date(latestReading.receivedAtUtc).getTime(),
                )
                }

                setHistory((current) => {
                let merged = historicalReadings

                for (const reading of current) {
                    merged = mergeReading(merged, reading)
                }

                return merged
                })

                setApiError(null)
            } catch (error) {
                if (
                active &&
                error instanceof Error &&
                error.name !== 'AbortError'
                ) {
                setApiError(error.message)
                }
            } finally {
                if (active) setIsLoading(false)
            }
            }

            connection.on('EnvironmentReadingReceived', receiveReading)

            connection.onreconnecting(() => {
            if (active) setRealtimeStatus('reconnecting')
            })

            connection.onreconnected(() => {
            if (active) {
                setRealtimeStatus('connected')
                void synchronize()
            }
            })

            connection.onclose(() => {
            if (active) setRealtimeStatus('disconnected')
            })

            async function start() {
            try {
                await connection.start()

                if (active) {
                setRealtimeStatus('connected')
                }
            } catch {
                if (active) {
                setRealtimeStatus('disconnected')
                }
            }

            await synchronize()
            }

            void start()

            const clock = window.setInterval(() => {
            setNow(Date.now())
            }, 1_000)

            return () => {
            active = false
            controller.abort()
            window.clearInterval(clock)
            connection.off('EnvironmentReadingReceived', receiveReading)
            void connection.stop()
            }
        }, [])

        return {
            latest,
            history,
            isLoading,
            apiError,
            realtimeStatus,
            lastSensorReceivedAt,
            now,
        }
    }