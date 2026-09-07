namespace Licenta.API.DTOs;

public sealed class ForecastDayDto
{
    public DateOnly Date { get; init; }
    public double MinTemperature { get; init; }
    public double MaxTemperature { get; init; }
    public double FeelsLike { get; init; }
    public int Humidity { get; init; }
    public string Description { get; init; } = string.Empty;
    public string? IconCode { get; init; }
}