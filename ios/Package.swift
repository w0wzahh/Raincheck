// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "RainCheck",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "RainCheck",
            targets: ["RainCheck"]
        ),
        .library(
            name: "RainCheckWidget",
            targets: ["RainCheckWidget"]
        ),
    ],
    targets: [
        .target(
            name: "RainCheck",
            resources: [
                .copy("Web"),
            ]
        ),
        .target(
            name: "RainCheckWidget",
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "-u", "-Xlinker", "_main"]),
            ]
        ),
    ]
)
