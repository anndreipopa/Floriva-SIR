namespace Licenta.API.Configuration;

public sealed class OpenWeatherMapOptions
{
    public const string SectionName = "OpenWeatherMap";

    public string ApiKey { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string Units { get; set; } = "metric";
    public string BaseUrl { get; set; } =
        "https://api.openweathermap.org/data/2.5/";
}