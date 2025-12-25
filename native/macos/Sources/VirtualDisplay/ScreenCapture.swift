import Foundation
import ScreenCaptureKit
import CoreGraphics
import AppKit
import CoreVideo

/// Captures frames from a specific display using ScreenCaptureKit
@available(macOS 12.3, *)
class ScreenCapture: NSObject, SCStreamDelegate, SCStreamOutput {

    // MARK: - Properties

    private var displayID: CGDirectDisplayID
    private var stream: SCStream?
    private var streamConfiguration: SCStreamConfiguration?
    private var contentFilter: SCContentFilter?

    private var latestFrame: Data?
    private let frameLock = NSLock()

    private var isCapturing = false
    private var frameCount: UInt64 = 0

    // Frame rate control
    private var targetFPS: Int = 15
    private var lastFrameTime: CFTimeInterval = 0
    private var minFrameInterval: CFTimeInterval

    // MARK: - Initialization

    init(displayID: CGDirectDisplayID, fps: Int = 15) async throws {
        self.displayID = displayID
        self.targetFPS = fps
        self.minFrameInterval = 1.0 / Double(fps)

        super.init()

        try await setupCapture()
    }

    // MARK: - Setup

    private func setupCapture() async throws {
        // Get shareable content
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)

        // Find our virtual display
        guard let display = content.displays.first(where: { $0.displayID == displayID }) else {
            throw ScreenCaptureError.displayNotFound
        }

        // Create content filter for this display
        contentFilter = SCContentFilter(display: display, excludingWindows: [])

        // Configure stream
        let config = SCStreamConfiguration()
        config.width = Int(CGDisplayPixelsWide(displayID))
        config.height = Int(CGDisplayPixelsHigh(displayID))
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(targetFPS))
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.showsCursor = true
        config.capturesAudio = false

        // Use lower quality for performance
        config.scalesToFit = true
        config.queueDepth = 3

        self.streamConfiguration = config

        print("[ScreenCapture] Configured for display \(displayID) at \(config.width)x\(config.height) @ \(targetFPS)fps")
    }

    // MARK: - Capture Control

    func startCapture() async throws {
        guard !isCapturing else {
            print("[ScreenCapture] Already capturing")
            return
        }

        guard let filter = contentFilter, let config = streamConfiguration else {
            throw ScreenCaptureError.notConfigured
        }

        // Create stream
        let stream = SCStream(filter: filter, configuration: config, delegate: self)

        // Add output handler
        try stream.addStreamOutput(self, type: .screen, sampleHandlerQueue: DispatchQueue.global(qos: .userInteractive))

        // Start capturing
        try await stream.startCapture()

        self.stream = stream
        self.isCapturing = true
        self.lastFrameTime = CACurrentMediaTime()

        print("[ScreenCapture] Started capturing")
    }

    func stopCapture() {
        guard isCapturing, let stream = stream else { return }

        Task {
            do {
                try await stream.stopCapture()
                print("[ScreenCapture] Stopped capturing. Total frames: \(frameCount)")
            } catch {
                print("[ScreenCapture] Error stopping: \(error)")
            }
        }

        self.stream = nil
        self.isCapturing = false
    }

    // MARK: - Frame Access

    /// Get the latest captured frame as PNG data
    func getLatestFrame() -> Data? {
        frameLock.lock()
        defer { frameLock.unlock() }
        return latestFrame
    }

    /// Get the latest frame as a CGImage
    func getLatestFrameImage() -> CGImage? {
        guard let data = getLatestFrame() else { return nil }

        guard let dataProvider = CGDataProvider(data: data as CFData),
              let image = CGImage(pngDataProviderSource: dataProvider, decode: nil, shouldInterpolate: false, intent: .defaultIntent) else {
            return nil
        }

        return image
    }

    // MARK: - SCStreamOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen else { return }

        // Rate limiting
        let now = CACurrentMediaTime()
        guard now - lastFrameTime >= minFrameInterval else { return }
        lastFrameTime = now

        // Extract image from sample buffer
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        // Convert to PNG
        if let pngData = convertToPNG(imageBuffer: imageBuffer) {
            frameLock.lock()
            latestFrame = pngData
            frameCount += 1
            frameLock.unlock()
        }
    }

    // MARK: - SCStreamDelegate

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        print("[ScreenCapture] Stream stopped with error: \(error)")
        isCapturing = false
    }

    // MARK: - Image Conversion

    private func convertToPNG(imageBuffer: CVImageBuffer) -> Data? {
        CVPixelBufferLockBaseAddress(imageBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(imageBuffer, .readOnly) }

        let width = CVPixelBufferGetWidth(imageBuffer)
        let height = CVPixelBufferGetHeight(imageBuffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(imageBuffer)

        guard let baseAddress = CVPixelBufferGetBaseAddress(imageBuffer) else {
            return nil
        }

        // Create CGImage
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)

        guard let context = CGContext(
            data: baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: colorSpace,
            bitmapInfo: bitmapInfo.rawValue
        ) else {
            return nil
        }

        guard let cgImage = context.makeImage() else {
            return nil
        }

        // Convert to PNG using NSBitmapImageRep (more efficient than Data+CGImageDestination)
        let bitmapRep = NSBitmapImageRep(cgImage: cgImage)
        return bitmapRep.representation(using: .png, properties: [.compressionFactor: 0.8])
    }

    // MARK: - Errors

    enum ScreenCaptureError: Error {
        case displayNotFound
        case notConfigured
        case captureStartFailed
    }
}

// MARK: - Fallback for older macOS

/// Fallback screen capture using CGDisplayCreateImage
class LegacyScreenCapture {
    private let displayID: CGDirectDisplayID

    init(displayID: CGDirectDisplayID) {
        self.displayID = displayID
    }

    func captureFrame() -> Data? {
        guard let image = CGDisplayCreateImage(displayID) else {
            return nil
        }

        let bitmapRep = NSBitmapImageRep(cgImage: image)
        return bitmapRep.representation(using: .png, properties: [:])
    }
}
