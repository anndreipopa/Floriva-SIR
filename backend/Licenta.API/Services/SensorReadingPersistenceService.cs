using Licenta.API.Data;
using Licenta.API.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Licenta.API.Services;
/// <summary>
/// Saves a snapshot of the latest in mem reading to PostgreSQL every 30 minutes
/// </summary>
public class SensorReadingPersistenceService : BackgroundService
{
    private readonly SensorReadingStore _store;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SensorReadingPersistenceService> _logger;

    public SensorReadingPersistenceService(SensorReadingStore store, IServiceScopeFactory scopeFactory, ILogger<SensorReadingPersistenceService> logger)
    {
        _store = store;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(
            TimeSpan.FromMinutes(30));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var latest = _store.GetLatest();
            if(latest is null)
            {
                _logger.LogInformation("No sensor reading available yet.");
                continue;
            }
            //Create a new entity because the in mem object is shared and may be replaced
            var readingToSave = new SensorReading
            {
                Temperature = latest.Temperature,
                Humidity = latest.Humidity,
                Lux = latest.Lux,
                ReceivedAtUtc = latest.ReceivedAtUtc
            };
            // Hosted services are singletons, while EFCore DbContext instances are scoped.
            //A new scope gives each persistence operation its own DbContext
            using var scope = _scopeFactory.CreateScope();

            var db = scope.ServiceProvider.GetRequiredService<FlorivaDbContext>();

            db.SensorReadings.Add(readingToSave);

            await db.SaveChangesAsync(stoppingToken);

            _logger.LogInformation("Saved sensor reading at {Timestamp}", readingToSave.ReceivedAtUtc);
        }
    }
}