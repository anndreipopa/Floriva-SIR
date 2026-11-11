namespace Licenta.API.Models;

/// <summary>
/// One load-cell weighing as stored in PostgreSQL. Every MQTT weight message becomes a row
/// (unlike environment readings, which are snapshotted every 30 minutes), because the
/// creep/drift analysis needs the full series.
/// </summary>
public class WeightReading
{
    public long Id { get; set; }

    /// <summary>Server time when the MQTT message arrived (the ESP32 has no real clock).</summary>
    public DateTime ReceivedAtUtc { get; set; }

    /// <summary>Pot number, 1..3.</summary>
    public int Pot { get; set; }

    public int Grams { get; set; }

    /// <summary>Filtered raw HX711 counts; lets us re-analyse drift independent of calibration.</summary>
    public int Raw { get; set; }

    /// <summary>Max - min of the samples the firmware filter kept: a noise indicator.</summary>
    public int SpreadRaw { get; set; }

    /// <summary>False if the firmware could not get a settled reading.</summary>
    public bool Stable { get; set; }

    /// <summary>Seconds since the ESP32 booted. A drop between rows means it restarted.</summary>
    public long DeviceUptimeSeconds { get; set; }

    /// <summary>
    /// Room temperature from the latest environment reading, if it was recent enough.
    /// Stored next to the weight so temperature drift can be analysed later.
    /// </summary>
    public float? AmbientTemperatureC { get; set; }
}
