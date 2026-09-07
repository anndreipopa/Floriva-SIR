using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Licenta.API.Configuration;
using Licenta.API.DTOs;
using Licenta.API.Services.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Licenta.API.Services;

public sealed class OpenWeatherMapService : IWeatherService
{
    private const string CacheKey = "weather-response";

    private static readonly TimeSpan CacheDuration =
        TimeSpan.FromMinutes(15);

    private readonly HttpClient _httpClient;
    private readonly OpenWeatherMapOptions _options;
    private readonly IMemoryCache _cache;

    public OpenWeatherMapService(
        HttpClient httpClient,
        IOptions<OpenWeatherMapOptions> options,
        IMemoryCache cache)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _cache = cache;
    }

    public async Task<WeatherResponseDto> GetWeatherAsync(
        CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue(
                CacheKey,
                out WeatherResponseDto? cachedWeather) &&
            cachedWeather is not null)
        {
            return cachedWeather;
        }

        ValidateOptions();

        var currentUrl = BuildUrl("weather");
        var forecastUrl = BuildUrl("forecast");

        var currentTask =
            _httpClient.GetFromJsonAsync<CurrentWeatherResponse>(
                currentUrl,
                cancellationToken);

        var forecastTask =
            _httpClient.GetFromJsonAsync<ForecastResponse>(
                forecastUrl,
                cancellationToken);

        var current = await currentTask
            ?? throw new InvalidOperationException(
                "OpenWeather returned no current weather data.");

        var forecast = await forecastTask
            ?? throw new InvalidOperationException(
                "OpenWeather returned no forecast data.");

        var weather = MapResponse(current, forecast);

        _cache.Set(
            CacheKey,
            weather,
            CacheDuration);

        return weather;
    }

    private string BuildUrl(string endpoint)
    {
        var baseUrl = _options.BaseUrl.TrimEnd('/');

        var latitude = _options.Latitude.ToString(
            CultureInfo.InvariantCulture);

        var longitude = _options.Longitude.ToString(
            CultureInfo.InvariantCulture);

        var units = Uri.EscapeDataString(_options.Units);
        var apiKey = Uri.EscapeDataString(_options.ApiKey);

        return $"{baseUrl}/{endpoint}" +
               $"?lat={latitude}" +
               $"&lon={longitude}" +
               $"&units={units}" +
               $"&appid={apiKey}";
    }

    private void ValidateOptions()
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            throw new InvalidOperationException(
                "OpenWeather API key is not configured.");
        }

        if (_options.Latitude is < -90 or > 90)
        {
            throw new InvalidOperationException(
                "OpenWeather latitude must be between -90 and 90.");
        }

        if (_options.Longitude is < -180 or > 180)
        {
            throw new InvalidOperationException(
                "OpenWeather longitude must be between -180 and 180.");
        }

        if (string.IsNullOrWhiteSpace(_options.Units))
        {
            throw new InvalidOperationException(
                "OpenWeather units are not configured.");
        }
    }

    private static WeatherResponseDto MapResponse(
        CurrentWeatherResponse current,
        ForecastResponse forecast)
    {
        var timezoneOffsetSeconds = forecast.City.Timezone;

        var localNow = DateTimeOffset.UtcNow.ToOffset(
            TimeSpan.FromSeconds(timezoneOffsetSeconds));

        var firstForecastDate = DateOnly.FromDateTime(
            localNow.DateTime);

        var lastForecastDate = firstForecastDate.AddDays(3);

        var forecastDays = forecast.List
            .GroupBy(item =>
                ToLocalDate(
                    item.Dt,
                    timezoneOffsetSeconds))
            .Where(group =>
                group.Key >= firstForecastDate &&
                group.Key <= lastForecastDate)
            .OrderBy(group => group.Key)
            .Take(4)
            .Select(group =>
                MapForecastDay(
                    group.Key,
                    group.ToList(),
                    timezoneOffsetSeconds))
            .ToList();

        return new WeatherResponseDto
        {
            Location = current.Name,
            Current = new WeatherCurrentDto
            {
                Temperature = current.Main.Temperature,
                FeelsLike = current.Main.FeelsLike,
                Humidity = current.Main.Humidity,
                Description = GetDescription(current.Weather),
                IconCode = GetIconCode(current.Weather)
            },
            Forecast = forecastDays,
            FetchedAtUtc = DateTime.UtcNow
        };
    }

    private static ForecastDayDto MapForecastDay(
        DateOnly date,
        List<ForecastItem> items,
        int timezoneOffsetSeconds)
    {
        var daytimeItem = items
            .OrderBy(item =>
                Math.Abs(
                    GetLocalHour(
                        item.Dt,
                        timezoneOffsetSeconds) - 12))
            .First();

        return new ForecastDayDto
        {
            Date = date,
            MinTemperature = items.Min(
                item => item.Main.Temperature),
            MaxTemperature = items.Max(
                item => item.Main.Temperature),
            FeelsLike = daytimeItem.Main.FeelsLike,
            Humidity = daytimeItem.Main.Humidity,
            Description = GetDescription(
                daytimeItem.Weather),
            IconCode = GetIconCode(
                daytimeItem.Weather)
        };
    }

    private static DateOnly ToLocalDate(
        long unixSeconds,
        int timezoneOffsetSeconds)
    {
        var localDateTime = DateTimeOffset
            .FromUnixTimeSeconds(unixSeconds)
            .ToOffset(TimeSpan.FromSeconds(timezoneOffsetSeconds))
            .DateTime;

        return DateOnly.FromDateTime(localDateTime);
    }

    private static int GetLocalHour(
        long unixSeconds,
        int timezoneOffsetSeconds)
    {
        return DateTimeOffset
            .FromUnixTimeSeconds(unixSeconds)
            .ToOffset(TimeSpan.FromSeconds(timezoneOffsetSeconds))
            .Hour;
    }

    private static string GetDescription(
        List<WeatherCondition> conditions)
    {
        return conditions
            .FirstOrDefault()?
            .Description
            ?? "Unknown";
    }

    private static string? GetIconCode(
        List<WeatherCondition> conditions)
    {
        return conditions
            .FirstOrDefault()?
            .Icon;
    }

    private sealed class CurrentWeatherResponse
    {
        public string Name { get; set; } = string.Empty;
        public WeatherMain Main { get; set; } = new();
        public List<WeatherCondition> Weather { get; set; } = new();
    }

    private sealed class ForecastResponse
    {
        public ForecastCity City { get; set; } = new();
        public List<ForecastItem> List { get; set; } = new();
    }

    private sealed class ForecastItem
    {
        [JsonPropertyName("dt")]
        public long Dt { get; set; }

        public WeatherMain Main { get; set; } = new();
        public List<WeatherCondition> Weather { get; set; } = new();
    }

    private sealed class ForecastCity
    {
        public int Timezone { get; set; }
    }

    private sealed class WeatherMain
    {
        [JsonPropertyName("temp")]
        public double Temperature { get; set; }

        [JsonPropertyName("feels_like")]
        public double FeelsLike { get; set; }

        public int Humidity { get; set; }
    }

    private sealed class WeatherCondition
    {
        public string Description { get; set; } = string.Empty;
        public string? Icon { get; set; }
    }
}