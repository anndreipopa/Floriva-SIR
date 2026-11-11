using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text;
using MQTTnet;
using Licenta.API.Services;
using System.Text.Json;
using Licenta.API.Models;
using Licenta.API.DTOs;
using Licenta.API.Services.Interfaces;

namespace Licenta.API.Mqtt;

/// <summary>
/// Keeps one MQTT connection alive (reconnecting with backoff if the broker drops it),
/// subscribes to the environment and weight topics, and routes each message by topic:
/// environment readings go to the in-memory store + SignalR, weight readings go to
/// <see cref="WeightReadingIngestService"/>.
/// </summary>
public class MqttSubscriberService : BackgroundService
{
    /// <summary>How often the loop checks that the connection is still up.</summary>
    private static readonly TimeSpan HealthCheckInterval = TimeSpan.FromSeconds(5);

    /// <summary>First retry after a failed connect; doubles on each failure up to the max.</summary>
    private static readonly TimeSpan InitialRetryDelay = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan MaxRetryDelay = TimeSpan.FromSeconds(60);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly MqttOptions _options;
    private readonly SensorReadingStore _store;
    private readonly IEnvironmentUpdatePublisher _updatePublisher;
    private readonly WeightReadingIngestService _weightIngest;
    private readonly ILogger<MqttSubscriberService> _logger;

    public MqttSubscriberService(
        MqttOptions options,
        SensorReadingStore store,
        IEnvironmentUpdatePublisher updatePublisher,
        WeightReadingIngestService weightIngest,
        ILogger<MqttSubscriberService> logger)
    {
        _options = options;
        _store = store;
        _updatePublisher = updatePublisher;
        _weightIngest = weightIngest;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "MQTT subscriber starting for topics {Topic} and {WeightTopic}",
            _options.Topic,
            _options.WeightTopic);

        var factory = new MqttClientFactory();
        using var client = factory.CreateMqttClient();
        var clientOptions = BuildClientOptions();

        client.ApplicationMessageReceivedAsync += e => HandleMessageAsync(e, stoppingToken);

        client.DisconnectedAsync += e =>
        {
            if (e.ClientWasConnected && !stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(e.Exception, "MQTT connection lost ({Reason}); will reconnect", e.Reason);
            }
            return Task.CompletedTask;
        };

        // Supervisor loop: connect when not connected, otherwise just check again later.
        // This replaces "connect once and hope": a broker restart or network blip used to
        // stop all data until the whole app was restarted.
        var retryDelay = InitialRetryDelay;
        while (!stoppingToken.IsCancellationRequested)
        {
            if (!client.IsConnected)
            {
                try
                {
                    await ConnectAndSubscribeAsync(client, clientOptions, stoppingToken);
                    retryDelay = InitialRetryDelay;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "MQTT connect failed; retrying in {Delay}", retryDelay);
                    if (!await DelayAsync(retryDelay, stoppingToken))
                    {
                        break;
                    }
                    retryDelay = TimeSpan.FromTicks(Math.Min(retryDelay.Ticks * 2, MaxRetryDelay.Ticks));
                    continue;
                }
            }

            if (!await DelayAsync(HealthCheckInterval, stoppingToken))
            {
                break;
            }
        }

        _logger.LogInformation("MQTT subscriber stopping");
        if (client.IsConnected)
        {
            await client.DisconnectAsync(new MqttClientDisconnectOptionsBuilder().Build(), CancellationToken.None);
        }
    }

    private MqttClientOptions BuildClientOptions()
    {
        var optionsBuilder = new MqttClientOptionsBuilder()
            .WithTcpServer(_options.Host, _options.Port)
            .WithCredentials(_options.Username, _options.Password);

        if (_options.UseTls)
        {
            optionsBuilder.WithTlsOptions(tls =>
            {
                tls.UseTls();
            });
        }

        return optionsBuilder.Build();
    }

    private async Task ConnectAndSubscribeAsync(
        IMqttClient client,
        MqttClientOptions clientOptions,
        CancellationToken stoppingToken)
    {
        await client.ConnectAsync(clientOptions, stoppingToken);
        _logger.LogInformation("Connected to HiveMQ");

        // A new connection starts with no subscriptions (clean session), so subscribe every time.
        foreach (var topic in new[] { _options.Topic, _options.WeightTopic })
        {
            await client.SubscribeAsync(
                new MqttTopicFilterBuilder().WithTopic(topic).Build(),
                stoppingToken);
            _logger.LogInformation("Subscribed to MQTT topic {Topic}", topic);
        }
    }

    /// <summary>Waits; returns false if the app is shutting down.</summary>
    private static async Task<bool> DelayAsync(TimeSpan delay, CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(delay, stoppingToken);
            return true;
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }

    private async Task HandleMessageAsync(
        MqttApplicationMessageReceivedEventArgs e,
        CancellationToken stoppingToken)
    {
        var topic = e.ApplicationMessage.Topic;
        var payload = Encoding.UTF8.GetString(e.ApplicationMessage.Payload);

        _logger.LogInformation("Received MQTT message on {Topic}: {Payload}", topic, payload);

        try
        {
            if (topic == _options.WeightTopic)
            {
                await _weightIngest.HandlePayloadAsync(payload, stoppingToken);
            }
            else if (topic == _options.Topic)
            {
                await HandleEnvironmentAsync(payload, stoppingToken);
            }
            else
            {
                _logger.LogWarning("Message on unexpected topic {Topic} ignored", topic);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // One bad message must never take the subscriber down.
            _logger.LogError(ex, "Failed to handle MQTT message on {Topic}", topic);
        }
    }

    private async Task HandleEnvironmentAsync(string payload, CancellationToken stoppingToken)
    {
        SensorReading? reading;
        try
        {
            reading = JsonSerializer.Deserialize<SensorReading>(payload, JsonOptions);
        }
        catch (JsonException ex)
        {
            //A malformed payload must never take the subscriber down
            _logger.LogWarning(ex, "Malformed sensor payload: {Payload}", payload);
            return;
        }

        if (reading is null)
        {
            _logger.LogWarning("Invalid sensor payload: {Payload}", payload);
            return;
        }
        //Use server receipt time so timestamps do not depends on the ESP32 clock.
        reading.ReceivedAtUtc = DateTime.UtcNow;
        _store.SetLatest(reading);

        var readingDto = new EnvironmentReadingDto(
            reading.ReceivedAtUtc,
            reading.Temperature,
            reading.Humidity,
            reading.Lux);

        await _updatePublisher.ReadingReceivedAsync(
            readingDto,
            stoppingToken);

        _logger.LogInformation(
            "Live reading updated in memory and broadcast: Temp={Temperature}, RH={Humidity}, Lux={Lux}",
            reading.Temperature,
            reading.Humidity,
            reading.Lux);
    }
}
