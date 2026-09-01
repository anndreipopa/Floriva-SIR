import {
    HubConnectionBuilder,
    LogLevel,
    type HubConnection,
} from '@microsoft/signalr'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

if(!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not configured')
}

/**
 * Creates the signalR connection used to receive environment updates
 * A new connection is created for each mounted environment page.
 */

export function createEnvironmentConnection(): HubConnection {
    return new HubConnectionBuilder()
    .withUrl(`${apiBaseUrl}/hubs/environment`, {
        withCredentials: true,
    })
    .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
    .configureLogging(LogLevel.Information)
    .build()
}