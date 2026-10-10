import SwiftUI
import WebKit
import WidgetKit

enum WebApp {
    static let scheme = "raincheck"
    static let host = "app"
    static let startURL = URL(string: "\(scheme)://\(host)/index.html")!
}

struct WebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(
            WebAssetSchemeHandler(),
            forURLScheme: WebApp.scheme
        )

        // Minimal Capacitor-compatible shim: the web app only uses
        // window.Capacitor for RainCheckWidget sync, which we forward to
        // the message handler below (shared defaults + WidgetKit reload).
        configuration.userContentController.addUserScript(WKUserScript(
            source: """
            window.Capacitor = {
                isNativePlatform: function() { return true; },
                getPlatform: function() { return 'ios'; },
                Plugins: {},
                registerPlugin: function(name) {
                    var plugin = {
                        updateWidget: function(payload) {
                            return new Promise(function(resolve) {
                                window.webkit.messageHandlers.raincheckWidget.postMessage(payload || {});
                                resolve({ updated: true });
                            });
                        }
                    };
                    window.Capacitor.Plugins[name] = plugin;
                    return plugin;
                }
            };
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController.add(context.coordinator, name: "raincheckWidget")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.keyboardDismissMode = .interactive
        webView.load(URLRequest(url: WebApp.startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "raincheckWidget",
                  let body = message.body as? [String: Any]
            else { return }

            let store = UserDefaults(suiteName: "group.com.w0wzahh.raincheck") ?? .standard
            for key in ["city", "unit", "theme"] {
                if let v = body[key] as? String { store.set(v, forKey: key) }
            }
            for key in ["lat", "lon", "temperature", "feelsLike", "high", "low",
                        "rainChance", "windSpeed", "humidity", "uvIndex", "weatherCode"] {
                if let v = body[key] as? NSNumber { store.set(v.doubleValue, forKey: key) }
            }
            if let v = body["isDay"] as? Bool { store.set(v, forKey: "isDay") }
            store.set(Date().timeIntervalSince1970 * 1000, forKey: "updatedAt")
            WidgetCenter.shared.reloadAllTimelines()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url,
                  let scheme = url.scheme?.lowercased()
            else {
                decisionHandler(.allow)
                return
            }

            // Allow anything served from the bundled web assets, plus
            // in-page navigations (hash changes, blob/data exports).
            if scheme == WebApp.scheme || scheme == "about" || scheme == "blob" || scheme == "data" {
                decisionHandler(.allow)
                return
            }

            // External links (e.g. the GitHub repo link) open in Safari.
            if scheme == "http" || scheme == "https",
               navigationAction.targetFrame?.isMainFrame == true {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }

        // Handle target="_blank" links: load in-app if it is one of ours,
        // otherwise hand off to Safari.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url {
                if url.scheme?.lowercased() == WebApp.scheme {
                    webView.load(URLRequest(url: url))
                } else if url.scheme == "http" || url.scheme == "https" {
                    UIApplication.shared.open(url)
                }
            }
            return nil
        }
    }
}

/// Serves the web app bundled in `Bundle.module/Web` over the
/// `raincheck://` scheme, so ES modules, fetch() and relative
/// asset paths behave exactly as they do on a real web server.
final class WebAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    private let rootURL: URL? = Bundle.module.url(
        forResource: "Web",
        withExtension: nil
    )

    private static let mimeTypes: [String: String] = [
        "html": "text/html",
        "js": "text/javascript",
        "mjs": "text/javascript",
        "css": "text/css",
        "json": "application/json",
        "webmanifest": "application/manifest+json",
        "svg": "image/svg+xml",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "ico": "image/x-icon",
        "txt": "text/plain",
        "xml": "application/xml",
        "map": "application/json",
        "woff": "font/woff",
        "woff2": "font/woff2",
        "ttf": "font/ttf",
        "webp": "image/webp",
        "wasm": "application/wasm",
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let rootURL, let requestURL = task.request.url else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        var path = requestURL.path
        if !path.hasPrefix("/") {
            path = "/" + path
        }
        if path.hasSuffix("/") {
            path += "index.html"
        }

        // Append each component separately: appendingPathComponent escapes
        // "/" inside a component, so a single call would break nested paths.
        let fileURL = path.dropFirst().split(separator: "/", omittingEmptySubsequences: true)
            .reduce(rootURL) { $0.appendingPathComponent(String($1)) }

        // Keep requests inside the bundled Web directory.
        let rootPath = rootURL.standardizedFileURL.path
        guard fileURL.standardizedFileURL.path.hasPrefix(rootPath + "/"),
              let data = try? Data(contentsOf: fileURL)
        else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let ext = fileURL.pathExtension.lowercased()
        let mimeType = Self.mimeTypes[ext] ?? "application/octet-stream"
        let isText = ["text/html", "text/css", "text/javascript", "application/json"]
            .contains(mimeType)
        let response = HTTPURLResponse(
            url: requestURL,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": isText ? "\(mimeType); charset=utf-8" : mimeType,
                "Content-Length": "\(data.count)",
                "Cache-Control": "no-store",
            ]
        )!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
