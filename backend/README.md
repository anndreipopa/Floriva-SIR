# Floriva Backend

ASP.NET Core API (.NET 10) that receives telemetry from the Floriva robot over MQTT, stores it in PostgreSQL, serves it over REST and pushes it to connected browsers in real time with SignalR. It also proxies weather data so that no API keys reach the client.

## Features

- **MQTT ingestion**: a hosted service subscribes to the robot's topic over TLS (MQTTnet 5) and processes each reading.
- **Latest-reading store**: a thread-safe in-memory singleton serves the current value.
- **Persistence**: readings are written to PostgreSQL (Entity Framework Core + Npgsql) by a background worker, on a configurable interval.
- **Real-time push**: SignalR hub `/hubs/environment` emits `EnvironmentReadingReceived` for every new reading.
- **Weather proxy**: a background service fetches current conditions and the forecast from OpenWeatherMap and caches them.
- **CI/CD**: GitHub Actions deploys to Azure App Service on every push to `main`. Database migrations run through a separate manual workflow.

## API

| Method | Route | Description |
|---|---|---|
| GET | `/api/sensors/latest` | Most recent reading (404 until the first reading arrives) |
| GET | `/api/sensors/history` | Readings from the last 24 hours (up to 48 entries) |
| GET | `/api/weather` | Current weather and forecast |
| WS | `/hubs/environment` | SignalR hub, event `EnvironmentReadingReceived` |

## Project structure

```
backend/
├── Licenta.slnx
└── Licenta.API/
    ├── Program.cs         Composition root: DI, CORS, endpoints, hubs
    ├── Configuration/     Typed settings
    ├── Controllers/       HTTP endpoints
    ├── Data/              FlorivaDbContext (EF Core)
    ├── DTOs/              Wire-level models
    ├── Hubs/              SignalR hubs
    ├── Migrations/        EF Core migrations
    ├── Models/            Database entities
    ├── Mqtt/              MQTT client plumbing
    └── Services/          Subscriber, stores, persistence and weather services
```

## Configuration

Settings are read from environment variables. For local development, create `Licenta.API/.env` (git-ignored) using `.env.example` as a template.

| Variable | Description |
|---|---|
| `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD` | Broker connection (port 8883 for TLS) |
| `MQTT_TOPIC` | Topic to subscribe to, e.g. `floriva/floriva01/sensors` |
| `MQTT_USE_TLS` | `true` or `false` |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key |
| `OPENWEATHER_LATITUDE`, `OPENWEATHER_LONGITUDE` | Location for the forecast |
| `OPENWEATHER_UNITS` | `metric` or `imperial` |
| `OPENWEATHER_BASE_URL` | OpenWeatherMap API base URL |
| `POSTGRES_CONNECTION_STRING` | Npgsql connection string |

## Running locally

Requirements: .NET 10 SDK and a reachable PostgreSQL instance.

```bash
cd backend/Licenta.API
dotnet restore
dotnet run
```

Apply database migrations:

```bash
dotnet ef database update
```

## Deployment

- `.github/workflows/deploy-backend.yml`: builds and deploys to Azure App Service on push to `main`.
- `.github/workflows/migrate-database.yml`: applies EF Core migrations on demand.

## Roadmap

- [ ] Plant, watering-event and calibration entities
- [ ] Command channel to the robot (MQTT publish) and status ingestion
- [ ] AUTO/MANUAL mode endpoints
- [ ] Trefle API proxy for plant species data
- [ ] Drying-rate prediction service
- [ ] User authentication and per-environment CORS configuration

## Related

- [Project overview](../README.md)
- [Firmware](../firmware/README.md)
- [Frontend](../frontend/README.md)
