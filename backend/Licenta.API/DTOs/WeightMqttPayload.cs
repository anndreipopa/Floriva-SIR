namespace Licenta.API.DTOs;

/// <summary>
/// Shape of the JSON the ESP32 publishes on the weight topic, e.g.
/// {"pot":1,"grams":682,"raw":379204,"spread":702,"stable":true,"uptimeS":12345}.
/// Every field is nullable so a missing field can be detected and rejected instead of
/// silently becoming 0.
/// </summary>
public sealed record WeightMqttPayload(
    int? Pot,
    int? Grams,
    int? Raw,
    int? Spread,
    bool? Stable,
    long? UptimeS);
