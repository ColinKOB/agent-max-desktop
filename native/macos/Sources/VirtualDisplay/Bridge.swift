import Foundation

// MARK: - C-Compatible Bridge Functions
// These functions are exposed to C/Objective-C++ for Node.js addon integration

/// Create a virtual display
/// - Parameters:
///   - width: Display width in pixels
///   - height: Display height in pixels
/// - Returns: Display ID (0 if failed)
@_cdecl("virtual_display_create")
public func virtualDisplayCreate(width: Int32, height: Int32) -> UInt32 {
    return VirtualDisplayManager.shared.create(width: Int(width), height: Int(height))
}

/// Destroy the virtual display
@_cdecl("virtual_display_destroy")
public func virtualDisplayDestroy() {
    VirtualDisplayManager.shared.destroy()
}

/// Check if workspace is active
/// - Returns: 1 if active, 0 if not
@_cdecl("virtual_display_is_active")
public func virtualDisplayIsActive() -> Int32 {
    return VirtualDisplayManager.shared.getIsActive() ? 1 : 0
}

/// Get the display ID
/// - Returns: Display ID
@_cdecl("virtual_display_get_id")
public func virtualDisplayGetID() -> UInt32 {
    return VirtualDisplayManager.shared.getDisplayID()
}

/// Capture current frame as base64 PNG
/// - Returns: Base64 string (caller must free with virtual_display_free_string)
@_cdecl("virtual_display_capture_frame")
public func virtualDisplayCaptureFrame() -> UnsafeMutablePointer<CChar>? {
    guard let base64 = VirtualDisplayManager.shared.captureFrameBase64() else {
        return nil
    }
    return strdup(base64)
}

/// Free a string returned by capture_frame
@_cdecl("virtual_display_free_string")
public func virtualDisplayFreeString(_ str: UnsafeMutablePointer<CChar>?) {
    if let str = str {
        free(str)
    }
}

// MARK: - Mouse Input

/// Move mouse to position
@_cdecl("virtual_display_mouse_move")
public func virtualDisplayMouseMove(x: Int32, y: Int32) {
    VirtualDisplayManager.shared.sendMouseMove(x: Int(x), y: Int(y))
}

/// Click at position
/// - Parameters:
///   - x: X coordinate
///   - y: Y coordinate
///   - button: 0 = left, 1 = right
///   - clickCount: Number of clicks (1 = single, 2 = double)
@_cdecl("virtual_display_mouse_click")
public func virtualDisplayMouseClick(x: Int32, y: Int32, button: Int32, clickCount: Int32) {
    let buttonStr = button == 1 ? "right" : "left"
    VirtualDisplayManager.shared.sendMouseClick(x: Int(x), y: Int(y), button: buttonStr, clickCount: Int(clickCount))
}

/// Mouse down at position
@_cdecl("virtual_display_mouse_down")
public func virtualDisplayMouseDown(x: Int32, y: Int32, button: Int32) {
    let buttonStr = button == 1 ? "right" : "left"
    VirtualDisplayManager.shared.sendMouseDown(x: Int(x), y: Int(y), button: buttonStr)
}

/// Mouse up at position
@_cdecl("virtual_display_mouse_up")
public func virtualDisplayMouseUp(x: Int32, y: Int32, button: Int32) {
    let buttonStr = button == 1 ? "right" : "left"
    VirtualDisplayManager.shared.sendMouseUp(x: Int(x), y: Int(y), button: buttonStr)
}

/// Scroll
@_cdecl("virtual_display_scroll")
public func virtualDisplayScroll(deltaX: Int32, deltaY: Int32) {
    VirtualDisplayManager.shared.sendScroll(deltaX: Int(deltaX), deltaY: Int(deltaY))
}

// MARK: - Keyboard Input

/// Press a key (down + up)
@_cdecl("virtual_display_key_press")
public func virtualDisplayKeyPress(keyCode: UInt16) {
    VirtualDisplayManager.shared.sendKeyPress(keyCode: keyCode)
}

/// Key down
@_cdecl("virtual_display_key_down")
public func virtualDisplayKeyDown(keyCode: UInt16) {
    VirtualDisplayManager.shared.sendKeyDown(keyCode: keyCode)
}

/// Key up
@_cdecl("virtual_display_key_up")
public func virtualDisplayKeyUp(keyCode: UInt16) {
    VirtualDisplayManager.shared.sendKeyUp(keyCode: keyCode)
}

/// Type text string
@_cdecl("virtual_display_type_text")
public func virtualDisplayTypeText(_ text: UnsafePointer<CChar>?) {
    guard let text = text else { return }
    let string = String(cString: text)
    VirtualDisplayManager.shared.sendText(string)
}

/// Send keyboard shortcut
/// - Parameters:
///   - modifiers: Comma-separated modifiers (e.g., "cmd,shift")
///   - keyCode: Key code to press
@_cdecl("virtual_display_shortcut")
public func virtualDisplayShortcut(_ modifiers: UnsafePointer<CChar>?, keyCode: UInt16) {
    guard let modifiers = modifiers else { return }
    let modString = String(cString: modifiers)
    let modArray = modString.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }
    VirtualDisplayManager.shared.sendShortcut(modifiers: modArray, keyCode: keyCode)
}

// MARK: - Window Management

/// Move an application window to the workspace
/// - Returns: 1 if successful, 0 if failed
@_cdecl("virtual_display_move_window")
public func virtualDisplayMoveWindow(_ bundleId: UnsafePointer<CChar>?) -> Int32 {
    guard let bundleId = bundleId else { return 0 }
    let bundleIdentifier = String(cString: bundleId)
    return VirtualDisplayManager.shared.moveWindowToWorkspace(bundleIdentifier: bundleIdentifier) ? 1 : 0
}

/// Launch an application on the workspace
/// - Returns: 1 if successful, 0 if failed
@_cdecl("virtual_display_launch_app")
public func virtualDisplayLaunchApp(_ bundleId: UnsafePointer<CChar>?) -> Int32 {
    guard let bundleId = bundleId else { return 0 }
    let bundleIdentifier = String(cString: bundleId)
    return VirtualDisplayManager.shared.launchAppOnWorkspace(bundleIdentifier: bundleIdentifier) ? 1 : 0
}
