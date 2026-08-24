using Licenta.API.Mqtt;
using Licenta.API.Services;
using Licenta.API.Data;
using Microsoft.EntityFrameworkCore;
DotNetEnv.Env.Load();
var builder = WebApplication.CreateBuilder(args);

var mqttOptions = new MqttOptions
{
    Host = builder.Configuration["MQTT_HOST"] ?? "",
    Port = int.Parse(builder.Configuration["MQTT_PORT"] ?? "8883"),
    Username = builder.Configuration["MQTT_USERNAME"] ?? "",
    Password = builder.Configuration["MQTT_PASSWORD"] ?? "",
    Topic = builder.Configuration["MQTT_TOPIC"] ?? "",
    UseTls = bool.Parse(builder.Configuration["MQTT_USE_TLS"] ?? "true")
};

if (string.IsNullOrWhiteSpace(mqttOptions.Host) ||
    string.IsNullOrWhiteSpace(mqttOptions.Username) ||
    string.IsNullOrWhiteSpace(mqttOptions.Password) ||
    string.IsNullOrWhiteSpace(mqttOptions.Topic))
{
    throw new InvalidOperationException("MQTT configuration is incomplete.");
}

var postgresConnectionString = builder.Configuration["POSTGRES_CONNECTION_STRING"];

if (string.IsNullOrWhiteSpace(postgresConnectionString))
{
    throw new InvalidOperationException("PostgreSQL connection string is missing.");
}

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddSingleton(mqttOptions);
builder.Services.AddSingleton<SensorReadingStore>();
builder.Services.AddHostedService<MqttSubscriberService>();
builder.Services.AddDbContext<FlorivaDbContext>(options => options.UseNpgsql(postgresConnectionString));
builder.Services.AddHostedService<SensorReadingPersistenceService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.MapGet("/api/sensors/latest", (SensorReadingStore store ) =>
{
    var latest = store.GetLatest();

    return latest is null
    ? Results.NotFound("No sensor reading received yet.")
    : Results.Ok(latest);
});

app.MapGet("/api/sensors/history", async(FlorivaDbContext db, CancellationToken cancellationToken) =>
{
    var since = DateTime.UtcNow.AddHours(-24);
   var readings = await db.SensorReadings.AsNoTracking().OrderBy(reading => reading.ReceivedAtUtc >= since).Take(48).ToListAsync(cancellationToken);

   return Results.Ok(readings);
});

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
