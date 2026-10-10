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
    var hourly: [HourlyPoint] = []
    var daily: [DailyPoint] = []
}

struct HourlyPoint: Sendable {
    var time: Date
    var temp: Double
    var code: Int
    var isDay: Bool
    var precip: Int?
}

struct DailyPoint: Sendable {
    var date: Date
    var code: Int
    var hi: Double
    var lo: Double
    var precip: Int?
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
        let now = Date()
        var e = RainCheckEntry(
            date: now, configured: true, city: "RainCheck",
            temperature: 21, feelsLike: 20, high: 24, low: 15,
            rainChance: 60, windSpeed: 12, humidity: 58,
            weatherCode: 3, isDay: true
        )
        e.hourly = (0..<8).map { (i: Int) -> HourlyPoint in
            HourlyPoint(time: now.addingTimeInterval(TimeInterval(i * 3600)),
                        temp: 21 - Double(i), code: [1, 2, 3, 61][i % 4],
                        isDay: i < 6, precip: i > 3 ? 55 : nil)
        }
        e.daily = (0..<5).map { (i: Int) -> DailyPoint in
            DailyPoint(date: now.addingTimeInterval(TimeInterval(i * 86400)),
                       code: [1, 2, 3, 61, 0][i], hi: 24 - Double(i),
                       lo: 15 - Double(i), precip: i == 3 ? 70 : nil)
        }
        return e
    }

    private func loadEntry() async -> RainCheckEntry {
        // 1. App-group store (provisioned when the entitlement is available),
        // 2. the widget's own cache written after a successful location fetch.
        if let stored = Self.storedLocation() {
            if var entry = await fetchEntry(lat: stored.lat, lon: stored.lon, city: stored.city) {
                entry = withAppSnapshot(entry)
                return entry
            }
            return cachedOrSetup()
        }

        // Prefer precise device location (matches the app's coordinates);
        // IP geolocation runs in parallel as the guaranteed fallback.
        async let ip = Self.ipLocation()
        var found: (city: String, lat: Double, lon: Double)? = nil
        if let loc = await WidgetLocation().current() {
            let city = await Self.reverseGeocode(loc) ?? "Current Location"
            found = (city, loc.coordinate.latitude, loc.coordinate.longitude)
        } else {
            found = await ip
        }
        guard let (city, lat, lon) = found else { return cachedOrSetup() }
        UserDefaults(suiteName: cacheSuite)?.set(
            ["lat": lat, "lon": lon, "city": city], forKey: "lastLocation"
        )
        if var entry = await fetchEntry(lat: lat, lon: lon, city: city) {
            entry = withAppSnapshot(entry)
            return entry
        }
        return cachedOrSetup()
    }

    /// When the containing app has synced weather into the shared store,
    /// prefer its headline values so the widget matches the app exactly.
    private func withAppSnapshot(_ entry: RainCheckEntry) -> RainCheckEntry {
        guard let d = UserDefaults(suiteName: appGroup),
              let updatedAt = d.object(forKey: "updatedAt") as? Double,
              Date().timeIntervalSince1970 * 1000 - updatedAt < 45 * 60 * 1000
        else { return entry }
        var e = entry
        if let v = (d.object(forKey: "temperature") as? NSNumber)?.doubleValue { e.temperature = v }
        if let v = (d.object(forKey: "feelsLike") as? NSNumber)?.doubleValue { e.feelsLike = v }
        if let v = (d.object(forKey: "high") as? NSNumber)?.doubleValue { e.high = v }
        if let v = (d.object(forKey: "low") as? NSNumber)?.doubleValue { e.low = v }
        if let v = (d.object(forKey: "weatherCode") as? NSNumber)?.intValue, v >= 0 { e.weatherCode = v }
        if let v = (d.object(forKey: "rainChance") as? NSNumber)?.intValue { e.rainChance = v }
        if let v = (d.object(forKey: "windSpeed") as? NSNumber)?.doubleValue { e.windSpeed = v }
        if let v = (d.object(forKey: "humidity") as? NSNumber)?.doubleValue { e.humidity = v }
        if let v = d.object(forKey: "city") as? String, !v.isEmpty { e.city = v }
        if let v = d.object(forKey: "unit") as? String { e.unit = v }
        if d.object(forKey: "isDay") != nil { e.isDay = d.bool(forKey: "isDay") }
        return e
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

    static func parseHourly(_ hourly: [String: Any]?) -> [HourlyPoint] {
        guard let hourly,
              let times = hourly["time"] as? [String],
              let temps = hourly["temperature_2m"] as? [Double?],
              let codes = hourly["weather_code"] as? [Int?]
        else { return [] }
        let isDay = hourly["is_day"] as? [Int?] ?? []
        let precip = hourly["precipitation_probability"] as? [Int?] ?? []

        var formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        formatter.locale = Locale(identifier: "en_US_POSIX")

        let now = Date()
        var points: [HourlyPoint] = []
        for (i, s) in times.enumerated() {
            guard let t = formatter.date(from: s), t >= now,
                  let temp = temps.indices.contains(i) ? temps[i] : nil,
                  let code = codes.indices.contains(i) ? codes[i] : nil
            else { continue }
            points.append(HourlyPoint(
                time: t, temp: temp, code: code,
                isDay: isDay.indices.contains(i) ? (isDay[i] ?? 1) == 1 : true,
                precip: precip.indices.contains(i) ? precip[i] ?? nil : nil
            ))
            if points.count == 8 { break }
        }
        return points
    }

    static func parseDaily(_ daily: [String: Any]) -> [DailyPoint] {
        guard let times = daily["time"] as? [String],
              let highs = daily["temperature_2m_max"] as? [Double?],
              let lows = daily["temperature_2m_min"] as? [Double?],
              let codes = daily["weather_code"] as? [Int?]
        else { return [] }
        let precip = daily["precipitation_probability_max"] as? [Int?] ?? []

        var formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")

        var points: [DailyPoint] = []
        for (i, s) in times.enumerated() {
            guard let d = formatter.date(from: s),
                  let hi = highs.indices.contains(i) ? highs[i] : nil,
                  let lo = lows.indices.contains(i) ? lows[i] : nil,
                  let code = codes.indices.contains(i) ? codes[i] : nil
            else { continue }
            points.append(DailyPoint(
                date: d, code: code, hi: hi, lo: lo,
                precip: precip.indices.contains(i) ? precip[i] ?? nil : nil
            ))
        }
        return points
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
            .init(name: "hourly",
                  value: "temperature_2m,weather_code,is_day,precipitation_probability"),
            .init(name: "daily",
                  value: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max"),
            .init(name: "temperature_unit", value: tempUnit),
            .init(name: "wind_speed_unit", value: "kmh"),
            .init(name: "forecast_days", value: "5"),
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

        var entry = RainCheckEntry(
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
        entry.hourly = Self.parseHourly(json["hourly"] as? [String: Any])
        entry.daily = Self.parseDaily(daily)

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

    func current() async -> CLLocation? {
        // Widgets can't present the auth prompt themselves — iOS asks the
        // user when the widget is added (NSWidgetWantsLocation) and the
        // containing app requests on its behalf. Just check eligibility.
        guard manager.isAuthorizedForWidgetUpdates else { return nil }
        manager.delegate = self
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

    private func requestLocation() async -> CLLocation? {
        await withCheckedContinuation { cont in
            continuation = cont
            manager.requestLocation()
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

    private static let hourFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "ha"
        return f
    }()

    private static let weekdayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE"
        return f
    }()

    private func conditionName(_ code: Int) -> String {
        switch code {
        case 0: return "Clear"
        case 1: return "Mostly Clear"
        case 2: return "Partly Cloudy"
        case 3: return "Cloudy"
        case 45, 48: return "Foggy"
        case 51...57: return "Drizzle"
        case 61...67: return "Rain"
        case 71...77: return "Snow"
        case 80...82: return "Showers"
        case 85, 86: return "Snow"
        case 95...99: return "Thunderstorm"
        default: return ""
        }
    }

    private func hourLabel(_ date: Date, isFirst: Bool) -> String {
        isFirst ? "Now" : Self.hourFormatter.string(from: date).lowercased()
    }

    private func dayLabel(_ date: Date) -> String {
        Calendar.current.isDateInToday(date)
            ? "Today"
            : Self.weekdayFormatter.string(from: date)
    }

    private var rainBadge: Int? {
        guard let r = entry.rainChance, r >= 20 else { return nil }
        return r
    }

    // MARK: - Small — city, icon, big temp, condition, H/L

    private var smallBody: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(entry.city)
                    .font(.system(.subheadline, weight: .semibold))
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .overlay(alignment: .trailing) {
                if let rain = rainBadge {
                    Label("\(rain)%", systemImage: "drop.fill")
                        .font(.caption2.bold())
                        .foregroundStyle(Color(red: 0.61, green: 0.79, blue: 1.0))
                }
            }
            if let t = entry.temperature {
                Text("\(Int(t.rounded()))°")
                    .font(.system(size: 44, weight: .medium, design: .rounded))
            }
            Spacer(minLength: 2)
            HStack(alignment: .center, spacing: 4) {
                Image(systemName: symbolName(code: entry.weatherCode, isDay: entry.isDay))
                    .font(.title3)
                Text(conditionName(entry.weatherCode))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let hi = entry.high, let lo = entry.low {
                Text("H:\(Int(hi.rounded()))°  L:\(Int(lo.rounded()))°")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }

    // MARK: - Medium — current conditions + hourly strip

    private var mediumBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(entry.city)
                        .font(.system(.subheadline, weight: .semibold))
                        .lineLimit(1)
                    if let t = entry.temperature {
                        Text("\(Int(t.rounded()))°")
                            .font(.system(size: 44, weight: .medium, design: .rounded))
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Image(systemName: symbolName(code: entry.weatherCode, isDay: entry.isDay))
                        .font(.system(size: 30))
                    Text(conditionName(entry.weatherCode))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if let hi = entry.high, let lo = entry.low {
                        Text("H:\(Int(hi.rounded()))°  L:\(Int(lo.rounded()))°")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            Spacer(minLength: 0)
            if !entry.hourly.isEmpty {
                HStack(spacing: 0) {
                    ForEach(entry.hourly.prefix(5).indices, id: \.self) { i in
                        let h = entry.hourly[i]
                        VStack(spacing: 3) {
                            Text(hourLabel(h.time, isFirst: i == 0))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Image(systemName: symbolName(code: h.code, isDay: h.isDay))
                                .font(.caption)
                            if let p = h.precip, p >= 20 {
                                Text("\(p)%")
                                    .font(.system(size: 8))
                                    .foregroundStyle(Color(red: 0.61, green: 0.79, blue: 1.0))
                            } else {
                                Text(" ")
                                    .font(.system(size: 8))
                            }
                            Text("\(Int(h.temp.rounded()))°")
                                .font(.caption.bold())
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .padding()
    }

    // MARK: - Large — header, hourly strip, daily rows with temp bars

    private var largeBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(entry.city)
                        .font(.system(.subheadline, weight: .semibold))
                        .lineLimit(1)
                    if let t = entry.temperature {
                        Text("\(Int(t.rounded()))°")
                            .font(.system(size: 56, weight: .medium, design: .rounded))
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Image(systemName: symbolName(code: entry.weatherCode, isDay: entry.isDay))
                        .font(.system(size: 40))
                    Text(conditionName(entry.weatherCode))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let rain = rainBadge {
                        Label("\(rain)%", systemImage: "drop.fill")
                            .font(.caption.bold())
                            .foregroundStyle(Color(red: 0.61, green: 0.79, blue: 1.0))
                    }
                }
            }
            if let hi = entry.high, let lo = entry.low {
                Text("H:\(Int(hi.rounded()))°  L:\(Int(lo.rounded()))°")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !entry.hourly.isEmpty {
                Divider().overlay(.white.opacity(0.15))
                HStack(spacing: 0) {
                    ForEach(entry.hourly.prefix(6).indices, id: \.self) { i in
                        let h = entry.hourly[i]
                        VStack(spacing: 4) {
                            Text(hourLabel(h.time, isFirst: i == 0))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Image(systemName: symbolName(code: h.code, isDay: h.isDay))
                                .font(.subheadline)
                            if let p = h.precip, p >= 20 {
                                Text("\(p)%")
                                    .font(.system(size: 9))
                                    .foregroundStyle(Color(red: 0.61, green: 0.79, blue: 1.0))
                            } else {
                                Text(" ")
                                    .font(.system(size: 9))
                            }
                            Text("\(Int(h.temp.rounded()))°")
                                .font(.caption.bold())
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }

            if !entry.daily.isEmpty {
                Divider().overlay(.white.opacity(0.15))
                VStack(spacing: 6) {
                    ForEach(entry.daily.prefix(5).indices, id: \.self) { i in
                        dailyRow(entry.daily[i])
                    }
                }
            }
        }
        .padding()
    }

    private var weeklyRange: ClosedRange<Double> {
        let los = entry.daily.map(\.lo)
        let his = entry.daily.map(\.hi)
        guard let minLo = los.min(), let maxHi = his.max(), maxHi > minLo else {
            return 0...1
        }
        return minLo...maxHi
    }

    private func dailyRow(_ day: DailyPoint) -> some View {
        let range = weeklyRange
        let span = max(range.upperBound - range.lowerBound, 1)
        return HStack(spacing: 8) {
            Text(dayLabel(day.date))
                .font(.caption)
                .frame(width: 44, alignment: .leading)
            Image(systemName: symbolName(code: day.code, isDay: true))
                .font(.caption)
                .frame(width: 20)
                .overlay(alignment: .bottom) {
                    if let p = day.precip, p >= 20 {
                        Text("\(p)%")
                            .font(.system(size: 7))
                            .foregroundStyle(Color(red: 0.61, green: 0.79, blue: 1.0))
                            .offset(y: 8)
                    }
                }
            Text("\(Int(day.lo.rounded()))°")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 28, alignment: .trailing)
            GeometryReader { geo in
                let w = geo.size.width
                let x0 = (day.lo - range.lowerBound) / span * w
                let x1 = (day.hi - range.lowerBound) / span * w
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.15))
                    Capsule()
                        .fill(LinearGradient(
                            colors: [Color(red: 0.36, green: 0.65, blue: 1.0),
                                     Color(red: 1.0, green: 0.65, blue: 0.3)],
                            startPoint: .leading, endPoint: .trailing
                        ))
                        .frame(width: max(x1 - x0, 6))
                        .offset(x: x0)
                }
            }
            .frame(height: 4)
            Text("\(Int(day.hi.rounded()))°")
                .font(.caption)
                .frame(width: 28, alignment: .trailing)
        }
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
