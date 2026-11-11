using System.Text.Json;
using Licenta.API.Data;
using Licenta.API.DTOs;
using Licenta.API.Models;
using Licenta.API.Services.Interfaces;

namespace Licenta.API.Services;

/// <summary>
/// Turns one MQTT weight message into a stored row and a live SignalR update.
/// Kept out of MqttSubscriberService so the subscriber only deals with the connection.
/// </summary>
public sealed class WeightReadingIngestService
{
    /// <summary>Pots on the rail are numbered 1..3.</summary>
    private const int MinPot = 1;
    private const int MaxPot = 3;

    /// <summary>
    /// The 5 kg cells cannot report more than this; anything far outside is corrupt data.
    /// Small negative values are allowed (zero drift around an empty scale).
    /// </summary>
    private const int MinPlausibleGrams = -1_000;
    private const int MaxPlausibleGrams = 10_000;

    /// <summary>
    /// Environment readings arrive every ~3 minutes. Older than this and the temperature
    /// no longer describes the moment of the weighing, so it is not attached.
    /// </summary>
    private static readonly TimeSpan AmbientMaxAge = TimeSpan.FromMinutes(10);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly SensorReadingStore _environmentStore;
    private readonly IWeightUpdatePublisher _updatePublisher;
    private readonly ILogger<WeightReadingIngestService> _logger;

    public WeightReadingIngestService(
        IServiceScopeFactory scopeFactory,
        SensorReadingStore environmentStore,
        IWeightUpdatePublisher updatePublisher,
        ILogger<WeightReadingIngestService> logger)
    {
        _scopeFactory = scopeFactory;
        _environmentStore = environmentStore;
        _updatePublisher = updatePublisher;
        _logger = logger;
    }

    public async Task HandlePayloadAsync(string payload, CancellationToken cancellationToken)
    {
        var reading = Parse(payload);
        if (reading is null)
        {
            return;
        }

        try
        {
            // Hosted services are singletons, DbContext is scoped: one scope per message.
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<FlorivaDbContext>();
            db.WeightReadings.Add(reading);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Still broadcast below: the live view stays useful while the database is down.
            _logger.LogError(ex, "Failed to save weight reading for pot {Pot}", reading.Pot);
        }

        try
        {
            await _updatePublisher.WeightReadingReceivedAsync(
                WeightReadingDto.FromEntity(reading),
                cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Failed to broadcast weight reading");
        }

        _logger.LogInformation(
            "Weight reading: pot {Pot} = {Grams} g (spread {Spread}, stable {Stable}, uptime {Uptime} s, room {Temperature} °C)",
            reading.Pot,
            reading.Grams,
            reading.SpreadRaw,
            reading.Stable,
            reading.DeviceUptimeSeconds,
            reading.AmbientTemperatureC);
    }

    /// <summary>Validates the payload and builds the entity, or returns null (and logs why).</summary>
    private WeightReading? Parse(string payload)
    {
        WeightMqttPayload? message;
        try
        {
            message = JsonSerializer.Deserialize<WeightMqttPayload>(payload, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Malformed weight payload: {Payload}", payload);
            return null;
        }

        if (message is not { Pot: { } pot, Grams: { } grams, Raw: { } raw, Spread: { } spread,
                Stable: { } stable, UptimeS: { } uptime })
        {
            _logger.LogWarning("Weight payload is missing fields: {Payload}", payload);
            return null;
        }

        if (pot is < MinPot or > MaxPot ||
            grams is < MinPlausibleGrams or > MaxPlausibleGrams ||
            spread < 0 || uptime < 0)
        {
            _logger.LogWarning("Weight payload out of range: {Payload}", payload);
            return null;
        }

        var receivedAtUtc = DateTime.UtcNow;

        return new WeightReading
        {
            ReceivedAtUtc = receivedAtUtc,
            Pot = pot,
            Grams = grams,
            Raw = raw,
            SpreadRaw = spread,
            Stable = stable,
            DeviceUptimeSeconds = uptime,
            AmbientTemperatureC = RecentAmbientTemperature(receivedAtUtc),
        };
    }

    private float? RecentAmbientTemperature(DateTime nowUtc)
    {
        var environment = _environmentStore.GetLatest();
        if (environment is null || nowUtc - environment.ReceivedAtUtc > AmbientMaxAge)
        {
            return null;
        }
        return environment.Temperature;
    }
}
