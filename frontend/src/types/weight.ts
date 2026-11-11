// Matches WeightReadingDto from the backend (/api/weight/* and the "WeightReadingReceived"
// SignalR event). Dates arrive as ISO strings because JSON has no date type.

export interface WeightReading {
  id: number
  receivedAtUtc: string
  pot: number
  grams: number
  /** Filtered raw HX711 counts. */
  raw: number
  /** Max − min of the samples the firmware kept: a noise indicator, in raw counts. */
  spreadRaw: number
  /** False if the firmware could not get a settled reading. */
  stable: boolean
  /** Seconds since the ESP32 booted; a drop between readings means it restarted. */
  deviceUptimeSeconds: number
  /** Room temperature at that moment, if a recent environment reading existed. */
  ambientTemperatureC: number | null
}
