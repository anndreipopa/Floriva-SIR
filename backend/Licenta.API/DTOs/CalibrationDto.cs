using Licenta.API.Models;

namespace Licenta.API.DTOs;

/// <summary>
/// Calibration of one pot as sent to the dashboard (REST and the SignalR
/// "CalibrationUpdated" event). <c>Session</c> is null when no session is running.
/// </summary>
public sealed record CalibrationDto(
    int Pot,
    int? DryGrams,
    int? WetGrams,
    DateTime? CalibratedAtUtc,
    CalibrationSessionDto? Session)
{
    /// <summary>A pot that has never been calibrated (no row yet).</summary>
    public static CalibrationDto Empty(int pot) => new(pot, null, null, null, null);

    public static CalibrationDto FromEntity(PotCalibration entity, TimeSpan drainTime) => new(
        entity.Pot,
        entity.DryGrams,
        entity.WetGrams,
        entity.CalibratedAtUtc,
        entity is { SessionId: { } id, SessionPhase: { } phase, SessionStartedAtUtc: { } started }
            ? new CalibrationSessionDto(
                id,
                phase,
                started,
                entity.SessionDryGrams,
                entity.SessionDryAtUtc,
                entity.DrainStartedAtUtc,
                entity.DrainStartedAtUtc + drainTime,
                entity.SessionError,
                entity.DeviceState,
                entity.DeviceSecondsLeft,
                entity.DeviceStatusAtUtc)
            : null);
}

/// <summary>The session in progress. <c>DrainEndsAtUtc</c> is when "Save wet point" unlocks.</summary>
public sealed record CalibrationSessionDto(
    string Id,
    string Phase,
    DateTime StartedAtUtc,
    int? DryGrams,
    DateTime? DryCapturedAtUtc,
    DateTime? DrainStartedAtUtc,
    DateTime? DrainEndsAtUtc,
    string? Error,
    string? DeviceState,
    int? DeviceSecondsLeft,
    DateTime? DeviceStatusAtUtc);

/// <summary>Body of a refused calibration request: why, plus the current state to re-render.</summary>
public sealed record CalibrationErrorDto(string Message, CalibrationDto Calibration);
