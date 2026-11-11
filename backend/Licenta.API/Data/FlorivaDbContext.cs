using Licenta.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Licenta.API.Data;
/// <summary>
/// EFCore sessions used to query and persist data in PostgreSQL
/// </summary>
public class FlorivaDbContext : DbContext
{
    public FlorivaDbContext(DbContextOptions<FlorivaDbContext> options)
        : base(options)
    {
    }

    public DbSet<SensorReading> SensorReadings => Set<SensorReading>();
    public DbSet<WeightReading> WeightReadings => Set<WeightReading>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Every weight query filters by pot and a time range, so index exactly that.
        modelBuilder.Entity<WeightReading>()
            .HasIndex(reading => new { reading.Pot, reading.ReceivedAtUtc });
    }
}
