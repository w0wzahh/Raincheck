# RainCheck V10

## Brand
- Replaced the previous RainCheck app icon artwork with the supplied RainCheck logo.
- Regenerated all regular PWA icon sizes from the supplied artwork.
- Added a padded maskable icon for adaptive mobile launcher shapes.
- Updated the favicon, Apple touch icon, header brand mark, notifications and PWA manifest.

## Mobile/PWA finishing pass
- Added explicit PWA `id`, scope, orientation and categories.
- Added a PWA shortcut for opening the weather dashboard.
- Kept a no-cache-first development workflow and versioned service-worker cache.
- Improved service-worker update behavior and removed stale RainCheck cache namespaces on activation.
- Added a service-worker `SKIP_WAITING` message hook for future update UI.

## UI
- Added a clear creator section for w0wzahh.
- Added GitHub access from the creator section and About dialog.
- Added a clearer Live Radar explanation directly beside the section heading.
- Kept the V8/V9 spacing work and responsive system intact while tightening mobile presentation.

## Reliability
- Bumped all release cache/module versions to 10.0.0.
- Updated the visible version labels and metadata.
- Rebuilt production output from the V10 source.
- Ran syntax/module smoke tests and production build checks.


### V10.0.1
- Restored the Appearance/theme button to the mobile top bar so mobile users have the same quick theme access as desktop.
- Kept the existing four-button mobile bottom navigation unchanged.
- Bumped module cache-busting to 10.0.1 for the finishing build.
