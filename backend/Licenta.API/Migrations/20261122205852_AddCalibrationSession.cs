using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Licenta.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCalibrationSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SessionId",
                table: "WeightReadings",
                type: "character varying(36)",
                maxLength: 36,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PotCalibrations",
                columns: table => new
                {
                    Pot = table.Column<int>(type: "integer", nullable: false),
                    DryGrams = table.Column<int>(type: "integer", nullable: true),
                    WetGrams = table.Column<int>(type: "integer", nullable: true),
                    CalibratedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SessionId = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: true),
                    SessionPhase = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SessionStartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SessionDryGrams = table.Column<int>(type: "integer", nullable: true),
                    SessionDryAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DrainStartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SessionError = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    DeviceState = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    DeviceSecondsLeft = table.Column<int>(type: "integer", nullable: true),
                    DeviceStatusAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PotCalibrations", x => x.Pot);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WeightReadings_SessionId",
                table: "WeightReadings",
                column: "SessionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PotCalibrations");

            migrationBuilder.DropIndex(
                name: "IX_WeightReadings_SessionId",
                table: "WeightReadings");

            migrationBuilder.DropColumn(
                name: "SessionId",
                table: "WeightReadings");
        }
    }
}
