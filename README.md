# RainCheck V10

RainCheck is a responsive weather PWA built around one idea: **weather should help you make decisions, not just display numbers.**

It combines Open-Meteo forecasts, RainViewer radar, OpenStreetMap/Leaflet mapping, local history, planning tools, weather intelligence, saved places, notifications and an installable PWA interface.

## V10 highlights

- Responsive desktop and mobile dashboard with a consistent spacing system
- Mobile bottom navigation and touch-friendly controls
- Rain chance, hourly forecast, 10-day forecast and daily timeline
- Weather intelligence, alerts and activity recommendations
- Wind compass and air-quality panel
- Local observations and 7-day historical view
- Travel/commute planner and future-time scheduling
- RainViewer recent-past radar with Play, Step and timeline controls
- Clear radar explanation so users understand what the animation represents
- Saved places and side-by-side weather comparison
- PWA install support, offline fallback and versioned service-worker cache
- Exact RainCheck brand artwork supplied for the V10 app/PWA icons
- Maskable Android icon for adaptive launcher shapes
- Creator attribution for **w0wzahh** with a link to the project repository

## Tech

- Vanilla JavaScript modules
- HTML + CSS
- Open-Meteo
- RainViewer
- Leaflet + OpenStreetMap
- Font Awesome
- Service Worker / Web App Manifest

## Local development

Use the included no-cache server so browser caching does not hide development changes:

```powershell
npm run serve
```

This runs the project on port `8000` with `-c-1`.

For the production build:

```powershell
npm run build
npm start
```

## Checks

The release test command performs JavaScript syntax checks and imports the UI renderer as a module smoke test:

```powershell
npm test
```

## PWA notes

The manifest defines an explicit app `id`, scope, standalone display mode, regular icons and a maskable icon. The service worker uses a V10 cache namespace and fetches HTML/JS/CSS with `cache: no-store` first, using the cache only as an offline fallback.

## Credits

Created by **w0wzahh**.

Weather data: Open-Meteo  
Radar: RainViewer  
Base map: OpenStreetMap contributors  
Map library: Leaflet

Repository: https://github.com/w0wzahh/Raincheck

## License

MIT
