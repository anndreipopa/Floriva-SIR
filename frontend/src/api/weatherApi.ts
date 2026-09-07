import type { WeatherResponse } from '../types/weather'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(
  /\/$/,
  '',
)

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not configured')
}

export async function getWeather(
  signal?: AbortSignal,
): Promise<WeatherResponse> {
  const response = await fetch(
    `${apiBaseUrl}/api/weather`,
    { signal },
  )

  if (!response.ok) {
    throw new Error(
      `Could not load weather (${response.status})`,
    )
  }

  return response.json() as Promise<WeatherResponse>
}