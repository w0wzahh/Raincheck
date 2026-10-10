# RainCheck for iOS

An iOS build of RainCheck, packaged as an [xtool](https://github.com/xtool-org/xtool)
SwiftPM project. It wraps the existing PWA (`index.html`, `src/`, `styles/`,
`icons/` — bundled in `Sources/RainCheck/Web`) in a fullscreen `WKWebView`
served over a custom `raincheck://` URL scheme, so ES modules, `fetch()` and
relative asset paths work exactly as they do on the web.

All remote services the app already uses (Open-Meteo, RainViewer,
OpenStreetMap tiles, Font Awesome / Leaflet CDNs) load over the network at
runtime. Geolocation is supported via `NSLocationWhenInUseUsageDescription`
in `Support/Info.plist`.

## Layout

```
ios/
  Package.swift              SwiftPM package (library product = the app)
  xtool.yml                  bundleID, icon and Info.plist wiring
  AppIcon.png                app icon (must be PNG for xtool)
  Support/Info.plist         extra keys merged into the generated Info.plist
  Sources/RainCheck/
    RainCheckApp.swift       @main entry point
    ContentView.swift        hosts the web view
    WebView.swift            WKWebView + raincheck:// scheme handler
    Web/                     the bundled web app (copy of the PWA)
```

## Prerequisites (Windows)

xtool runs on Linux, so on Windows everything happens inside **WSL**:

1. **Install WSL** (needs admin + reboot):
   ```powershell
   wsl --install
   ```
   Then set up USB passthrough for your iPhone — see Microsoft's
   [USBIPD guide](https://learn.microsoft.com/en-us/windows/wsl/connect-usb).

2. **Inside WSL**, install the Swift 6.4 toolchain:
   <https://swift.org/install/linux>, then verify:
   ```bash
   swift --version   # Swift 6.4
   ```

3. Install `usbmuxd` so xtool can talk to the iPhone:
   ```bash
   sudo apt-get install usbmuxd libimobiledevice-utils
   ```

4. Download **Xcode.xip** (Xcode 27) from
   <https://developer.apple.com/download/all/?q=Xcode> — sign in with your
   Apple ID in a browser (a free account works).

5. Install xtool inside WSL:
   ```bash
   curl -fL \
     "https://github.com/xtool-org/xtool/releases/latest/download/xtool-$(uname -m).AppImage" \
     -o xtool
   chmod +x xtool && sudo mv xtool /usr/local/bin/
   ```

6. One-time setup — sign in and generate the iOS SDK:
   ```bash
   xtool setup
   ```
   Choose **Password** login for a free Apple ID (or API Key if you have a
   paid Developer Program membership), then give it the path to `Xcode.xip`.

## Build & install on your iPhone

```bash
cd ios        # inside WSL, e.g. /mnt/c/Users/LENOVO/Desktop/Games_&_OTHER_Misc/RainCheck-V8/ios
xtool dev
```

- First build takes a few minutes (SwiftPM builds the iOS SDK modules).
- Connect the iPhone via USB (bound to WSL via USBIPD). Accept the
  **Trust** prompt on the device, then run `xtool dev` again if it errors.
- If asked, enable **Developer Mode** on the iPhone
  (Settings → Privacy & Security → Developer Mode) and re-run.
- On first launch, trust the certificate:
  Settings → General → VPN & Device Management → your Apple ID → **Trust**.

Other useful commands: `xtool devices`, `xtool install <ipa>`,
`xtool uninstall`, `xtool launch`.

## Notes & known limitations inside the wrapper

- **Service worker / offline cache**: `sw.js` only registers on `http(s)`
  origins, so it stays inactive here; the app needs a network connection
  (as it does for live weather anyway). Its failure is handled gracefully.
- **Web notifications**: `Notification` is not exposed to `WKWebView`, so the
  notifications settings are inert. Everything is feature-detected already.
- **localStorage / saved places & history**: work normally on the custom
  scheme.
- To change the bundle ID, edit `bundleID` in `xtool.yml`. To update the
  web app, re-copy `index.html`, `manifest.json`, `sw.js`, `src/`, `styles/`
  and `icons/` into `Sources/RainCheck/Web/`.
