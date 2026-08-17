# RainCheck V11.4.2

- Fixed Android widget theme synchronization. Light and dark settings now propagate from the app to the native widget, while Automatic follows the Android system night mode.
- System theme changes trigger an existing widget redraw without forcing a weather refresh.
- Kept all widget layouts free of duplicate view IDs.
- Synchronized web asset cache-busters and Android bundled assets to V11.4.2.

# RainCheck V11.4.1

- Added responsive Android home-screen widget sizing with dedicated compact, tiny, tall, wide, and full layouts.
- Supports practical widget ranges including 1x1, 1x2/1x4-style vertical sizes, 2x2, 4x1 and larger layouts through Android resizing buckets.
- Preserved V11.3.1 light/dark/automatic theme synchronization across all widget sizes.
- Preserved release metadata synchronization from `VERSION`, signed release workflow, and `Raincheck.apk` output naming.

## V11.3.1
- Synchronized the Android widget with the main app theme setting: Automatic, Light, and Dark.
- Theme changes now refresh existing widgets immediately.

# RainCheck V11.3.0

## Widget redesign
- Rebuilt the Android weather widget around a compact glance-first composition inspired by Apple Weather's information hierarchy.
- Removed the tall three-card metric stack that made the previous widget feel oversized.
- Current temperature is now the dominant element, with condition, feels-like and high/low grouped beside it.
- Rain, wind and UV are shown as a single compact footer row instead of large panels.
- Added weather-aware day/night backgrounds for clear, rain, snow and storm conditions.
- Added responsive compact/narrow behavior so smaller launcher sizes hide secondary rows rather than squeezing or stretching content.
- Lowered the widget's minimum height so the launcher can keep the widget visually tighter.
- Preserved cached data when Open-Meteo background refresh fails.

# RainCheck V11.2.0

## Widget reliability
- Fixed the JavaScript/native Capacitor bridge lookup for plain-module builds by resolving the registered `RainCheckWidget` plugin from `Capacitor.Plugins` first.
- Added explicit widget bridge diagnostics and native `getWidgetState()` support.
- Added responsive widget re-rendering when the launcher changes widget size.
- Kept the last successful weather state when a native refresh fails.
- Preserved immediate foreground sync while retaining background Open-Meteo refresh.

## Build/runtime reliability
- Unified the application version at 11.2.0.
- Removed the stale `v=11.2.0` HTML asset marker.
- Made the production build derive cache-busting from `VERSION` so web assets and Android assets cannot silently drift apart.

# RainCheck V11

## Focus
- Android 15/16-safe edge-to-edge layout handling using Capacitor SystemBars insets.
- Safer modal/settings sizing across notches, gesture navigation, display scaling and short screens.
- Adaptive performance modes: Auto, Battery Saver, Balanced and High Performance.
- Native Android home-screen weather widget with cached/offline fallback and 30-minute refresh.
- Native widget sync from the current RainCheck location/weather state.
- Theme-aware Android system bar icon styling.

## UI
The V10 visual language is preserved. V11 changes layout safety, rendering cost and native integration rather than redesigning the interface.
