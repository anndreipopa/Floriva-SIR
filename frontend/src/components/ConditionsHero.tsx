import { daylightFactor, describeConditions } from '../lib/conditions'
import type { EnvironmentReading } from '../types/sensorReading'
import { WindowScene } from './WindowScene'

interface ConditionsHeroProps {
  latest: EnvironmentReading | null
}

/** Above this the scene is bright enough for dark text. */
const DARK_TEXT_DAYLIGHT = 0.55

/**
 * The page's focal point: the latest reading in words and one big number,
 * over an illustration whose sky follows the measured light.
 */
export function ConditionsHero({ latest }: ConditionsHeroProps) {
  const lux = latest?.lux ?? 0
  const humidity = latest?.humidity ?? 50
  const isDarkScene = daylightFactor(lux) < DARK_TEXT_DAYLIGHT

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate h-[260px] overflow-hidden rounded-2xl border border-white/85 shadow-[0_18px_40px_-22px_rgba(20,110,105,0.55)] sm:h-[300px] lg:h-full lg:min-h-[220px]"
    >
      <WindowScene lux={lux} humidity={humidity} />

      {/* Scrim keeps the text readable whatever the sky looks like */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${
          isDarkScene
            ? 'from-night/75 via-night/30'
            : 'from-daylight/85 via-daylight/35'
        } to-transparent`}
        aria-hidden="true"
      />

      {/* Glossy Aero highlight across the top */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
        aria-hidden="true"
      />

      <div
        className={`relative flex h-full max-w-[540px] flex-col justify-between p-5 sm:p-6 lg:p-7 ${
          isDarkScene ? 'text-sidebar-text' : 'text-ink'
        }`}
      >
        <h1
          id="hero-heading"
          className={`m-0 text-xs font-extrabold uppercase tracking-[0.12em] ${
            isDarkScene ? 'text-mint' : 'text-forest'
          }`}
        >
          Environment <span className="opacity-70">· indoors, right now</span>
        </h1>

        {latest ? (
          <div>
            <p className="m-0 flex items-start leading-none tabular">
              <span className="text-[68px] font-extrabold tracking-tight sm:text-[84px] lg:text-[clamp(64px,10vh,100px)]">
                {latest.temperature.toFixed(1)}
              </span>
              <span className="mt-2 ml-1 text-3xl font-extrabold text-temperature">°C</span>
            </p>

            <p className="m-0 mt-2 max-w-[34ch] text-lg font-bold leading-snug sm:text-xl">
              {describeConditions(latest.temperature, latest.humidity, latest.lux)}
            </p>
          </div>
        ) : (
          <p className="m-0 max-w-[24ch] text-2xl font-extrabold leading-tight">
            Waiting for the robot to send its first reading.
          </p>
        )}

      </div>
    </section>
  )
}
