// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "RainCheck",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        // An xtool project should contain exactly one library product,
        // representing the main app.
        .library(
            name: "RainCheck",
            targets: ["RainCheck"]
        ),
    ],
    targets: [
        .target(
            name: "RainCheck",
            resources: [
                .copy("Web"),
            ]
        ),
    ]
)
