import type { IconType } from 'react-icons'
import {
  WiCloud,
  WiDayCloudy,
  WiDaySunny,
  WiFog,
  WiNightAltCloudy,
  WiNightClear,
  WiRain,
  WiShowers,
  WiSnow,
  WiThunderstorm,
} from 'react-icons/wi'
import type { ForecastDay, WeatherResponse } from '../types/weather'
import { GlassPanel } from './GlassPanel'

interface WeatherForecastCardProps {
  weather: WeatherResponse | null
  isLoading: boolean
  error: string | null
  /** Latest indoor temperature, for the "inside vs outside" line. */
  indoorTemperature: number | null
  className?: string
}

// OpenWeather icon codes: https://openweathermap.org/weather-conditions
// The last letter is d (day) or n (night).
const weatherIcons: Record<string, IconType> = {
  '01d': WiDaySunny,
  '01n': WiNightClear,
  '02d': WiDayCloudy,
  '02n': WiNightAltCloudy,
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

/** Below this difference inside and outside count as "about the same". */
const SAME_TEMPERATURE_C = 0.5

function WeatherIcon({
  iconCode,
  size,
  className = 'text-cyan',
}: {
  iconCode: string | null
  size: number
  className?: string
}) {
  const Icon = (iconCode && weatherIcons[iconCode]) || WiCloud

  return <Icon aria-hidden="true" className={`shrink-0 ${className}`} size={size} />
}

function capitalizeDescription(description: string) {
  if (!description) {
    return 'Unavailable'
  }

  return description.charAt(0).toUpperCase() + description.slice(1)
}

function formatForecastDate(date: string, index: number) {
  if (index === 0) {
    return 'Today'
  }

  const [year, month, day] = date.split('-').map(Number)

  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
    new Date(year, month - 1, day),
  )
}

/** Star positions in % of the sky band: [left, top, size px]. */
const STARS: [number, number, number][] = [
  [12, 62, 2], [28, 48, 1.5], [44, 70, 2], [58, 52, 1.5], [72, 64, 2],
  [86, 46, 1.5], [20, 78, 1.5], [64, 80, 1.5], [92, 74, 2], [36, 58, 1],
]

/** Decorative sky + hills band in the same style as the hero window. */
function SkyBackdrop({ isNight }: { isNight: boolean }) {
  return (
    <div
      className={`absolute inset-0 bg-gradient-to-b ${
        isNight ? 'from-sky-night to-sky-night-horizon' : 'from-sky-day to-sky-day-horizon'
      }`}
      aria-hidden="true"
    >
      {isNight &&
        STARS.map(([left, top, size], index) => (
          <span
            key={`${left}-${top}`}
            className="animate-twinkle absolute rounded-full bg-[#f4f1dc]"
            style={{
              left: `${left}%`,
              top: `${top * 0.6}%`,
              width: size,
              height: size,
              animationDelay: `${(index % 5) * 0.7}s`,
            }}
          />
        ))}

      <svg
        className="absolute inset-x-0 bottom-0 h-[55%] w-full"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path
          d="M0 55 C 70 30 140 45 210 38 C 280 30 340 20 400 34 L400 100 L0 100 Z"
          className={isNight ? 'fill-forest/60' : 'fill-mint/35'}
        />
        <path
          d="M0 78 C 90 60 170 74 260 66 C 320 60 370 64 400 70 L400 100 L0 100 Z"
          className={isNight ? 'fill-forest-dark' : 'fill-mint/60'}
        />
      </svg>
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
    </div>
  )
}

function Comparison({ indoor, outdoor }: { indoor: number; outdoor: number }) {
  const difference = indoor - outdoor
  const text =
    Math.abs(difference) < SAME_TEMPERATURE_C
      ? 'About the same inside and out'
      : `Inside is ${Math.abs(difference).toFixed(1)}° ${difference > 0 ? 'warmer' : 'cooler'}`

  return <p className="m-0 text-sm font-extrabold text-ink">{text}</p>
}

function ForecastRow({
  day,
  index,
  scaleMin,
  scaleMax,
}: {
  day: ForecastDay
  index: number
  scaleMin: number
  scaleMax: number
}) {
  const span = Math.max(scaleMax - scaleMin, 1)
  const left = ((day.minTemperature - scaleMin) / span) * 100
  const width = Math.max(((day.maxTemperature - day.minTemperature) / span) * 100, 4)
  const description = capitalizeDescription(day.description)

  return (
    <li className="grid grid-cols-[4.5rem_1.75rem_2rem_minmax(0,1fr)_2rem] items-center gap-2 border-t border-border/70 py-2 first:border-t-0">
      <span className="text-sm font-extrabold text-ink">{formatForecastDate(day.date, index)}</span>

      <span title={description}>
        <WeatherIcon iconCode={day.iconCode} size={26} />
        <span className="sr-only">{description}</span>
      </span>

      <span className="text-right text-xs font-bold text-muted tabular">
        {Math.round(day.minTemperature)}°
      </span>

      <span className="relative h-2 rounded-full bg-cyan/10" aria-hidden="true">
        <span
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-humidity to-temperature"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </span>

      <span className="text-xs font-extrabold text-ink tabular">
        {Math.round(day.maxTemperature)}°
      </span>
    </li>
  )
}

function StateMessage({ title, body, role }: { title: string; body: string; role?: string }) {
  return (
    <div className="p-4" role={role}>
      <p className="m-0 font-extrabold text-ink">{title}</p>
      <p className="m-0 mt-1 text-sm leading-5 text-muted">{body}</p>
    </div>
  )
}

function WeatherLoadingState() {
  return (
    <div className="animate-pulse space-y-2 p-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-7 rounded-lg bg-white/70" />
      ))}
    </div>
  )
}

/**
 * "Outside": a small sky like the hero's window (day or night from the
 * OpenWeather icon), the current weather, and the next days as range bars.
 */
export function WeatherForecastCard({
  weather,
  isLoading,
  error,
  indoorTemperature,
  className = '',
}: WeatherForecastCardProps) {
  const current = !isLoading && !error ? weather?.current : undefined
  const isNight = current?.iconCode?.endsWith('n') ?? false
  const forecast = weather?.forecast ?? []
  const temperatures = forecast.flatMap((day) => [day.minTemperature, day.maxTemperature])
  const scaleMin = Math.min(...temperatures)
  const scaleMax = Math.max(...temperatures)

  return (
    <GlassPanel
      as="section"
      className={`flex flex-col overflow-hidden ${className}`}
      aria-labelledby="weather-heading"
      aria-busy={isLoading}
    >
      <div className="relative isolate min-h-[150px] flex-1 overflow-hidden">
        <SkyBackdrop isNight={isNight} />

        <div className={`relative flex h-full flex-col p-4 ${isNight ? 'text-sidebar-text' : 'text-ink'}`}>
          <h2
            id="weather-heading"
            className={`m-0 text-xs font-extrabold uppercase tracking-[0.12em] ${
              isNight ? 'text-mint' : 'text-forest'
            }`}
          >
            Outside
            {weather && <span className="opacity-70"> · {weather.location}</span>}
          </h2>

          {current && (
            <div className="mt-2 flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-5xl font-extrabold leading-none tracking-tight tabular">
                  {Math.round(current.temperature)}°
                </p>
                <p className="m-0 mt-1.5 text-sm font-bold">
                  {capitalizeDescription(current.description)}
                </p>
                <p className="m-0 text-xs font-semibold opacity-75">
                  Feels like {Math.round(current.feelsLike)}° · Humidity {current.humidity}%
                </p>
              </div>

              <WeatherIcon
                iconCode={current.iconCode}
                size={64}
                className={isNight ? 'text-sidebar-text' : 'text-forest'}
              />
            </div>
          )}
        </div>
      </div>

      {isLoading && <WeatherLoadingState />}

      {!isLoading && error && (
        <StateMessage title="Weather unavailable" body={error} role="status" />
      )}

      {!isLoading && !error && !weather && (
        <StateMessage
          title="No forecast available"
          body="Weather data will appear when the provider responds."
        />
      )}

      {current && (
        <div className="px-4 pb-3 pt-3">
          {indoorTemperature !== null && (
            <div className="mb-2 rounded-xl bg-white/60 px-3 py-2">
              <Comparison indoor={indoorTemperature} outdoor={current.temperature} />
            </div>
          )}

          {forecast.length > 0 && (
            <ul className="m-0 list-none p-0" aria-label="Forecast">
              {forecast.map((day, index) => (
                <ForecastRow
                  key={day.date}
                  day={day}
                  index={index}
                  scaleMin={scaleMin}
                  scaleMax={scaleMax}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </GlassPanel>
  )
}
