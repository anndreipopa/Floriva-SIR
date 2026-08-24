using Licenta.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Licenta.API.Data;

public class FlorivaDbContext : DbContext
{
    public FlorivaDbContext(DbContextOptions<FlorivaDbContext> options)
        : base(options)
    {
    }

    public DbSet<SensorReading> SensorReadings => Set<SensorReading>();
}