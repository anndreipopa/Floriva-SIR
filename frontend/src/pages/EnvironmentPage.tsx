import {useEffect, useState} from 'react'
import{
    getLatestReading,
    getReadingHistory,
} from '../api/sensorReadingsApi'
import type { EnvironmentReading } from '../types/sensorReading'

export function EnvironmentPage() {
    const [latest, setLatest] = useState<EnvironmentReading | null>(null)
    const [history, setHistory] = useState<EnvironmentReading[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null >(null)

    useEffect(() => {
        const controller = new AbortController()

        async function loadReadings() {
            try{
                setIsLoading(true)
                setError(null)

                const [latestReading, readingHistory] = await Promise.all([
                    getLatestReading(controller.signal),
                    getReadingHistory(controller.signal),
                ])
                setLatest(latestReading)
                setHistory(readingHistory)
            } catch(caughtError){
                if(caughtError instanceof Error && caughtError.name !== 'AbortError'){
                    setError(caughtError.message)
                }
            } finally{
                if(!controller.signal.aborted){
                    setIsLoading(false)
                }
            }
        }

        void loadReadings()

        return() => controller.abort()
    }, [])

    if(isLoading) {
        return <p>Loading environment data...</p>
    }

    if(error){
        return <p role="alert">Could not load environment data: {error}</p>
    }

    return (
        <main>
            <h1>Environment</h1>
            
            <section>
                <h2>Current conditions</h2>
                {latest ? (
                    <>
                    <p>Temperature: {latest.temperature} °C</p>
                    <p>Humidity: {latest.humidity}%</p>
                    <p>Light: {latest.lux} lux</p>
                    <p>
                        Last received: {' '}
                        {new Date(latest.receivedAtUtc).toLocaleString()}
                    </p>
                    </>
                ) : (
                    <p>No live sensor reading is available.</p>
                )}
            </section>

        </main>
    )

}