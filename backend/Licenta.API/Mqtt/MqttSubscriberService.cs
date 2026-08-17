using Licenta.API.Mqtt;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text;
using MQTTnet;
using Licenta.API.Services;

namespace Licenta.API.Mqtt;

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

        

        client.ApplicationMessageReceivedAsync += e =>
        {
            var payload = Encoding.UTF8.GetString(
                e.ApplicationMessage.Payload);

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
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("MQTT subscriber stopping");
        }

    
    }

}