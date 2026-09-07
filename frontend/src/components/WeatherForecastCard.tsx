import type { IconType } from 'react-icons'
import {
  WiCloud,
  WiDayCloudy,
  WiDaySunny,
  WiFog,
  WiRain,
  WiShowers,
  WiSnow,
  WiThunderstorm,
} from 'react-icons/wi'
import type {
  ForecastDay,
  WeatherResponse,
} from '../types/weather'

interface WeatherForecastCardProps {
  weather: WeatherResponse | null
  isLoading: boolean
  error: string | null
}

const weatherIcons: Record<string, IconType> = {
  '01d': WiDaySunny,
  '01n': WiDaySunny,
  '02d': WiDayCloudy,
  '02n': WiDayCloudy,
  '03d': WiCloud,
  '03n': WiCloud,
  '04d': WiCloud,
  '04n': WiCloud,
  '09d': WiShowers,
  '09n': WiShowers,
  '10d': WiRain,
  '10n': WiRain,
  '11d': WiThunderstorm,
  '11n': WiThunderstorm,
  '13d': WiSnow,
  '13n': WiSnow,
  '50d': WiFog,
  '50n': WiFog,
}

function WeatherIcon({
  iconCode,
  size = 46,
}: {
  iconCode: string | null
  size?: number
}) {
  const Icon = iconCode
    ? weatherIcons[iconCode] ?? WiCloud
    : WiCloud

  return (
    <Icon
      aria-hidden="true"
      className="shrink-0 text-cyan"
      size={size}
    />
  )
}

function capitalizeDescription(description: string) {
  if (!description) {
    return 'Unavailable'
  }

  return description.charAt(0).toUpperCase() +
    description.slice(1)
}

function formatForecastDate(date: string, index: number) {
  if (index === 0) {
    return 'Today'
  }

  if (index === 1) {
    return 'Tomorrow'
  }

  const [year, month, day] = date.split('-').map(Number)

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
  }).format(new Date(year, month - 1, day))
}

function ForecastRow({
  day,
  index,
}: {
  day: ForecastDay
  index: number
}) {
  return (
    <li className="flex items-center gap-2 border-t border-border/70 py-2 first:border-t-0">
      <WeatherIcon
        iconCode={day.iconCode}
        size={30}
      />

      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-extrabold text-ink">
          {formatForecastDate(day.date, index)}
        </p>

        <p className="m-0 truncate text-xs font-semibold text-muted">
          {capitalizeDescription(day.description)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="m-0 text-sm font-extrabold text-ink">
          {Math.round(day.minTemperature)}° /{' '}
          {Math.round(day.maxTemperature)}°
        </p>

        <p className="m-0 text-xs font-bold text-muted">
          {day.humidity}% humidity
        </p>
      </div>
    </li>
  )
}

function WeatherLoadingState() {
  return (
    <div className="mt-3 rounded-xl border border-cyan/30 bg-cyan-soft/60 p-3">
      <div className="animate-pulse">
        <div className="h-8 w-24 rounded-lg bg-white/70" />
        <div className="mt-3 h-3 w-36 rounded bg-white/70" />
        <div className="mt-4 space-y-2">
          <div className="h-8 rounded bg-white/60" />
          <div className="h-8 rounded bg-white/60" />
          <div className="h-8 rounded bg-white/60" />
          <div className="h-8 rounded bg-white/60" />
        </div>
      </div>
    </div>
  )
}

function WeatherErrorState({ error }: { error: string }) {
  return (
    <div
      className="mt-3 rounded-xl border border-accent/30 bg-white/55 p-3"
      role="status"
    >
      <p className="m-0 font-extrabold text-ink">
        Weather unavailable
      </p>

      <p className="m-0 mt-1 text-sm leading-5 text-muted">
        {error}
      </p>
    </div>
  )
}

function WeatherEmptyState() {
  return (
    <div className="mt-3 rounded-xl border border-cyan/30 bg-cyan-soft/60 p-3">
      <p className="m-0 font-extrabold text-ink">
        No forecast available
      </p>

      <p className="m-0 mt-1 text-sm leading-5 text-muted">
        Weather data will appear when the provider responds.
      </p>
    </div>
  )
}

export function WeatherForecastCard({
  weather,
  isLoading,
  error,
}: WeatherForecastCardProps) {
    return (
    <div aria-label="Current weather and forecast">
      {isLoading && <WeatherLoadingState />}

      {!isLoading && error && (
        <WeatherErrorState error={error} />
      )}

      {!isLoading && !error && !weather && (
        <WeatherEmptyState />
      )}

      {!isLoading && !error && weather && (
        <div className="mt-3 rounded-xl border border-cyan/30 bg-cyan-soft/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-bold text-muted">
                {weather.location}
              </p>

              <p className="mt-2 mb-0 text-3xl font-extrabold leading-none text-ink">
                {Math.round(weather.current.temperature)}°C
              </p>

              <p className="m-0 mt-1 text-sm font-extrabold text-cyan">
                {capitalizeDescription(
                  weather.current.description,
                )}
              </p>
            </div>

            <WeatherIcon
              iconCode={weather.current.iconCode}
              size={42}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted">
            <span>
              Feels like{' '}
              {Math.round(weather.current.feelsLike)}°C
            </span>

            <span>
              Humidity {weather.current.humidity}%
            </span>
          </div>

          {weather.forecast.length > 0 && (
            <ul className="m-0 mt-3 list-none p-0">
              {weather.forecast.map((day, index) => (
                <ForecastRow
                  key={day.date}
                  day={day}
                  index={index}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}