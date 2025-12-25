import Foundation
import CoreGraphics
import Carbon.HIToolbox

/// Injects mouse and keyboard events to a specific display
class InputInjector {

    // MARK: - Properties

    private let displayID: CGDirectDisplayID
    private var currentMousePosition: CGPoint = .zero

    // Event source for synthetic events
    private let eventSource: CGEventSource?

    // MARK: - Initialization

    init(displayID: CGDirectDisplayID) {
        self.displayID = displayID
        self.eventSource = CGEventSource(stateID: .combinedSessionState)

        // Get display bounds to set initial position
        let bounds = CGDisplayBounds(displayID)
        self.currentMousePosition = CGPoint(
            x: bounds.origin.x + bounds.width / 2,
            y: bounds.origin.y + bounds.height / 2
        )

        print("[InputInjector] Initialized for display \(displayID)")
    }

    // MARK: - Mouse Events

    /// Move mouse to position on the virtual display
    func moveMouse(to point: CGPoint) {
        let absolutePoint = translateToDisplay(point)
        currentMousePosition = absolutePoint

        guard let event = CGEvent(
            mouseEventSource: eventSource,
            mouseType: .mouseMoved,
            mouseCursorPosition: absolutePoint,
            mouseButton: .left
        ) else {
            print("[InputInjector] Failed to create mouse move event")
            return
        }

        event.post(tap: .cghidEventTap)
    }

    /// Click at position
    func click(at point: CGPoint, button: CGMouseButton = .left, clickCount: Int = 1) {
        let absolutePoint = translateToDisplay(point)
        currentMousePosition = absolutePoint

        let downType: CGEventType
        let upType: CGEventType

        switch button {
        case .left:
            downType = .leftMouseDown
            upType = .leftMouseUp
        case .right:
            downType = .rightMouseDown
            upType = .rightMouseUp
        default:
            downType = .otherMouseDown
            upType = .otherMouseUp
        }

        // Create and post mouse down
        guard let downEvent = CGEvent(
            mouseEventSource: eventSource,
            mouseType: downType,
            mouseCursorPosition: absolutePoint,
            mouseButton: button
        ) else { return }

        downEvent.setIntegerValueField(.mouseEventClickState, value: Int64(clickCount))
        downEvent.post(tap: .cghidEventTap)

        // Small delay between down and up
        usleep(50000)  // 50ms

        // Create and post mouse up
        guard let upEvent = CGEvent(
            mouseEventSource: eventSource,
            mouseType: upType,
            mouseCursorPosition: absolutePoint,
            mouseButton: button
        ) else { return }

        upEvent.setIntegerValueField(.mouseEventClickState, value: Int64(clickCount))
        upEvent.post(tap: .cghidEventTap)
    }

    /// Mouse down at position
    func mouseDown(at point: CGPoint, button: CGMouseButton = .left) {
        let absolutePoint = translateToDisplay(point)
        currentMousePosition = absolutePoint

        let eventType: CGEventType = button == .left ? .leftMouseDown : .rightMouseDown

        guard let event = CGEvent(
            mouseEventSource: eventSource,
            mouseType: eventType,
            mouseCursorPosition: absolutePoint,
            mouseButton: button
        ) else { return }

        event.post(tap: .cghidEventTap)
    }

    /// Mouse up at position
    func mouseUp(at point: CGPoint, button: CGMouseButton = .left) {
        let absolutePoint = translateToDisplay(point)
        currentMousePosition = absolutePoint

        let eventType: CGEventType = button == .left ? .leftMouseUp : .rightMouseUp

        guard let event = CGEvent(
            mouseEventSource: eventSource,
            mouseType: eventType,
            mouseCursorPosition: absolutePoint,
            mouseButton: button
        ) else { return }

        event.post(tap: .cghidEventTap)
    }

    /// Scroll at current position
    func scroll(deltaX: Int32, deltaY: Int32) {
        guard let event = CGEvent(
            scrollWheelEvent2Source: eventSource,
            units: .pixel,
            wheelCount: 2,
            wheel1: deltaY,
            wheel2: deltaX,
            wheel3: 0
        ) else { return }

        event.post(tap: .cghidEventTap)
    }

    /// Drag from one point to another
    func drag(from startPoint: CGPoint, to endPoint: CGPoint, button: CGMouseButton = .left) {
        let absoluteStart = translateToDisplay(startPoint)
        let absoluteEnd = translateToDisplay(endPoint)

        // Mouse down at start
        mouseDown(at: startPoint, button: button)
        usleep(50000)

        // Move to end (with drag event type)
        let dragType: CGEventType = button == .left ? .leftMouseDragged : .rightMouseDragged

        guard let dragEvent = CGEvent(
            mouseEventSource: eventSource,
            mouseType: dragType,
            mouseCursorPosition: absoluteEnd,
            mouseButton: button
        ) else { return }

        dragEvent.post(tap: .cghidEventTap)
        usleep(50000)

        // Mouse up at end
        mouseUp(at: endPoint, button: button)
    }

    // MARK: - Keyboard Events

    /// Press and release a key
    func keyPress(keyCode: UInt16) {
        keyDown(keyCode: keyCode)
        usleep(30000)  // 30ms
        keyUp(keyCode: keyCode)
    }

    /// Key down
    func keyDown(keyCode: UInt16) {
        guard let event = CGEvent(keyboardEventSource: eventSource, virtualKey: CGKeyCode(keyCode), keyDown: true) else {
            return
        }
        event.post(tap: .cghidEventTap)
    }

    /// Key up
    func keyUp(keyCode: UInt16) {
        guard let event = CGEvent(keyboardEventSource: eventSource, virtualKey: CGKeyCode(keyCode), keyDown: false) else {
            return
        }
        event.post(tap: .cghidEventTap)
    }

    /// Type a string of text
    func typeText(_ text: String) {
        for char in text {
            typeCharacter(char)
            usleep(20000)  // 20ms between characters
        }
    }

    /// Send a keyboard shortcut (e.g., Cmd+C)
    func shortcut(keyCode: UInt16, modifiers: CGEventFlags) {
        // Key down with modifiers
        guard let downEvent = CGEvent(keyboardEventSource: eventSource, virtualKey: CGKeyCode(keyCode), keyDown: true) else {
            return
        }
        downEvent.flags = modifiers
        downEvent.post(tap: .cghidEventTap)

        usleep(30000)

        // Key up with modifiers
        guard let upEvent = CGEvent(keyboardEventSource: eventSource, virtualKey: CGKeyCode(keyCode), keyDown: false) else {
            return
        }
        upEvent.flags = modifiers
        upEvent.post(tap: .cghidEventTap)
    }

    // MARK: - Helper Methods

    /// Translate a point relative to the virtual display to absolute screen coordinates
    private func translateToDisplay(_ point: CGPoint) -> CGPoint {
        let displayBounds = CGDisplayBounds(displayID)
        return CGPoint(
            x: displayBounds.origin.x + point.x,
            y: displayBounds.origin.y + point.y
        )
    }

    /// Type a single character
    private func typeCharacter(_ char: Character) {
        let string = String(char)

        // Use CGEvent's unicode string capability
        guard let event = CGEvent(keyboardEventSource: eventSource, virtualKey: 0, keyDown: true) else {
            return
        }

        var unicodeString = Array(string.utf16)
        event.keyboardSetUnicodeString(stringLength: unicodeString.count, unicodeString: &unicodeString)
        event.post(tap: .cghidEventTap)

        usleep(10000)

        // Key up
        guard let upEvent = CGEvent(keyboardEventSource: eventSource, virtualKey: 0, keyDown: false) else {
            return
        }
        upEvent.post(tap: .cghidEventTap)
    }
}

// MARK: - Key Code Constants

/// Common macOS key codes
struct KeyCodes {
    static let returnKey: UInt16 = 0x24
    static let tab: UInt16 = 0x30
    static let space: UInt16 = 0x31
    static let delete: UInt16 = 0x33
    static let escape: UInt16 = 0x35
    static let command: UInt16 = 0x37
    static let shift: UInt16 = 0x38
    static let capsLock: UInt16 = 0x39
    static let option: UInt16 = 0x3A
    static let control: UInt16 = 0x3B
    static let rightShift: UInt16 = 0x3C
    static let rightOption: UInt16 = 0x3D
    static let rightControl: UInt16 = 0x3E
    static let function: UInt16 = 0x3F

    static let leftArrow: UInt16 = 0x7B
    static let rightArrow: UInt16 = 0x7C
    static let downArrow: UInt16 = 0x7D
    static let upArrow: UInt16 = 0x7E

    static let f1: UInt16 = 0x7A
    static let f2: UInt16 = 0x78
    static let f3: UInt16 = 0x63
    static let f4: UInt16 = 0x76
    static let f5: UInt16 = 0x60
    static let f6: UInt16 = 0x61
    static let f7: UInt16 = 0x62
    static let f8: UInt16 = 0x64
    static let f9: UInt16 = 0x65
    static let f10: UInt16 = 0x6D
    static let f11: UInt16 = 0x67
    static let f12: UInt16 = 0x6F

    // Letters (lowercase)
    static let a: UInt16 = 0x00
    static let s: UInt16 = 0x01
    static let d: UInt16 = 0x02
    static let f: UInt16 = 0x03
    static let h: UInt16 = 0x04
    static let g: UInt16 = 0x05
    static let z: UInt16 = 0x06
    static let x: UInt16 = 0x07
    static let c: UInt16 = 0x08
    static let v: UInt16 = 0x09
    static let b: UInt16 = 0x0B
    static let q: UInt16 = 0x0C
    static let w: UInt16 = 0x0D
    static let e: UInt16 = 0x0E
    static let r: UInt16 = 0x0F
    static let y: UInt16 = 0x10
    static let t: UInt16 = 0x11
    static let o: UInt16 = 0x1F
    static let u: UInt16 = 0x20
    static let i: UInt16 = 0x22
    static let p: UInt16 = 0x23
    static let l: UInt16 = 0x25
    static let j: UInt16 = 0x26
    static let k: UInt16 = 0x28
    static let n: UInt16 = 0x2D
    static let m: UInt16 = 0x2E
}
