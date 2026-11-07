# Floriva Dashboard

Web dashboard for the Floriva plant-watering robot. It shows live and historical environment data and the local weather forecast, in a light, airy interface with a Frutiger Aero-inspired look.

## Features

- **Live readings** of temperature, humidity and light, updated in real time over SignalR.
- **24-hour history chart** (Recharts) with per-metric toggles and gradient area fills.
- **Weather forecast card** with current conditions and a multi-day outlook, refreshed every 15 minutes.
- **Resilient connection handling**: automatic reconnect with back-off, re-sync after a dropped connection, and a freshness indicator.
- **Skeleton loading states** that mirror the final layout, plus explicit error and empty states.
- **Accessible by design**: semantic markup, `aria-busy` loading regions and screen-reader text.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Recharts · SignalR client · Phosphor Icons

## Design language

Soft aqua-to-mint gradient background, translucent "glass" panels with backdrop blur, rounded corners, gentle teal shadows, and a forest-green sidebar. Typography is Nunito. Colours, radii and shadows are defined as design tokens in `src/index.css` (Tailwind `@theme`).

## Project structure

```
src/
├── api/          Typed REST clients (sensor readings, weather)
├── realtime/     SignalR connection
├── hooks/        Data hooks: useEnvironmentReadings, useWeather
├── components/   AppShell, charts, metric tiles, weather card, skeletons
├── pages/        EnvironmentPage
├── types/        Shared TypeScript types
├── App.tsx       Routing
└── index.css     Design tokens and global styles
```

Data flows in one direction: typed API client or SignalR connection → hook → component. Components do not fetch data themselves.

## Getting started

Requirements: Node.js 20+ and a running Floriva backend.

```bash
cd frontend
npm install
cp .env.example .env     # then edit the value below
npm run dev
```

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the Floriva backend, e.g. `http://localhost:5000` |

No API keys are used in the browser. Third-party services such as weather are called by the backend.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and create a production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## Roadmap

- [ ] Plants page: per-plant details, moisture, manual "Water now"
- [ ] AUTO/MANUAL mode switch
- [ ] Watering history, calendar view and prediction chart
- [ ] Plant species information from the Trefle API
- [ ] Settings page and notifications

## Related

- [Project overview](../README.md)
- [Backend](../backend/README.md)
- [Firmware](../firmware/README.md)
