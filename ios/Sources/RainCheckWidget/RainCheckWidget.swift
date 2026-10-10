import WidgetKit
import SwiftUI
import CoreLocation

// Mirrors android/.../widget/RainCheckWidgetProvider.java — the widget is
// self-sufficient: it reads the shared app-group store when provisioned,
// otherwise falls back to its own cache and a one-shot location request,
// then fetches Open-Meteo directly on each timeline refresh.

@main
struct RainCheckWidgets: WidgetBundle {
    var body: some Widget {
        RainCheckWidget()
    }
}

struct RainCheckEntry: TimelineEntry {
    var date: Date
    var configured: Bool
    var city: String = "RainCheck"
    var temperature: Double?
    var feelsLike: Double?
    var high: Double?
    var low: Double?
    var rainChance: Int?
    var windSpeed: Double?
    var humidity: Double?
    var weatherCode: Int = -1
    var isDay: Bool = true
    var unit: String = "metric"
}

private let appGroup = "group.com.w0wzahh.raincheck"
private let cacheSuite = "RainCheckWidgetCache"

private struct SendableBox<T>: @unchecked Sendable {
    let call: (T) -> Void
    init(_ call: @escaping (T) -> Void) { self.call = call }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> RainCheckEntry {
        sampleEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (RainCheckEntry) -> Void) {
        if context.isPreview {
            completion(sampleEntry())
            return
        }
        let done = SendableBox(completion)
        Task { done.call(await timedLoad()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RainCheckEntry>) -> Void) {
        let done = SendableBox(completion)
        Task {
            let entry = await timedLoad()
            // Same cadence as Android: updatePeriodMillis=1800000 —
            // but retry in a minute when we have nothing to show, so the
            // widget self-heals once location auth lands.
            let next = Date().addingTimeInterval(entry.configured ? 30 * 60 : 60)
            done.call(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    /// WidgetKit abandons timelines that don't answer quickly — race the
    /// real load against a timeout so we always complete.
    private func timedLoad() async -> RainCheckEntry {
        await withTaskGroup(of: RainCheckEntry.self) { group in
            group.addTask { await self.loadEntry() }
            group.addTask {
                try? await Task.sleep(nanoseconds: 9_000_000_000)
                return self.cachedOrSetup()
            }
            let entry = await group.next()!
            group.cancelAll()
            return entry
        }
    }

    private func sampleEntry() -> RainCheckEntry {
        RainCheckEntry(
            date: Date(), configured: true, city: "RainCheck",
            temperature: 21, feelsLike: 20, high: 24, low: 15,
            rainChance: 60, windSpeed: 12, humidity: 58,
            weatherCode: 3, isDay: true
        )
    }

    private func loadEntry() async -> RainCheckEntry {
        // 1. App-group store (provisioned when the entitlement is available),
        // 2. the widget's own cache written after a successful location fetch.
        if let stored = Self.storedLocation() {
            if let entry = await fetchEntry(lat: stored.lat, lon: stored.lon, city: stored.city) {
                return entry
            }
            return cachedOrSetup()
        }

        // Race precise location against IP geolocation — whichever
        // resolves first wins, so a stalled auth prompt can't starve us.
        let found = await withTaskGroup(
            of: (city: String, lat: Double, lon: Double)?.self
        ) { group in
            group.addTask {
                guard let loc = await WidgetLocation().current() else { return nil }
                let city = await Self.reverseGeocode(loc) ?? "Current Location"
                return (city, loc.coordinate.latitude, loc.coordinate.longitude)
            }
            group.addTask { await Self.ipLocation() }
            var result: (city: String, lat: Double, lon: Double)? = nil
            for await r in group where r != nil { result = r; break }
            group.cancelAll()
            return result
        }
        guard let (city, lat, lon) = found else { return cachedOrSetup() }
        UserDefaults(suiteName: cacheSuite)?.set(
            ["lat": lat, "lon": lon, "city": city], forKey: "lastLocation"
        )
        if let entry = await fetchEntry(lat: lat, lon: lon, city: city) {
            return entry
        }
        return cachedOrSetup()
    }

    private func cachedOrSetup() -> RainCheckEntry {
        if let cached = Self.cachedWeather() { return cached }
        return RainCheckEntry(date: Date(), configured: false)
    }

    static func storedLocation() -> (city: String, lat: Double, lon: Double)? {
        for suite in [appGroup, cacheSuite] {
            guard let d = UserDefaults(suiteName: suite) else { continue }
            if let dict = d.dictionary(forKey: "lastLocation"),
               let lat = dict["lat"] as? Double, let lon = dict["lon"] as? Double {
                return (dict["city"] as? String ?? "Current Location", lat, lon)
            }
            let lat = d.double(forKey: "lat"), lon = d.double(forKey: "lon")
            if lat != 0, lon != 0 {
                return (d.string(forKey: "city") ?? "RainCheck", lat, lon)
            }
        }
        return nil
    }

    static func cachedWeather() -> RainCheckEntry? {
        guard let d = UserDefaults(suiteName: cacheSuite),
              let w = d.dictionary(forKey: "weather") else { return nil }
        return RainCheckEntry(
            date: Date(timeIntervalSince1970: (w["updatedAt"] as? Double ?? 0) / 1000),
            configured: true,
            city: w["city"] as? String ?? "RainCheck",
            temperature: w["temperature"] as? Double,
            feelsLike: w["feelsLike"] as? Double,
            high: w["high"] as? Double,
            low: w["low"] as? Double,
            rainChance: w["rainChance"] as? Int,
            windSpeed: w["windSpeed"] as? Double,
            humidity: w["humidity"] as? Double,
            weatherCode: w["weatherCode"] as? Int ?? -1,
            isDay: w["isDay"] as? Bool ?? true,
            unit: w["unit"] as? String ?? "metric"
        )
    }

    /// Coarse location via IP geolocation — works without any permission.
    static func ipLocation() async -> (city: String, lat: Double, lon: Double)? {
        guard let url = URL(string: "https://ipapi.co/json/") else { return nil }
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 6
        guard let (data, _) = try? await URLSession(configuration: config).data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let lat = json["latitude"] as? Double,
              let lon = json["longitude"] as? Double
        else { return nil }
        return (json["city"] as? String ?? "Current Location", lat, lon)
    }

    static func reverseGeocode(_ location: CLLocation) async -> String? {
        try? await CLGeocoder().reverseGeocodeLocation(location)
            .first?.locality
    }

    private func fetchEntry(lat: Double, lon: Double, city: String) async -> RainCheckEntry? {
        let unit = (UserDefaults(suiteName: appGroup) ?? .standard)
            .string(forKey: "unit") ?? "metric"
        let tempUnit = unit == "imperial" ? "fahrenheit" : "celsius"
        var c = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        c.queryItems = [
            .init(name: "latitude", value: String(format: "%.5f", lat)),
            .init(name: "longitude", value: String(format: "%.5f", lon)),
            .init(name: "current",
                  value: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m"),
            .init(name: "daily",
                  value: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max"),
            .init(name: "temperature_unit", value: tempUnit),
            .init(name: "wind_speed_unit", value: "kmh"),
            .init(name: "forecast_days", value: "1"),
            .init(name: "timezone", value: "auto"),
        ]
        guard let url = c.url else { return nil }
        let sessionConfig = URLSessionConfiguration.ephemeral
        sessionConfig.timeoutIntervalForRequest = 8
        sessionConfig.timeoutIntervalForResource = 8
        guard let (data, _) = try? await URLSession(configuration: sessionConfig).data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let current = json["current"] as? [String: Any]
        else { return nil }

        let daily = json["daily"] as? [String: Any] ?? [:]
        let highs = daily["temperature_2m_max"] as? [Double]
        let lows = daily["temperature_2m_min"] as? [Double]
        let rain = daily["precipitation_probability_max"] as? [Int]
        let uv = daily["uv_index_max"] as? [Double]

        let entry = RainCheckEntry(
            date: Date(), configured: true, city: city,
            temperature: current["temperature_2m"] as? Double,
            feelsLike: current["apparent_temperature"] as? Double,
            high: highs?.first, low: lows?.first,
            rainChance: rain?.first,
            windSpeed: current["wind_speed_10m"] as? Double,
            humidity: current["relative_humidity_2m"] as? Double,
            weatherCode: current["weather_code"] as? Int ?? -1,
            isDay: (current["is_day"] as? Int ?? 1) == 1,
            unit: unit
        )

        var cache: [String: Any] = [
            "city": entry.city, "weatherCode": entry.weatherCode,
            "isDay": entry.isDay, "unit": entry.unit,
            "updatedAt": Date().timeIntervalSince1970 * 1000,
        ]
        if let v = entry.temperature { cache["temperature"] = v }
        if let v = entry.feelsLike { cache["feelsLike"] = v }
        if let v = entry.high { cache["high"] = v }
        if let v = entry.low { cache["low"] = v }
        if let v = entry.rainChance { cache["rainChance"] = v }
        if let v = entry.windSpeed { cache["windSpeed"] = v }
        if let v = entry.humidity { cache["humidity"] = v }
        if let v = uv?.first { cache["uvIndex"] = v }
        UserDefaults(suiteName: cacheSuite)?.set(cache, forKey: "weather")

        return entry
    }
}

@MainActor
final class WidgetLocation: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?
    private var authContinuation: CheckedContinuation<CLAuthorizationStatus, Never>?

    func current() async -> CLLocation? {
        manager.delegate = self
        var status = manager.authorizationStatus
        if status == .notDetermined {
            status = await requestAuthorization()
        }
        guard status == .authorizedWhenInUse || status == .authorizedAlways else {
            return nil
        }
        return await withTaskGroup(of: CLLocation?.self) { group in
            group.addTask { await self.requestLocation() }
            group.addTask {
                try? await Task.sleep(nanoseconds: 8_000_000_000)
                return nil
            }
            let result = await group.next() ?? nil
            group.cancelAll()
            return result
        }
    }

    private func requestAuthorization() async -> CLAuthorizationStatus {
        await withCheckedContinuation { cont in
            authContinuation = cont
            manager.requestWhenInUseAuthorization()
            // If the prompt can't be presented (extension contexts can
            // swallow it), don't hang the timeline — treat as denied.
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                guard let self, let pending = self.authContinuation else { return }
                self.authContinuation = nil
                pending.resume(returning: .denied)
            }
        }
    }

    private func requestLocation() async -> CLLocation? {
        await withCheckedContinuation { cont in
            continuation = cont
            manager.requestLocation()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            guard let cont = authContinuation else { return }
            authContinuation = nil
            cont.resume(returning: status)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            continuation?.resume(returning: locations.last)
            continuation = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            continuation?.resume(returning: nil)
            continuation = nil
        }
    }
}

private func symbolName(code: Int, isDay: Bool) -> String {
    switch code {
    case 0: return isDay ? "sun.max.fill" : "moon.stars.fill"
    case 1, 2: return isDay ? "cloud.sun.fill" : "cloud.moon.fill"
    case 3: return "cloud.fill"
    case 45, 48: return "cloud.fog.fill"
    case 51, 53, 55, 56, 57: return "cloud.drizzle.fill"
    case 61, 63, 65, 66, 67: return "cloud.rain.fill"
    case 71, 73, 75, 77: return "cloud.snow.fill"
    case 80, 81, 82: return "cloud.heavyrain.fill"
    case 85, 86: return "cloud.snow.fill"
    case 95, 96, 99: return "cloud.bolt.rain.fill"
    default: return isDay ? "cloud.sun.fill" : "cloud.moon.fill"
    }
}

private func backgroundColors(code: Int, isDay: Bool) -> [Color] {
    switch code {
    case 95, 96, 99:
        return [Color(red: 0.08, green: 0.10, blue: 0.20), Color(red: 0.16, green: 0.18, blue: 0.30)]
    case 61...67, 80...82:
        return isDay
            ? [Color(red: 0.10, green: 0.20, blue: 0.35), Color(red: 0.05, green: 0.09, blue: 0.17)]
            : [Color(red: 0.04, green: 0.08, blue: 0.18), Color(red: 0.03, green: 0.05, blue: 0.12)]
    case 71...77, 85, 86:
        return [Color(red: 0.20, green: 0.28, blue: 0.42), Color(red: 0.09, green: 0.13, blue: 0.24)]
    case 45, 48:
        return [Color(red: 0.22, green: 0.26, blue: 0.32), Color(red: 0.11, green: 0.14, blue: 0.20)]
    case 0, 1, 2:
        return isDay
            ? [Color(red: 0.16, green: 0.33, blue: 0.55), Color(red: 0.06, green: 0.12, blue: 0.25)]
            : [Color(red: 0.10, green: 0.13, blue: 0.30), Color(red: 0.04, green: 0.05, blue: 0.15)]
    default:
        return [Color(red: 0.13, green: 0.20, blue: 0.34), Color(red: 0.06, green: 0.10, blue: 0.18)]
    }
}

struct RainCheckWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: RainCheckEntry

    private var degreeUnit: String { entry.unit == "imperial" ? "°F" : "°C" }

    var body: some View {
        if !entry.configured {
            VStack(spacing: 8) {
                Image(systemName: "cloud.sun.fill")
                    .font(.system(size: 30))
                Text("Open RainCheck to set a location")
                    .font(.caption)
                    .multilineTextAlignment(.center)
            }
            .padding()
        } else {
            switch family {
            case .systemMedium: mediumBody
            case .systemLarge: largeBody
            default: smallBody
            }
        }
    }

    private var smallBody: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: symbolName(code: entry.weatherCode, isDay: entry.isDay))
                    .font(.title2)
                Spacer()
                if let rain = entry.rainChance, rain >= 30 {
                    Label("\(rain)%", systemImage: "drop.fill")
                        .font(.caption.bold())
                        .foregroundStyle(Color(red: 0.61, green: 0.79, blue: 1.0))
                }
            }
            Spacer()
            Text(entry.city).font(.caption).lineLimit(1)
            if let t = entry.temperature {
                Text("\(Int(t.rounded()))\(degreeUnit)")
                    .font(.system(size: 34, weight: .semibold))
            }
            if let hi = entry.high, let lo = entry.low {
                Text("H:\(Int(hi.rounded()))°  L:\(Int(lo.rounded()))°")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }

    private var mediumBody: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.city).font(.caption).lineLimit(1)
                if let t = entry.temperature {
                    Text("\(Int(t.rounded()))\(degreeUnit)")
                        .font(.system(size: 42, weight: .semibold))
                }
                if let f = entry.feelsLike {
                    Text("Feels \(Int(f.rounded()))°")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                Image(systemName: symbolName(code: entry.weatherCode, isDay: entry.isDay))
                    .font(.system(size: 34))
                if let rain = entry.rainChance {
                    Label("Rain \(rain)%", systemImage: "drop.fill")
                        .font(.caption.bold())
                        .foregroundStyle(Color(red: 0.61, green: 0.79, blue: 1.0))
                }
                if let hi = entry.high, let lo = entry.low {
                    Text("H:\(Int(hi.rounded()))° L:\(Int(lo.rounded()))°")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .padding()
    }

    private var largeBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.city).font(.subheadline).lineLimit(1)
                    if let t = entry.temperature {
                        Text("\(Int(t.rounded()))\(degreeUnit)")
                            .font(.system(size: 56, weight: .semibold))
                    }
                    if let f = entry.feelsLike {
                        Text("Feels like \(Int(f.rounded()))°")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Image(systemName: symbolName(code: entry.weatherCode, isDay: entry.isDay))
                    .font(.system(size: 52))
            }
            Divider().overlay(.white.opacity(0.2))
            HStack(spacing: 0) {
                metric(icon: "drop.fill",
                       value: entry.rainChance.map { "\($0)%" } ?? "--",
                       label: "Rain")
                metric(icon: "wind",
                       value: entry.windSpeed.map { "\(Int($0.rounded()))" } ?? "--",
                       label: "km/h")
                metric(icon: "humidity.fill",
                       value: entry.humidity.map { "\(Int($0.rounded()))%" } ?? "--",
                       label: "Humidity")
                metric(icon: "thermometer.medium",
                       value: (entry.high != nil && entry.low != nil)
                           ? "\(Int(entry.high!.rounded()))/\(Int(entry.low!.rounded()))°" : "--",
                       label: "H/L")
            }
        }
        .padding()
    }

    private func metric(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.caption).foregroundStyle(Color(red: 0.61, green: 0.79, blue: 1.0))
            Text(value).font(.subheadline.bold())
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct RainCheckWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "RainCheckWidget", provider: Provider()) { entry in
            RainCheckWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    LinearGradient(
                        colors: backgroundColors(code: entry.weatherCode, isDay: entry.isDay),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
                .foregroundStyle(.white)
                .widgetURL(URL(string: "raincheck://open"))
        }
        .configurationDisplayName("RainCheck")
        .description("Current conditions and rain chance at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .contentMarginsDisabled()
    }
}
