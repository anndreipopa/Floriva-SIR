import { Broadcast } from '@phosphor-icons/react'
import type { RealtimeStatus } from '../../hooks/useEnvironmentReadings'
import type { WeightReading } from '../../types/weight'
import { formatDateTime, formatDuration, timeOf } from '../../lib/weight'
import { GlassPanel } from '../GlassPanel'
import { StatusRow } from '../SystemStatusCard'

interface ScaleStatusCardProps {
  latest: WeightReading | null
  realtimeStatus: RealtimeStatus
  isFresh: boolean
  now: number
}

/** Is the robot alive and reporting? What you check first when looking from afar. */
export function ScaleStatusCard({ latest, realtimeStatus, isFresh, now }: ScaleStatusCardProps) {
  // Uptime grows between readings; estimate the current value from the last report.
  const uptimeNowSeconds = latest
    ? latest.deviceUptimeSeconds + (now - timeOf(latest)) / 1000
    : null
  const bootedAtMs = latest ? timeOf(latest) - latest.deviceUptimeSeconds * 1000 : null

  return (
    <GlassPanel as="section" className="p-4" aria-labelledby="scale-status-heading">
      <header className="mb-2 flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-forest/10 text-forest">
          <Broadcast size={22} weight="duotone" aria-hidden="true" />
        </span>
        <h2 id="scale-status-heading" className="m-0 text-lg font-extrabold text-ink">
          Device
        </h2>
      </header>

      <StatusRow
        label="Live connection"
        status={realtimeStatus}
        healthy={realtimeStatus === 'connected'}
      />

      <StatusRow
        label="Scale data"
        status={!latest ? 'No data' : isFresh ? 'Receiving' : 'Stale'}
        healthy={isFresh}
      />

      <InfoRow
        label="Running for"
        value={
          uptimeNowSeconds === null || !isFresh ? '—' : formatDuration(uptimeNowSeconds)
        }
      />

      <InfoRow
        label="Last start"
        value={bootedAtMs === null ? '—' : formatDateTime(bootedAtMs)}
      />

      <InfoRow
        label="Room at last reading"
        value={
          latest?.ambientTemperatureC == null
            ? '—'
            : `${latest.ambientTemperatureC.toFixed(1)} °C`
        }
      />
    </GlassPanel>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/70 py-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="text-sm font-extrabold text-ink tabular">{value}</span>
    </div>
  )
}
