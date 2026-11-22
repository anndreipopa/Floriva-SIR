using System.Text.Json;
using Licenta.API.Configuration;
using Licenta.API.Data;
using Licenta.API.DTOs;
using Licenta.API.Models;
using Licenta.API.Mqtt;
using Licenta.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Licenta.API.Services;

/// <summary>Result of a calibration action: the new state, or why the action was refused.</summary>
public sealed record CalibrationOutcome(CalibrationDto Calibration, string? Error)
{
    public bool Succeeded => Error is null;
}

/// <summary>
/// Owns the user calibration (design: docs/design/moisture-calibration.md, D3).
/// The ESP32 only measures; every calibration step lives here:
///
///   start ─► starting ─(device streams)─► awaiting_dry ─save dry─► watering
///         ─done watering─► draining ─(drain time over) save wet─► calibrated, session cleared
///
/// Endpoints call the action methods; <see cref="MqttSubscriberService"/> calls
/// <see cref="HandleStatusAsync"/> for every status message. Both change the same row, so
/// every change runs under one lock (see <see cref="_gate"/>).
/// </summary>
public sealed class CalibrationService
{
    private const int MinPot = 1;
    private const int MaxPot = 3;

    /// <summary>
    /// A dry/wet point uses the newest stable reading of the session, and only if it is at
    /// most this old. The device streams every ~4 s, so 15 s = about three readings: recent
    /// enough to be "what is on the scale now", tolerant of one or two lost messages.
    /// </summary>
    private static readonly TimeSpan PointReadingMaxAge = TimeSpan.FromSeconds(15);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IMqttPublisher _mqtt;
    private readonly MqttOptions _mqttOptions;
    private readonly ICalibrationUpdatePublisher _updatePublisher;
    private readonly TimeSpan _drainTime;
    private readonly ILogger<CalibrationService> _logger;

    /// <summary>
    /// One action at a time. Without it, a status message and a button press arriving
    /// together could both read the row, change different things, and one would overwrite the
    /// other. One robot and a few actions per session: a single lock costs nothing.
    /// </summary>
    private readonly SemaphoreSlim _gate = new(1, 1);

    public CalibrationService(
        IServiceScopeFactory scopeFactory,
        IMqttPublisher mqtt,
        MqttOptions mqttOptions,
        ICalibrationUpdatePublisher updatePublisher,
        CalibrationOptions calibrationOptions,
        ILogger<CalibrationService> logger)
    {
        _scopeFactory = scopeFactory;
        _mqtt = mqtt;
        _mqttOptions = mqttOptions;
        _updatePublisher = updatePublisher;
        _drainTime = TimeSpan.FromMinutes(calibrationOptions.DrainMinutes);
        _logger = logger;
    }

    public static bool IsValidPot(int pot) => pot is >= MinPot and <= MaxPot;

    public async Task<CalibrationDto> GetAsync(int pot, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FlorivaDbContext>();
        var entity = await db.PotCalibrations.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Pot == pot, cancellationToken);
        return entity is null ? CalibrationDto.Empty(pot) : ToDto(entity);
    }

    /// <summary>Start (or restart) a session: sends calibration_start to the robot.</summary>
    public Task<CalibrationOutcome> StartAsync(int pot, CancellationToken cancellationToken) =>
        RunAsync(pot, createIfMissing: true, cancellationToken, async (entity, _, ct) =>
        {
            // A new session replaces any old one (the device does the same on its side).
            // "N" = 32 hex digits: within the firmware's 36-character id limit, no dashes.
            var sessionId = Guid.NewGuid().ToString("N");
            if (!await SendCommandAsync(sessionId, "calibration_start", pot, ct))
            {
                return "The server is not connected to the robot's message broker. Try again in a minute.";
            }

            ClearSession(entity);
            entity.SessionId = sessionId;
            entity.SessionPhase = CalibrationPhase.Starting;
            entity.SessionStartedAtUtc = DateTime.UtcNow;
            _logger.LogInformation("Calibration session {Session} started for pot {Pot}", sessionId, pot);
            return null;
        });

    /// <summary>Save the dry point ("would water now") from the newest stable reading.</summary>
    public Task<CalibrationOutcome> SaveDryAsync(int pot, CancellationToken cancellationToken) =>
        RunAsync(pot, createIfMissing: false, cancellationToken, async (entity, db, ct) =>
        {
            if (entity.SessionPhase != CalibrationPhase.AwaitingDry)
            {
                return PhaseError(entity, "save the dry point");
            }

            var reading = await LatestStableReadingAsync(db, entity, ct);
            if (reading is null)
            {
                return NoStableReadingMessage;
            }

            entity.SessionDryGrams = reading.Grams;
            entity.SessionDryAtUtc = DateTime.UtcNow;
            entity.SessionPhase = CalibrationPhase.Watering;
            _logger.LogInformation("Pot {Pot}: dry point {Grams} g", pot, reading.Grams);
            return null;
        });

    /// <summary>The user has watered: start the drain timer.</summary>
    public Task<CalibrationOutcome> DoneWateringAsync(int pot, CancellationToken cancellationToken) =>
        RunAsync(pot, createIfMissing: false, cancellationToken, (entity, _, _) =>
        {
            if (entity.SessionPhase != CalibrationPhase.Watering)
            {
                return Task.FromResult<string?>(PhaseError(entity, "start the drain timer"));
            }

            entity.DrainStartedAtUtc = DateTime.UtcNow;
            entity.SessionPhase = CalibrationPhase.Draining;
            return Task.FromResult<string?>(null);
        });

    /// <summary>
    /// Save the wet point. This completes the calibration: dry + wet become the pot's
    /// calibration, the session is cleared and the robot is told to stop streaming.
    /// </summary>
    public Task<CalibrationOutcome> SaveWetAsync(int pot, CancellationToken cancellationToken) =>
        RunAsync(pot, createIfMissing: false, cancellationToken, async (entity, db, ct) =>
        {
            if (entity.SessionPhase != CalibrationPhase.Draining ||
                entity is not { DrainStartedAtUtc: { } drainStarted, SessionDryGrams: { } dry })
            {
                return PhaseError(entity, "save the wet point");
            }

            var drainLeft = drainStarted + _drainTime - DateTime.UtcNow;
            if (drainLeft > TimeSpan.Zero)
            {
                return $"Let it drain a little longer: {Math.Ceiling(drainLeft.TotalMinutes)} min left.";
            }

            var reading = await LatestStableReadingAsync(db, entity, ct);
            if (reading is null)
            {
                return NoStableReadingMessage;
            }

            // Wet must be heavier than dry, or the % formula divides by zero / goes negative.
            if (reading.Grams <= dry)
            {
                return $"The pot weighs {reading.Grams} g, not more than the dry point ({dry} g). " +
                       "Was it watered? Is it on the scale?";
            }

            var sessionId = entity.SessionId!;
            entity.DryGrams = dry;
            entity.WetGrams = reading.Grams;
            entity.CalibratedAtUtc = DateTime.UtcNow;
            ClearSession(entity);
            _logger.LogInformation("Pot {Pot} calibrated: dry {Dry} g, wet {Wet} g", pot, dry, reading.Grams);

            // Best effort: if this message is lost, the device ends the session itself after
            // its 90 min timeout. The calibration is already safe in the database.
            await SendEndAsync(sessionId, pot, ct);
            return null;
        });

    /// <summary>Abandon the session (or dismiss a failed one). The old calibration is kept.</summary>
    public Task<CalibrationOutcome> CancelAsync(int pot, CancellationToken cancellationToken) =>
        RunAsync(pot, createIfMissing: false, cancellationToken, async (entity, _, ct) =>
        {
            if (entity.SessionId is not { } sessionId)
            {
                return null; // nothing to cancel: not an error, the result is the same
            }

            var failed = entity.SessionPhase == CalibrationPhase.Failed;
            ClearSession(entity);
            if (!failed)
            {
                await SendEndAsync(sessionId, pot, ct);
            }
            _logger.LogInformation("Calibration session {Session} for pot {Pot} cancelled", sessionId, pot);
            return null;
        });

    /// <summary>
    /// One message from the status topic. Moves the session forward when the device starts
    /// streaming, marks it failed on a device error, and stops stray sessions on the device.
    /// </summary>
    public async Task HandleStatusAsync(string payload, CancellationToken cancellationToken)
    {
        RobotStatusMqttPayload? status;
        try
        {
            status = JsonSerializer.Deserialize<RobotStatusMqttPayload>(payload, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Malformed status payload: {Payload}", payload);
            return;
        }

        if (status is not { Pot: { } pot, State: { } state } ||
            !IsValidPot(pot) || !DeviceState.All.Contains(state) ||
            (status.Session is { } s && !WeightReadingIngestService.IsValidSessionId(s)))
        {
            _logger.LogWarning("Invalid status payload: {Payload}", payload);
            return;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<FlorivaDbContext>();
            var entity = await db.PotCalibrations.FirstOrDefaultAsync(c => c.Pot == pot, cancellationToken);

            if (status.Session is { } session)
            {
                if (entity?.SessionId != session)
                {
                    // A session the backend no longer knows (cancelled, replaced, or started
                    // before a backend restart lost track). Do not let it stream for 90 min.
                    if (state is DeviceState.WarmingUp or DeviceState.Taring or DeviceState.Streaming)
                    {
                        _logger.LogWarning("Device runs unknown session {Session}; sending calibration_end", session);
                        // Not awaited here: we are inside the MQTT receive handler, and a QoS 1
                        // publish waits for the broker's PUBACK, which the client may only process
                        // after this handler returns. Awaiting it here could deadlock.
                        _ = Task.Run(() => SendEndAsync(session, pot, CancellationToken.None));
                    }
                    return;
                }

                entity.DeviceState = state;
                entity.DeviceSecondsLeft = status.SecondsLeft;
                entity.DeviceStatusAtUtc = DateTime.UtcNow;

                if (state == DeviceState.Streaming && entity.SessionPhase == CalibrationPhase.Starting)
                {
                    entity.SessionPhase = CalibrationPhase.AwaitingDry;
                }
                else if (state == DeviceState.Error)
                {
                    entity.SessionPhase = CalibrationPhase.Failed;
                    entity.SessionError = status.Error ?? "unknown_error";
                    _logger.LogWarning("Calibration session {Session} failed on the device: {Error}",
                        session, entity.SessionError);
                }
            }
            else
            {
                // Idle with no session. If our session is still active and the device had
                // already confirmed it, the device ended it on its own (its 90 min timeout).
                if (entity is null || state != DeviceState.Idle ||
                    entity.SessionId is null || entity.SessionPhase == CalibrationPhase.Failed ||
                    entity.DeviceState is null)
                {
                    return;
                }

                entity.SessionPhase = CalibrationPhase.Failed;
                entity.SessionError = "device_ended_session";
                entity.DeviceState = state;
                entity.DeviceStatusAtUtc = DateTime.UtcNow;
                _logger.LogWarning("Device ended calibration session {Session} on its own", entity.SessionId);
            }

            await db.SaveChangesAsync(cancellationToken);
            await BroadcastAsync(ToDto(entity), cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private const string NoStableReadingMessage =
        "No stable reading in the last 15 seconds. Keep hands off the pot and try again.";

    /// <summary>
    /// Load the pot's row under the lock, run one action, save, broadcast.
    /// The action returns null on success or a user-facing message when it refuses.
    /// </summary>
    private async Task<CalibrationOutcome> RunAsync(
        int pot,
        bool createIfMissing,
        CancellationToken cancellationToken,
        Func<PotCalibration, FlorivaDbContext, CancellationToken, Task<string?>> action)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<FlorivaDbContext>();
            var entity = await db.PotCalibrations.FirstOrDefaultAsync(c => c.Pot == pot, cancellationToken);

            if (entity is null)
            {
                if (!createIfMissing)
                {
                    return new CalibrationOutcome(CalibrationDto.Empty(pot), "No calibration session is running.");
                }
                entity = new PotCalibration { Pot = pot };
                db.PotCalibrations.Add(entity);
            }

            var error = await action(entity, db, cancellationToken);
            if (error is not null)
            {
                // Refused: nothing changed, so nothing to save. Send the current state back.
                return new CalibrationOutcome(ToDto(entity), error);
            }

            await db.SaveChangesAsync(cancellationToken);
            var dto = ToDto(entity);
            await BroadcastAsync(dto, cancellationToken);
            return new CalibrationOutcome(dto, null);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<WeightReading?> LatestStableReadingAsync(
        FlorivaDbContext db,
        PotCalibration entity,
        CancellationToken cancellationToken)
    {
        var since = DateTime.UtcNow - PointReadingMaxAge;
        return await db.WeightReadings.AsNoTracking()
            .Where(r => r.Pot == entity.Pot && r.SessionId == entity.SessionId &&
                        r.Stable && r.ReceivedAtUtc >= since)
            .OrderByDescending(r => r.ReceivedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static string PhaseError(PotCalibration entity, string action) => entity.SessionPhase switch
    {
        null => $"Cannot {action}: no calibration session is running.",
        CalibrationPhase.Starting => $"Cannot {action} yet: the robot is still preparing (warm-up and tare).",
        CalibrationPhase.Failed => $"Cannot {action}: this session failed. Start again.",
        _ => $"Cannot {action} now: the session is at step \"{entity.SessionPhase}\".",
    };

    private static void ClearSession(PotCalibration entity)
    {
        entity.SessionId = null;
        entity.SessionPhase = null;
        entity.SessionStartedAtUtc = null;
        entity.SessionDryGrams = null;
        entity.SessionDryAtUtc = null;
        entity.DrainStartedAtUtc = null;
        entity.SessionError = null;
        entity.DeviceState = null;
        entity.DeviceSecondsLeft = null;
        entity.DeviceStatusAtUtc = null;
    }

    /// <summary>
    /// Publish one command on the cmd topic. Never retained: a retained command would be
    /// replayed by the broker every time the ESP32 (re)subscribes.
    /// </summary>
    private Task<bool> SendCommandAsync(string id, string type, int pot, CancellationToken cancellationToken)
    {
        var payload = JsonSerializer.Serialize(new { id, type, pot });
        return _mqtt.PublishAsync(_mqttOptions.CommandTopic, payload, retain: false, cancellationToken);
    }

    /// <summary>calibration_end needs its own fresh id: a reused id would look like a repeat.</summary>
    private async Task SendEndAsync(string sessionId, int pot, CancellationToken cancellationToken)
    {
        if (!await SendCommandAsync(Guid.NewGuid().ToString("N"), "calibration_end", pot, cancellationToken))
        {
            _logger.LogWarning("calibration_end for session {Session} not sent; the device will time out", sessionId);
        }
    }

    private CalibrationDto ToDto(PotCalibration entity) => CalibrationDto.FromEntity(entity, _drainTime);

    private async Task BroadcastAsync(CalibrationDto dto, CancellationToken cancellationToken)
    {
        try
        {
            await _updatePublisher.CalibrationUpdatedAsync(dto, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The database is the source of truth; a missed push is fixed by the next fetch.
            _logger.LogWarning(ex, "Failed to broadcast calibration update for pot {Pot}", dto.Pot);
        }
    }
}
