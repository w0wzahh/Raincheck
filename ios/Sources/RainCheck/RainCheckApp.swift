import SwiftUI
import CoreLocation

@main
struct RainCheckApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear { LocationAuth.request() }
        }
    }
}

/// The webview's navigator.geolocation prompt grants location to the
/// WKWebView only — widget extensions need app-level WhenInUse auth,
/// which then offers to extend to widgets (NSWidgetWantsLocation).
@MainActor
enum LocationAuth {
    private static let manager = CLLocationManager()

    static func request() {
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
    }
}
