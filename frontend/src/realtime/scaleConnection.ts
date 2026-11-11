import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'
import { apiBaseUrl } from '../api/apiBaseUrl'

/** Name of the server event carrying one new weighing (see SignalRWeightUpdatePublisher.cs). */
export const WEIGHT_READING_EVENT = 'WeightReadingReceived'

/**
 * SignalR connection for live weight readings. One per mounted Scale page.
 * Same reconnect schedule as the environment connection.
 */
export function createScaleConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${apiBaseUrl}/hubs/scale`, { withCredentials: true })
    .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
    .configureLogging(LogLevel.Information)
    .build()
}
