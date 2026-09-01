namespace Licenta.API.DTOs;
/// <summary>
/// Public environment-reading contract sent to API and SignalR clients.
/// </summary>
public sealed record EnvironmentReadingDto(
    DateTime ReceivedAtUtc,
    float Temperature,
    float Humidity,
    float Lux);