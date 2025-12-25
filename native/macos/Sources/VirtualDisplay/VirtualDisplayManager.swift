import Foundation
import CoreGraphics
import AppKit
import ScreenCaptureKit

/// Manages a virtual display for isolated AI workspace
@objc public class VirtualDisplayManager: NSObject {

    // MARK: - Properties

    private var virtualDisplay: CGVirtualDisplay?
    private var displayDescriptor: CGVirtualDisplayDescriptor?
    private var displaySettings: CGVirtualDisplaySettings?
    private var displayID: CGDirectDisplayID = 0

    private var screenCapture: ScreenCapture?
    private var inputInjector: InputInjector?

    private var width: Int = 1920
    private var height: Int = 1080

    private var isActive: Bool = false

    // Singleton for easy access from C bridge
    @objc public static let shared = VirtualDisplayManager()

    private override init() {
        super.init()
    }

    // MARK: - Display Management

    /// Create a virtual display with specified dimensions
    /// - Parameters:
    ///   - width: Display width in pixels (default 1920)
    ///   - height: Display height in pixels (default 1080)
    /// - Returns: The display ID if successful, 0 if failed
    @objc public func create(width: Int = 1920, height: Int = 1080) -> UInt32 {
        guard !isActive else {
            print("[VirtualDisplay] Already active, destroy first")
            return displayID
        }

        self.width = width
        self.height = height

        // Create display descriptor
        let descriptor = CGVirtualDisplayDescriptor()
        descriptor.name = "Agent Max Workspace"
        descriptor.maxPixelsWide = UInt32(width)
        descriptor.maxPixelsHigh = UInt32(height)
        descriptor.sizeInMillimeters = CGSize(width: 600, height: 340)  // ~27" display
        descriptor.productID = 0x1234
        descriptor.vendorID = 0x5678
        descriptor.serialNum = 0xABCD

        // Queue for display callbacks
        descriptor.queue = DispatchQueue.main

        self.displayDescriptor = descriptor

        // Create display settings
        let settings = CGVirtualDisplaySettings()
        settings.hiDPI = .hiDPIDisabled  // Use standard DPI for performance

        self.displaySettings = settings

        // Create the virtual display
        guard let display = CGVirtualDisplay(descriptor: descriptor) else {
            print("[VirtualDisplay] Failed to create virtual display")
            return 0
        }

        // Apply settings
        display.apply(settings)

        self.virtualDisplay = display
        self.displayID = display.displayID
        self.isActive = true

        print("[VirtualDisplay] Created virtual display with ID: \(displayID)")

        // Initialize screen capture
        Task {
            await initializeScreenCapture()
        }

        // Initialize input injector
        self.inputInjector = InputInjector(displayID: displayID)

        return displayID
    }

    /// Destroy the virtual display
    @objc public func destroy() {
        guard isActive else {
            print("[VirtualDisplay] Not active, nothing to destroy")
            return
        }

        // Stop screen capture
        screenCapture?.stopCapture()
        screenCapture = nil

        // Clear input injector
        inputInjector = nil

        // Destroy virtual display
        virtualDisplay = nil
        displayDescriptor = nil
        displaySettings = nil

        displayID = 0
        isActive = false

        print("[VirtualDisplay] Destroyed virtual display")
    }

    /// Check if workspace is active
    @objc public func getIsActive() -> Bool {
        return isActive
    }

    /// Get the display ID
    @objc public func getDisplayID() -> UInt32 {
        return displayID
    }

    // MARK: - Screen Capture

    private func initializeScreenCapture() async {
        guard isActive, displayID != 0 else { return }

        do {
            screenCapture = try await ScreenCapture(displayID: displayID)
            try await screenCapture?.startCapture()
            print("[VirtualDisplay] Screen capture initialized")
        } catch {
            print("[VirtualDisplay] Failed to initialize screen capture: \(error)")
        }
    }

    /// Capture current frame as PNG data
    /// - Returns: PNG data or nil if capture failed
    @objc public func captureFrame() -> Data? {
        return screenCapture?.getLatestFrame()
    }

    /// Capture current frame as base64 string
    /// - Returns: Base64-encoded PNG or nil
    @objc public func captureFrameBase64() -> String? {
        guard let data = captureFrame() else { return nil }
        return data.base64EncodedString()
    }

    // MARK: - Input Injection

    /// Send mouse move event
    @objc public func sendMouseMove(x: Int, y: Int) {
        inputInjector?.moveMouse(to: CGPoint(x: x, y: y))
    }

    /// Send mouse click event
    @objc public func sendMouseClick(x: Int, y: Int, button: String = "left", clickCount: Int = 1) {
        let point = CGPoint(x: x, y: y)
        let buttonType: CGMouseButton = button == "right" ? .right : .left
        inputInjector?.click(at: point, button: buttonType, clickCount: clickCount)
    }

    /// Send mouse down event
    @objc public func sendMouseDown(x: Int, y: Int, button: String = "left") {
        let point = CGPoint(x: x, y: y)
        let buttonType: CGMouseButton = button == "right" ? .right : .left
        inputInjector?.mouseDown(at: point, button: buttonType)
    }

    /// Send mouse up event
    @objc public func sendMouseUp(x: Int, y: Int, button: String = "left") {
        let point = CGPoint(x: x, y: y)
        let buttonType: CGMouseButton = button == "right" ? .right : .left
        inputInjector?.mouseUp(at: point, button: buttonType)
    }

    /// Send scroll event
    @objc public func sendScroll(deltaX: Int, deltaY: Int) {
        inputInjector?.scroll(deltaX: Int32(deltaX), deltaY: Int32(deltaY))
    }

    /// Send key press (down + up)
    @objc public func sendKeyPress(keyCode: UInt16) {
        inputInjector?.keyPress(keyCode: keyCode)
    }

    /// Send key down event
    @objc public func sendKeyDown(keyCode: UInt16) {
        inputInjector?.keyDown(keyCode: keyCode)
    }

    /// Send key up event
    @objc public func sendKeyUp(keyCode: UInt16) {
        inputInjector?.keyUp(keyCode: keyCode)
    }

    /// Type text string
    @objc public func sendText(_ text: String) {
        inputInjector?.typeText(text)
    }

    /// Send keyboard shortcut (e.g., cmd+c, cmd+v)
    @objc public func sendShortcut(modifiers: [String], keyCode: UInt16) {
        var flags: CGEventFlags = []

        for modifier in modifiers {
            switch modifier.lowercased() {
            case "cmd", "command":
                flags.insert(.maskCommand)
            case "shift":
                flags.insert(.maskShift)
            case "alt", "option":
                flags.insert(.maskAlternate)
            case "ctrl", "control":
                flags.insert(.maskControl)
            default:
                break
            }
        }

        inputInjector?.shortcut(keyCode: keyCode, modifiers: flags)
    }

    // MARK: - Window Management

    /// Move an application window to the virtual display
    @objc public func moveWindowToWorkspace(bundleIdentifier: String) -> Bool {
        guard isActive, displayID != 0 else { return false }

        // Get the running application
        guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleIdentifier).first else {
            print("[VirtualDisplay] Application not found: \(bundleIdentifier)")
            return false
        }

        // Activate the app
        app.activate(options: .activateIgnoringOtherApps)

        // Use Accessibility API to move window
        // This requires accessibility permissions
        let appElement = AXUIElementCreateApplication(app.processIdentifier)

        var windowsValue: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsValue)

        guard result == .success, let windows = windowsValue as? [AXUIElement], let window = windows.first else {
            print("[VirtualDisplay] Could not get window for app")
            return false
        }

        // Get display bounds
        let displayBounds = CGDisplayBounds(displayID)

        // Set window position to virtual display
        var position = CGPoint(x: displayBounds.origin.x + 50, y: displayBounds.origin.y + 50)
        var positionValue = AXValueCreate(.cgPoint, &position)!
        AXUIElementSetAttributeValue(window, kAXPositionAttribute as CFString, positionValue)

        print("[VirtualDisplay] Moved window to workspace")
        return true
    }

    /// Launch an application on the virtual display
    @objc public func launchAppOnWorkspace(bundleIdentifier: String) -> Bool {
        guard isActive else { return false }

        // Launch the app
        let workspace = NSWorkspace.shared

        guard let appURL = workspace.urlForApplication(withBundleIdentifier: bundleIdentifier) else {
            print("[VirtualDisplay] App not found: \(bundleIdentifier)")
            return false
        }

        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true

        workspace.openApplication(at: appURL, configuration: configuration) { [weak self] app, error in
            if let error = error {
                print("[VirtualDisplay] Failed to launch app: \(error)")
                return
            }

            // Move to workspace after launch
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                _ = self?.moveWindowToWorkspace(bundleIdentifier: bundleIdentifier)
            }
        }

        return true
    }
}
