import { useEffect, useState } from 'react'
import { getWeather } from '../api/weatherApi'
import type { WeatherResponse } from '../types/weather'

const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1_000

interface UseWeatherResult {
  weather: WeatherResponse | null
  isLoading: boolean
  error: string | null
}

export function useWeather(): UseWeatherResult {
  const [weather, setWeather] =
    useState<WeatherResponse | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadWeather() {
      try {
        const nextWeather = await getWeather(
          controller.signal,
        )

        if (!active) {
          return
        }

        setWeather(nextWeather)
        setError(null)
      } catch (loadError) {
        if (
          !active ||
          loadError instanceof Error &&
          loadError.name === 'AbortError'
        ) {
          return
        }

        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load weather.',
          )
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadWeather()

    const refreshTimer = window.setInterval(() => {
      void loadWeather()
    }, WEATHER_REFRESH_INTERVAL_MS)

    return () => {
      active = false
      controller.abort()
      window.clearInterval(refreshTimer)
    }
  }, [])

  return {
    weather,
    isLoading,
    error,
  }
}