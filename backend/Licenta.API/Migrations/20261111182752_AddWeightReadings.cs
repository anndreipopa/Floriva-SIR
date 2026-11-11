using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Licenta.API.Migrations
{
    /// <inheritdoc />
    public partial class AddWeightReadings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WeightReadings",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ReceivedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Pot = table.Column<int>(type: "integer", nullable: false),
                    Grams = table.Column<int>(type: "integer", nullable: false),
                    Raw = table.Column<int>(type: "integer", nullable: false),
                    SpreadRaw = table.Column<int>(type: "integer", nullable: false),
                    Stable = table.Column<bool>(type: "boolean", nullable: false),
                    DeviceUptimeSeconds = table.Column<long>(type: "bigint", nullable: false),
                    AmbientTemperatureC = table.Column<float>(type: "real", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WeightReadings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WeightReadings_Pot_ReceivedAtUtc",
                table: "WeightReadings",
                columns: new[] { "Pot", "ReceivedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WeightReadings");
        }
    }
}
