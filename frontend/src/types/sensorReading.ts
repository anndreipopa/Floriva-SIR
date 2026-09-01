//Matches the JSON shapre returned by the backend sensor endpoints
//Dates arrive as ISO strings because JSON has no native date type

export interface EnvironmentReading {
    id?: number
    receivedAtUtc: string
    temperature: number
    humidity: number
    lux: number
}