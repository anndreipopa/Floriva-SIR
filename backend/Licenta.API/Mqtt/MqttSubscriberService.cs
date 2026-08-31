using Licenta.API.Mqtt;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text;
using MQTTnet;
using Licenta.API.Services;
using System.Text.Json;
using Licenta.API.Models;

namespace Licenta.API.Mqtt;

/// <summary>
/// Maintains the MQTT subscription and places each valid sensor payload
/// into the shared in-memory latest-reading store.
/// </summary>
public class MqttSubscriberService : BackgroundService
{
    private readonly MqttOptions _options;
    private readonly SensorReadingStore _store;
    private readonly ILogger<MqttSubscriberService> _logger;

    public MqttSubscriberService(
        MqttOptions options,
        SensorReadingStore store,
        ILogger<MqttSubscriberService> logger)
    {
        _options = options;
        _store = store;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MQTT subscriber starting for topic {Topic}", _options.Topic);
        var factory = new MqttClientFactory();
        using var client = factory.CreateMqttClient();
    
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

        var mqttOptions = optionsBuilder.Build();

        
// MQTT callbacks update the shared store whenever the ESP32 publishes a reading
        client.ApplicationMessageReceivedAsync += e =>
        {
            var payload = Encoding.UTF8.GetString(
                e.ApplicationMessage.Payload);

            var reading = JsonSerializer.Deserialize<SensorReading>(payload, new JsonSerializerOptions{
                PropertyNameCaseInsensitive = true
            });

            if (reading is null)
            {
                _logger.LogWarning("Invalid sensor payload: {Payload}", payload);
                return Task.CompletedTask;
            }
//Use server receipt time so timestamps do not depends on the ESP32 clock.
            reading.ReceivedAtUtc = DateTime.UtcNow;
            _store.SetLatest(reading);

            _logger.LogInformation("Latest reading stored: Temp={Temperature}, RH={Humidity}, Lux={Lux}", reading.Temperature, reading.Humidity, reading.Lux);

            _logger.LogInformation(
                "Received MQTT message on {Topic}: {Payload}",
                e.ApplicationMessage.Topic,
                payload);

            return Task.CompletedTask;
        };

        await client.ConnectAsync(mqttOptions, stoppingToken);

        _logger.LogInformation("Connected to HiveMQ");

        await client.SubscribeAsync(
            new MqttTopicFilterBuilder()
                .WithTopic(_options.Topic)
                .Build(),
            stoppingToken);

        _logger.LogInformation(
            "Subscribed to MQTT topic {Topic}",
            _options.Topic);

        try
        {
            //Keep the hosted service alive while MQTTnet receives messages through callbacks.
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("MQTT subscriber stopping");
        }

    
    }

}