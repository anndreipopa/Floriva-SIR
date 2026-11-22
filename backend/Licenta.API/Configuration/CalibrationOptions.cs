namespace Licenta.API.Configuration;

/// <summary>
/// Settings for the user calibration session (design: docs/design/moisture-calibration.md).
/// </summary>
public sealed class CalibrationOptions
{
    /// <summary>
    /// Wait between "Done watering" and "Save wet point", so excess water drains off first.
    /// 30 min by design (D2). Lower it with CALIBRATION_DRAIN_MINUTES only for bench tests.
    /// </summary>
    public int DrainMinutes { get; set; } = 30;
}
