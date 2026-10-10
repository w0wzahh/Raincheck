import SwiftUI

struct ContentView: View {
    var body: some View {
        WebView()
            // Let the page reach the bottom unsafe area so the web app's
            // env(safe-area-inset-bottom) padding on the mobile nav applies.
            .ignoresSafeArea(.container, edges: .bottom)
            // Match the web app's theme-color (#081426) behind the web view.
            .background(Color(red: 8 / 255, green: 20 / 255, blue: 38 / 255))
    }
}
