using Licenta.API.Mqtt;
using Licenta.API.Services;
using Licenta.API.Data;
using Microsoft.EntityFrameworkCore;
using Licenta.API.Hubs;
using Licenta.API.Services.Interfaces;
using Licenta.API.Configuration;

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

var weatherOptions = new OpenWeatherMapOptions
{
    ApiKey = builder.Configuration["OPENWEATHER_API_KEY"] ?? "",
    Latitude = double.Parse(
        builder.Configuration["OPENWEATHER_LATITUDE"] ?? "0"),
    Longitude = double.Parse(
        builder.Configuration["OPENWEATHER_LONGITUDE"] ?? "0"),
    Units = builder.Configuration["OPENWEATHER_UNITS"] ?? "metric",
    BaseUrl = builder.Configuration["OPENWEATHER_BASE_URL"]
        ?? "https://api.openweathermap.org/data/2.5/"
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
builder.Services.AddSignalR();
builder.Services.AddSingleton<IEnvironmentUpdatePublisher, SignalREnvironmentUpdatePublisher>();
builder.Services.Configure<OpenWeatherMapOptions>(
    options =>
    {
        options.ApiKey = weatherOptions.ApiKey;
        options.Latitude = weatherOptions.Latitude;
        options.Longitude = weatherOptions.Longitude;
        options.Units = weatherOptions.Units;
        options.BaseUrl = weatherOptions.BaseUrl;
    });

builder.Services.AddMemoryCache();

builder.Services.AddHttpClient<
    IWeatherService,
    OpenWeatherMapService>();
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
            .AllowAnyMethod()
            .AllowCredentials();

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
app.MapHub<EnvironmentHub>("/hubs/environment");

app.MapGet(
    "/api/weather",
    async (
        IWeatherService weatherService,
        CancellationToken cancellationToken) =>
    {
        var weather = await weatherService.GetWeatherAsync(
            cancellationToken);

        return Results.Ok(weather);
    });

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