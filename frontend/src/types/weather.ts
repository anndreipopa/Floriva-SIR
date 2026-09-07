export interface WeatherCurrent {
  temperature: number
  feelsLike: number
  humidity: number
  description: string
  iconCode: string | null
}

export interface ForecastDay {
  date: string
  minTemperature: number
  maxTemperature: number
  feelsLike: number
  humidity: number
  description: string
  iconCode: string | null
}

export interface WeatherResponse {
  location: string
  current: WeatherCurrent
  forecast: ForecastDay[]
  fetchedAtUtc: string
}