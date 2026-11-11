import type { WeightReading } from '../types/weight'
import { apiBaseUrl } from './apiBaseUrl'

/**
 * Newest stored weighing for one pot.
 * A 404 is a valid empty state: no weight reading has arrived yet.
 */
export async function getLatestWeight(
  pot: number,
  signal?: AbortSignal,
): Promise<WeightReading | null> {
  const response = await fetch(`${apiBaseUrl}/api/weight/latest?pot=${pot}`, { signal })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Could not load latest weight (${response.status})`)
  }

  return response.json() as Promise<WeightReading>
}

/** Every weighing of one pot in the last `hours` hours, oldest first. */
export async function getWeightHistory(
  pot: number,
  hours: number,
  signal?: AbortSignal,
): Promise<WeightReading[]> {
  const response = await fetch(
    `${apiBaseUrl}/api/weight/history?pot=${pot}&hours=${hours}`,
    { signal },
  )

  if (!response.ok) {
    throw new Error(`Could not load weight history (${response.status})`)
  }

  return response.json() as Promise<WeightReading[]>
}
