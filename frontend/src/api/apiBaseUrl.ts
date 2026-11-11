// Single place that reads and validates the backend URL.
// (sensorReadingsApi.ts, weatherApi.ts and environmentConnection.ts still read it themselves;
// they can switch to this module in a later cleanup.)

const configured = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

if (!configured) {
  throw new Error('VITE_API_BASE_URL is not configured')
}

/** Backend origin without a trailing slash, e.g. https://example.azurewebsites.net */
export const apiBaseUrl: string = configured
