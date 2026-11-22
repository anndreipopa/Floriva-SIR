namespace Licenta.API.Models;

/// <summary>
/// The user's calibration of one pot slot, plus the calibration session in progress (if any).
/// One row per pot, overwritten on recalibration: no history (design D5).
///
/// Two groups of columns on purpose:
///  - Dry/Wet/CalibratedAt = the RESULT. Only changes when a whole session succeeds, so an
///    abandoned session never leaves a half-new calibration behind.
///  - Session* / Device* = the session in progress. Cleared when it ends.
/// </summary>
public class PotCalibration
{
    /// <summary>Pot slot 1..3; also the primary key.</summary>
    public int Pot { get; set; }

    /// <summary>"Would water now" weight (0 %). Null until the first complete calibration.</summary>
    public int? DryGrams { get; set; }

    /// <summary>Weight after watering and draining (100 %).</summary>
    public int? WetGrams { get; set; }

    public DateTime? CalibratedAtUtc { get; set; }

    /// <summary>Id of the running session; also the id of its calibration_start command.</summary>
    public string? SessionId { get; set; }

    /// <summary>Backend-owned step, see <see cref="CalibrationPhase"/>. Null = no session.</summary>
    public string? SessionPhase { get; set; }

    public DateTime? SessionStartedAtUtc { get; set; }

    /// <summary>Dry point captured in THIS session; becomes DryGrams only when wet is saved.</summary>
    public int? SessionDryGrams { get; set; }

    public DateTime? SessionDryAtUtc { get; set; }

    /// <summary>When the user pressed "Done watering"; the drain timer runs from here.</summary>
    public DateTime? DrainStartedAtUtc { get; set; }

    /// <summary>Why the session failed (device error code), when SessionPhase is "failed".</summary>
    public string? SessionError { get; set; }

    /// <summary>Last state the ESP32 reported for this session (warming_up, taring, …).</summary>
    public string? DeviceState { get; set; }

    public int? DeviceSecondsLeft { get; set; }

    /// <summary>Server time of the last status message for this session.</summary>
    public DateTime? DeviceStatusAtUtc { get; set; }
}

/// <summary>
/// Calibration steps owned by the backend (the ESP32 only knows measurement states).
/// Order: starting → awaiting_dry → watering → draining → (wet saved, session cleared).
/// </summary>
public static class CalibrationPhase
{
    /// <summary>calibration_start sent; the device warms up and tares.</summary>
    public const string Starting = "starting";

    /// <summary>Device is streaming; the user places the dry pot and saves the dry point.</summary>
    public const string AwaitingDry = "awaiting_dry";

    /// <summary>Dry saved; the user waters as usual, then presses "Done watering".</summary>
    public const string Watering = "watering";

    /// <summary>Drain timer running; "Save wet point" unlocks when it is over.</summary>
    public const string Draining = "draining";

    /// <summary>The device reported an error or ended the session itself. Start again or cancel.</summary>
    public const string Failed = "failed";
}
