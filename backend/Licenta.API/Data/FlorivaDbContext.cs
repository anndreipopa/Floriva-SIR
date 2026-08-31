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
}