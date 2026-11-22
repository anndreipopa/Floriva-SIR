namespace Licenta.API.DTOs;

/// <summary>
/// Shape of the JSON the ESP32 publishes on the status topic, e.g.
/// {"pot":1,"session":"6f1c…","state":"warming_up","secondsLeft":25,"uptimeS":90210}
/// {"pot":1,"session":"6f1c…","state":"error","error":"tare_failed","uptimeS":90260}
/// {"pot":1,"session":null,"state":"idle","uptimeS":95600}
/// Nullable so missing fields are detected. SecondsLeft and Error are optional by contract.
/// </summary>
public sealed record RobotStatusMqttPayload(
    int? Pot,
    string? Session,
    string? State,
    int? SecondsLeft,
    string? Error,
    long? UptimeS);

/// <summary>Device measurement states, exactly as the firmware sends them.</summary>
public static class DeviceState
{
    public const string Idle = "idle";
    public const string WarmingUp = "warming_up";
    public const string Taring = "taring";
    public const string Streaming = "streaming";
    public const string Error = "error";

    public static readonly IReadOnlySet<string> All =
        new HashSet<string> { Idle, WarmingUp, Taring, Streaming, Error };
}
