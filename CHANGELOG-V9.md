# RainCheck V10

## Mobile overhaul
- Added a dedicated mobile bottom navigation.
- Reworked phone spacing, typography, controls, modals, charts, history and radar controls.
- Added safe-area support and larger touch targets.
- Kept the desktop layout rhythm intact.

## Branding
- Replaced the old generic weather icon with a new RainCheck app icon.
- Updated PWA, favicon, Apple touch icon, brand mark and generated icon sizes.

## Radar UX
- Added an explanation of Play, Step and Past Radar.
- Added a radar timeline slider.
- Added a visible Past Radar badge and timestamp.
- Clarified that RainViewer frames are recent past radar, not a forward-looking precipitation forecast.

## Reliability
- Kept development serving at `http-server . -p 8000 -c-1 -o`.
- Versioned JavaScript imports and service-worker cache at 10.0.0.
- Added radar frame seeking.
- Rebuilt `dist`.
- Removed old V8.2 cache/version references from the release files.
