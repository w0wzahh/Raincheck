# RainCheck Performance Update

This update targets the reported low-end-device freeze when using the bottom navigation and opening Places/Settings.

## Changes

- Added adaptive performance detection using available CPU cores, device memory hints, and reduced-motion preference.
- Added Performance Mode settings:
  - Automatic
  - Battery saver
  - Balanced
  - Performance
  - Maximum compatibility
- Added an animation workload control (30/45/60) used by radar playback. It does not pretend to change the phone's physical display refresh rate.
- Added automatic runtime performance monitoring. If the WebView is sustaining very low frame rates, RainCheck temporarily disables expensive effects.
- Added a reduced-effects rendering layer that removes backdrop blur, reduces shadows, disables non-essential transitions, and stops decorative pulse animations.
- Reduced default mobile navigation blur from 20px to 8px.
- Reduced modal backdrop blur from 12px to 6px, with automatic removal on degraded/low-end modes.
- Made the radar/map lazy-loaded. RainViewer/OpenStreetMap work is no longer performed during the initial weather load. The map initializes when Radar is opened or when it approaches the viewport.
- Removed the expensive full `renderAll()` call when opening Places from the bottom navigation. Places now refreshes only its own list.
- Saving/removing/clearing Places also avoids rebuilding the entire weather dashboard.
- Synced the updated web build into `android/app/src/main/assets/public/`.

## Why these changes

The current app is a large single-page Capacitor/WebView application. The original Places button called the full render pipeline before showing the modal, which rebuilt many forecast cards, charts, SVGs and history elements. The map also initialized during every weather load even though it was far below the fold. Those are unnecessary bursts of work during interaction.

Android's current rendering guidance recommends minimizing overdraw and expensive rendering work, and Android's WebView guidance notes that unnecessary rendering/cache work can hurt performance. The changes above follow that approach.

## Rebuild

From the project root:

    npm run build
    npx cap sync android

Then:

    cd android
    .\gradlew.bat clean
    .\gradlew.bat :app:assembleDebug

For the release build, keep the existing local release keystore and signing configuration:

    .\gradlew.bat :app:assembleRelease

The keystore is intentionally not included in the performance-update archive.
