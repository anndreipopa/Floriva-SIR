import type { EnvironmentReading } from "../types/sensorReading";

//Remove a trailing slash so endpoint paths always contain exactly one slash
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

if(!apiBaseUrl){
    throw new Error('VITE_API_BASE_URL is not configured')
}

/**
 * 
 * Retrieves the most recent in-memory sensor reading.
 * A 404 is a valid empty state: means the backend has not received MQTT data yet
 */
export async function getLatestReading(
    signal?: AbortSignal,
): Promise<EnvironmentReading | null> {
        const response = await fetch(`${apiBaseUrl}/api/sensors/latest`, {signal})

        if(response.status === 404){
            return null
        }

        if(!response.ok){
            throw new Error(`Could not load latest reading (${response.status})`)
        }
        return response.json() as Promise<EnvironmentReading> 
    }


/**
 * Retrieves up to 48 persistent readings from the prev 24 hours
 */
export async function getReadingHistory(
    signal?: AbortSignal, ): Promise<EnvironmentReading[]>{
        const response = await fetch(`${apiBaseUrl}/api/sensors/history`, {signal})

        if (!response.ok){
            throw new Error(`Could not load reading history (${response.status})`)
        }

        return response.json() as Promise<EnvironmentReading[]>
    }