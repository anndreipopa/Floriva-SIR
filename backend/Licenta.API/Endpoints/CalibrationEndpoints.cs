using Licenta.API.DTOs;
using Licenta.API.Services;

namespace Licenta.API.Endpoints;

/// <summary>
/// REST endpoints for the user calibration session. Thin on purpose: validation of the pot
/// number here, every rule in <see cref="CalibrationService"/>.
///
///   GET  /api/calibration/{pot}            current calibration + session
///   POST /api/calibration/{pot}/start      send calibration_start to the robot
///   POST /api/calibration/{pot}/dry        save the dry point
///   POST /api/calibration/{pot}/watered    "Done watering": start the drain timer
///   POST /api/calibration/{pot}/wet        save the wet point (completes the calibration)
///   POST /api/calibration/{pot}/cancel     abandon the session (old calibration kept)
///
/// A refused action returns 409 Conflict with a message for the user and the current state.
/// No authentication yet: see docs/ai/CLEANUP.md (required before this is public).
/// </summary>
public static class CalibrationEndpoints
{
    public static IEndpointRouteBuilder MapCalibrationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/calibration/{pot:int}");

        group.MapGet("", async (int pot, CalibrationService calibration, CancellationToken ct) =>
            CalibrationService.IsValidPot(pot)
                ? Results.Ok(await calibration.GetAsync(pot, ct))
                : InvalidPot());

        MapAction(group, "/start", (service, pot, ct) => service.StartAsync(pot, ct));
        MapAction(group, "/dry", (service, pot, ct) => service.SaveDryAsync(pot, ct));
        MapAction(group, "/watered", (service, pot, ct) => service.DoneWateringAsync(pot, ct));
        MapAction(group, "/wet", (service, pot, ct) => service.SaveWetAsync(pot, ct));
        MapAction(group, "/cancel", (service, pot, ct) => service.CancelAsync(pot, ct));

        return app;
    }

    /// <summary>All five actions share the same shape: check the pot, run, map the outcome.</summary>
    private static void MapAction(
        RouteGroupBuilder group,
        string path,
        Func<CalibrationService, int, CancellationToken, Task<CalibrationOutcome>> action)
    {
        group.MapPost(path, async (int pot, CalibrationService calibration, CancellationToken ct) =>
        {
            if (!CalibrationService.IsValidPot(pot))
            {
                return InvalidPot();
            }

            var outcome = await action(calibration, pot, ct);
            return outcome.Succeeded
                ? Results.Ok(outcome.Calibration)
                : Results.Conflict(new CalibrationErrorDto(outcome.Error!, outcome.Calibration));
        });
    }

    private static IResult InvalidPot() => Results.BadRequest("pot must be 1..3");
}
