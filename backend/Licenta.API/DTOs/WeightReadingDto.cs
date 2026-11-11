using Licenta.API.Models;

namespace Licenta.API.DTOs;

/// <summary>
/// Public weight-reading contract sent to REST and SignalR clients.
/// </summary>
public sealed record WeightReadingDto(
    long Id,
    DateTime ReceivedAtUtc,
    int Pot,
    int Grams,
    int Raw,
    int SpreadRaw,
    bool Stable,
    long DeviceUptimeSeconds,
    float? AmbientTemperatureC)
{
    public static WeightReadingDto FromEntity(WeightReading reading) => new(
        reading.Id,
        reading.ReceivedAtUtc,
        reading.Pot,
        reading.Grams,
        reading.Raw,
        reading.SpreadRaw,
        reading.Stable,
        reading.DeviceUptimeSeconds,
        reading.AmbientTemperatureC);
}
