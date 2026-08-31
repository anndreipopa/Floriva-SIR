using Licenta.API.Mqtt;
using Licenta.API.Services;
using Licenta.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

//Loads local .env values during development. Azure supplies the same values
//through app service env variables.
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

//Fail during startup rather than running a semi-configured MQTT client
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

//The subscriber and persistence worker share one singleton in-memory reading store.
//FlorivaDbContext is scopes and must not be injected directly into hosted services
builder.Services.AddSingleton(mqttOptions);
builder.Services.AddSingleton<SensorReadingStore>();
builder.Services.AddHostedService<MqttSubscriberService>();
builder.Services.AddDbContext<FlorivaDbContext>(options => options.UseNpgsql(postgresConnectionString));
builder.Services.AddHostedService<SensorReadingPersistenceService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("Frontend");

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


//Returns the latest MQTT reading from memory. It may not exist after startup yet
app.MapGet("/api/sensors/latest", (SensorReadingStore store ) =>
{
    var latest = store.GetLatest();

    return latest is null
    ? Results.NotFound("No sensor reading received yet.")
    : Results.Ok(latest);
});

//Select the newest 48 readings from the last 24 hours then return them
//Chronologically so the frontend can plot them directly.
app.MapGet("/api/sensors/history", async(FlorivaDbContext db, CancellationToken cancellationToken) =>
{
    var since = DateTime.UtcNow.AddHours(-24);
   var readings = await db.SensorReadings
    .AsNoTracking()
    .Where(reading => reading.ReceivedAtUtc >= since)
    .OrderByDescending(reading => reading.ReceivedAtUtc)
    .Take(48)
    .OrderBy(reading => reading.ReceivedAtUtc)
    .ToListAsync(cancellationToken);

   return Results.Ok(readings);
});

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
