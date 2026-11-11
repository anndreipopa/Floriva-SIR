using Licenta.API.Data;
using Licenta.API.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Licenta.API.Endpoints;

/// <summary>
/// REST endpoints for load-cell weighings. Mapped from Program.cs with MapWeightEndpoints().
/// </summary>
public static class WeightEndpoints
{
    private const int MinPot = 1;
    private const int MaxPot = 3;

    /// <summary>Default history window: two days, the planned length of the drift test.</summary>
    private const int DefaultHistoryHours = 48;

    /// <summary>
    /// Upper bound so one request cannot pull the whole table. At one reading every
    /// 5 minutes, 7 days is ~2000 rows.
    /// </summary>
    private const int MaxHistoryHours = 24 * 7;

    public static IEndpointRouteBuilder MapWeightEndpoints(this IEndpointRouteBuilder app)
    {
        // Newest stored weighing for one pot; 404 until the first one arrives.
        app.MapGet("/api/weight/latest", async (
            FlorivaDbContext db,
            CancellationToken cancellationToken,
            int pot = 1) =>
        {
            if (pot is < MinPot or > MaxPot)
            {
                return Results.BadRequest($"pot must be {MinPot}..{MaxPot}");
            }

            var latest = await db.WeightReadings
                .AsNoTracking()
                .Where(reading => reading.Pot == pot)
                .OrderByDescending(reading => reading.ReceivedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            return latest is null
                ? Results.NotFound("No weight reading received yet.")
                : Results.Ok(WeightReadingDto.FromEntity(latest));
        });

        // Every weighing of one pot in the last `hours` hours, oldest first (ready to plot).
        app.MapGet("/api/weight/history", async (
            FlorivaDbContext db,
            CancellationToken cancellationToken,
            int pot = 1,
            int hours = DefaultHistoryHours) =>
        {
            if (pot is < MinPot or > MaxPot)
            {
                return Results.BadRequest($"pot must be {MinPot}..{MaxPot}");
            }

            var window = Math.Clamp(hours, 1, MaxHistoryHours);
            var since = DateTime.UtcNow.AddHours(-window);

            var readings = await db.WeightReadings
                .AsNoTracking()
                .Where(reading => reading.Pot == pot && reading.ReceivedAtUtc >= since)
                .OrderBy(reading => reading.ReceivedAtUtc)
                .ToListAsync(cancellationToken);

            return Results.Ok(readings.Select(WeightReadingDto.FromEntity));
        });

        return app;
    }
}
