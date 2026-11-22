using Licenta.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Licenta.API.Data;
/// <summary>
/// EFCore sessions used to query and persist data in PostgreSQL
/// </summary>
public class FlorivaDbContext : DbContext
{
    /// <summary>Same limit as APP_MQTT_CMD_ID_MAX_LEN in the firmware (a GUID as text).</summary>
    public const int SessionIdMaxLength = 36;

    public FlorivaDbContext(DbContextOptions<FlorivaDbContext> options)
        : base(options)
    {
    }

    public DbSet<SensorReading> SensorReadings => Set<SensorReading>();
    public DbSet<WeightReading> WeightReadings => Set<WeightReading>();
    public DbSet<PotCalibration> PotCalibrations => Set<PotCalibration>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Every weight query filters by pot and a time range, so index exactly that.
        modelBuilder.Entity<WeightReading>()
            .HasIndex(reading => new { reading.Pot, reading.ReceivedAtUtc });

        // Saving a dry/wet point looks up the newest reading of one session.
        modelBuilder.Entity<WeightReading>()
            .HasIndex(reading => reading.SessionId);

        modelBuilder.Entity<WeightReading>()
            .Property(reading => reading.SessionId)
            .HasMaxLength(SessionIdMaxLength);

        modelBuilder.Entity<PotCalibration>(entity =>
        {
            // The pot number IS the identity (one row per slot), not a generated number.
            entity.HasKey(calibration => calibration.Pot);
            entity.Property(calibration => calibration.Pot).ValueGeneratedNever();
            entity.Property(calibration => calibration.SessionId).HasMaxLength(SessionIdMaxLength);
            entity.Property(calibration => calibration.SessionPhase).HasMaxLength(20);
            entity.Property(calibration => calibration.SessionError).HasMaxLength(64);
            entity.Property(calibration => calibration.DeviceState).HasMaxLength(20);
        });
    }
}
