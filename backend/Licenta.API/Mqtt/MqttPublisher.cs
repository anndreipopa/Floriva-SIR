using MQTTnet;
using MQTTnet.Protocol;

namespace Licenta.API.Mqtt;

/// <summary>Sends messages to the broker over the subscriber's existing connection.</summary>
public interface IMqttPublisher
{
    /// <summary>
    /// Publishes with QoS 1. Returns false (and logs why) if there is no connection or the
    /// broker did not accept the message; never throws for those cases.
    /// </summary>
    Task<bool> PublishAsync(string topic, string payload, bool retain, CancellationToken cancellationToken);
}

/// <summary>
/// One MQTT connection for the whole app: <see cref="MqttSubscriberService"/> owns the client
/// (connect, reconnect, subscribe) and hands it over with <see cref="Attach"/>. Publishing on
/// the same connection avoids a second login, a second reconnect loop and a second client id.
/// </summary>
public sealed class MqttPublisher : IMqttPublisher
{
    private readonly ILogger<MqttPublisher> _logger;

    // Written by the subscriber's background loop, read by request threads: volatile so a
    // reader always sees the latest reference.
    private volatile IMqttClient? _client;

    public MqttPublisher(ILogger<MqttPublisher> logger)
    {
        _logger = logger;
    }

    public void Attach(IMqttClient client) => _client = client;

    public async Task<bool> PublishAsync(
        string topic,
        string payload,
        bool retain,
        CancellationToken cancellationToken)
    {
        var client = _client;
        if (client is null || !client.IsConnected)
        {
            _logger.LogWarning("Not connected to MQTT; message to {Topic} not sent", topic);
            return false;
        }

        var message = new MqttApplicationMessageBuilder()
            .WithTopic(topic)
            .WithPayload(payload)
            .WithQualityOfServiceLevel(MqttQualityOfServiceLevel.AtLeastOnce)
            .WithRetainFlag(retain)
            .Build();

        try
        {
            var result = await client.PublishAsync(message, cancellationToken);
            if (!result.IsSuccess)
            {
                _logger.LogWarning("Broker refused message to {Topic}: {Reason}", topic, result.ReasonCode);
                return false;
            }

            _logger.LogInformation("Published to {Topic}: {Payload}", topic, payload);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The connection can drop between the IsConnected check and the publish.
            _logger.LogWarning(ex, "Publishing to {Topic} failed", topic);
            return false;
        }
    }
}
