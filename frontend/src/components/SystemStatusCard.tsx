import type { RealtimeStatus } from '../hooks/useEnvironmentReadings'
import { GlassPanel } from './GlassPanel'

interface SystemStatusCardProps {
  realtimeStatus: RealtimeStatus
  /** ISO timestamp of the latest sensor reading, or null if none yet. */
  latestReceivedAtUtc: string | null
  isFresh: boolean
  storedReadings: number
  className?: string
}

function formatReadingTime(isoUtc: string) {
  return new Date(isoUtc).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Health of the data pipeline: when the last reading arrived, the SignalR
 * link, sensor freshness and stored history.
 */
export function SystemStatusCard({
  realtimeStatus,
  latestReceivedAtUtc,
  isFresh,
  storedReadings,
  className = '',
}: SystemStatusCardProps) {
  const isHealthy = realtimeStatus === 'connected' && isFresh

  return (
    <GlassPanel as="section" className={`p-4 ${className}`} aria-labelledby="status-heading">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="status-heading" className="m-0 text-lg font-extrabold text-ink">
          System status
        </h2>

        <span
          className={`h-3 w-3 rounded-full ${isHealthy ? 'animate-pulse bg-success' : 'bg-warning'}`}
          aria-hidden="true"
        />
      </div>

      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-sm font-semibold text-muted">Latest reading</span>
        {latestReceivedAtUtc ? (
          <time className="text-sm font-extrabold text-ink tabular" dateTime={latestReceivedAtUtc}>
            {formatReadingTime(latestReceivedAtUtc)}
          </time>
        ) : (
          <span className="text-sm font-extrabold text-muted">None yet</span>
        )}
      </div>

      <StatusRow
        label="Realtime connection"
        status={realtimeStatus}
        healthy={realtimeStatus === 'connected'}
      />

      <StatusRow
        label="Ambient sensors"
        status={!latestReceivedAtUtc ? 'No data' : isFresh ? 'Receiving data' : 'Data is stale'}
        healthy={isFresh}
      />

      <StatusRow
        label="Stored readings"
        status={storedReadings > 0 ? `${storedReadings} available` : 'No history'}
        healthy={storedReadings > 0}
      />
    </GlassPanel>
  )
}

function StatusRow({
  label,
  status,
  healthy,
}: {
  label: string
  status: string
  healthy: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/70 py-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>

      <span
        className={`flex items-center gap-2 whitespace-nowrap text-right text-sm font-extrabold uppercase ${
          healthy ? 'text-success' : 'text-warning'
        }`}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthy ? 'bg-success' : 'bg-warning'}`}
        />
        {status}
      </span>
    </div>
  )
}
