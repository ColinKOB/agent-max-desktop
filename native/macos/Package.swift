// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "VirtualDisplay",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "VirtualDisplay",
            type: .dynamic,
            targets: ["VirtualDisplay"]
        )
    ],
    targets: [
        .target(
            name: "VirtualDisplay",
            dependencies: [],
            path: "Sources/VirtualDisplay",
            linkerSettings: [
                .linkedFramework("CoreGraphics"),
                .linkedFramework("ScreenCaptureKit"),
                .linkedFramework("AppKit"),
                .linkedFramework("CoreVideo")
            ]
        )
    ]
)
