namespace Licenta.API.DTOs;

public sealed class WeatherResponseDto
{
    public string Location { get; init; } = string.Empty;
    public WeatherCurrentDto Current { get; init; } = new();
    public List<ForecastDayDto> Forecast { get; init; } = new();
    public DateTime FetchedAtUtc { get; init; }
}

public sealed class WeatherCurrentDto
{
    public double Temperature { get; init; }
    public double FeelsLike { get; init; }
    public int Humidity { get; init; }
    public string Description { get; init; } = string.Empty;
    public string? IconCode { get; init; }
}