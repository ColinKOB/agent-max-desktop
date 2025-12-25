/**
 * Node.js Native Addon for Virtual Display
 * Bridges Swift VirtualDisplayManager to JavaScript via N-API
 */

#import <Foundation/Foundation.h>
#include <napi.h>
#include <string>

// Import Swift bridge functions
extern "C" {
    uint32_t virtual_display_create(int32_t width, int32_t height);
    void virtual_display_destroy(void);
    int32_t virtual_display_is_active(void);
    uint32_t virtual_display_get_id(void);
    char* virtual_display_capture_frame(void);
    void virtual_display_free_string(char* str);

    void virtual_display_mouse_move(int32_t x, int32_t y);
    void virtual_display_mouse_click(int32_t x, int32_t y, int32_t button, int32_t clickCount);
    void virtual_display_mouse_down(int32_t x, int32_t y, int32_t button);
    void virtual_display_mouse_up(int32_t x, int32_t y, int32_t button);
    void virtual_display_scroll(int32_t deltaX, int32_t deltaY);

    void virtual_display_key_press(uint16_t keyCode);
    void virtual_display_key_down(uint16_t keyCode);
    void virtual_display_key_up(uint16_t keyCode);
    void virtual_display_type_text(const char* text);
    void virtual_display_shortcut(const char* modifiers, uint16_t keyCode);

    int32_t virtual_display_move_window(const char* bundleId);
    int32_t virtual_display_launch_app(const char* bundleId);
}

// MARK: - Display Management

Napi::Value Create(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    int32_t width = 1920;
    int32_t height = 1080;

    if (info.Length() >= 1 && info[0].IsNumber()) {
        width = info[0].As<Napi::Number>().Int32Value();
    }
    if (info.Length() >= 2 && info[1].IsNumber()) {
        height = info[1].As<Napi::Number>().Int32Value();
    }

    uint32_t displayId = virtual_display_create(width, height);

    Napi::Object result = Napi::Object::New(env);
    result.Set("success", displayId != 0);
    result.Set("displayId", displayId);
    return result;
}

Napi::Value Destroy(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    virtual_display_destroy();
    return Napi::Boolean::New(env, true);
}

Napi::Value IsActive(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, virtual_display_is_active() != 0);
}

Napi::Value GetDisplayId(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, virtual_display_get_id());
}

// MARK: - Screen Capture

Napi::Value CaptureFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    char* base64 = virtual_display_capture_frame();
    if (base64 == nullptr) {
        return env.Null();
    }

    Napi::String result = Napi::String::New(env, base64);
    virtual_display_free_string(base64);
    return result;
}

// MARK: - Mouse Input

Napi::Value MouseMove(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected x and y coordinates").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int32_t x = info[0].As<Napi::Number>().Int32Value();
    int32_t y = info[1].As<Napi::Number>().Int32Value();

    virtual_display_mouse_move(x, y);
    return Napi::Boolean::New(env, true);
}

Napi::Value MouseClick(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected x and y coordinates").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int32_t x = info[0].As<Napi::Number>().Int32Value();
    int32_t y = info[1].As<Napi::Number>().Int32Value();
    int32_t button = 0;  // left
    int32_t clickCount = 1;

    if (info.Length() >= 3 && info[2].IsString()) {
        std::string btn = info[2].As<Napi::String>().Utf8Value();
        button = (btn == "right") ? 1 : 0;
    }
    if (info.Length() >= 4 && info[3].IsNumber()) {
        clickCount = info[3].As<Napi::Number>().Int32Value();
    }

    virtual_display_mouse_click(x, y, button, clickCount);
    return Napi::Boolean::New(env, true);
}

Napi::Value MouseDown(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected x and y coordinates").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int32_t x = info[0].As<Napi::Number>().Int32Value();
    int32_t y = info[1].As<Napi::Number>().Int32Value();
    int32_t button = 0;

    if (info.Length() >= 3 && info[2].IsString()) {
        std::string btn = info[2].As<Napi::String>().Utf8Value();
        button = (btn == "right") ? 1 : 0;
    }

    virtual_display_mouse_down(x, y, button);
    return Napi::Boolean::New(env, true);
}

Napi::Value MouseUp(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected x and y coordinates").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    int32_t x = info[0].As<Napi::Number>().Int32Value();
    int32_t y = info[1].As<Napi::Number>().Int32Value();
    int32_t button = 0;

    if (info.Length() >= 3 && info[2].IsString()) {
        std::string btn = info[2].As<Napi::String>().Utf8Value();
        button = (btn == "right") ? 1 : 0;
    }

    virtual_display_mouse_up(x, y, button);
    return Napi::Boolean::New(env, true);
}

Napi::Value Scroll(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    int32_t deltaX = 0;
    int32_t deltaY = 0;

    if (info.Length() >= 1 && info[0].IsNumber()) {
        deltaY = info[0].As<Napi::Number>().Int32Value();
    }
    if (info.Length() >= 2 && info[1].IsNumber()) {
        deltaX = info[1].As<Napi::Number>().Int32Value();
    }

    virtual_display_scroll(deltaX, deltaY);
    return Napi::Boolean::New(env, true);
}

// MARK: - Keyboard Input

Napi::Value KeyPress(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected keyCode").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uint16_t keyCode = info[0].As<Napi::Number>().Uint32Value() & 0xFFFF;
    virtual_display_key_press(keyCode);
    return Napi::Boolean::New(env, true);
}

Napi::Value KeyDown(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected keyCode").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uint16_t keyCode = info[0].As<Napi::Number>().Uint32Value() & 0xFFFF;
    virtual_display_key_down(keyCode);
    return Napi::Boolean::New(env, true);
}

Napi::Value KeyUp(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected keyCode").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    uint16_t keyCode = info[0].As<Napi::Number>().Uint32Value() & 0xFFFF;
    virtual_display_key_up(keyCode);
    return Napi::Boolean::New(env, true);
}

Napi::Value TypeText(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected text string").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string text = info[0].As<Napi::String>().Utf8Value();
    virtual_display_type_text(text.c_str());
    return Napi::Boolean::New(env, true);
}

Napi::Value Shortcut(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected modifiers array and keyCode").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    // Build modifiers string from array
    std::string modifiers;
    if (info[0].IsArray()) {
        Napi::Array modArray = info[0].As<Napi::Array>();
        for (uint32_t i = 0; i < modArray.Length(); i++) {
            if (i > 0) modifiers += ",";
            modifiers += modArray.Get(i).As<Napi::String>().Utf8Value();
        }
    } else if (info[0].IsString()) {
        modifiers = info[0].As<Napi::String>().Utf8Value();
    }

    uint16_t keyCode = info[1].As<Napi::Number>().Uint32Value() & 0xFFFF;

    virtual_display_shortcut(modifiers.c_str(), keyCode);
    return Napi::Boolean::New(env, true);
}

// MARK: - Window Management

Napi::Value MoveWindow(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected bundle identifier").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string bundleId = info[0].As<Napi::String>().Utf8Value();
    int32_t result = virtual_display_move_window(bundleId.c_str());
    return Napi::Boolean::New(env, result != 0);
}

Napi::Value LaunchApp(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected bundle identifier").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string bundleId = info[0].As<Napi::String>().Utf8Value();
    int32_t result = virtual_display_launch_app(bundleId.c_str());
    return Napi::Boolean::New(env, result != 0);
}

// MARK: - Module Initialization

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // Display management
    exports.Set("create", Napi::Function::New(env, Create));
    exports.Set("destroy", Napi::Function::New(env, Destroy));
    exports.Set("isActive", Napi::Function::New(env, IsActive));
    exports.Set("getDisplayId", Napi::Function::New(env, GetDisplayId));

    // Screen capture
    exports.Set("captureFrame", Napi::Function::New(env, CaptureFrame));

    // Mouse input
    exports.Set("mouseMove", Napi::Function::New(env, MouseMove));
    exports.Set("mouseClick", Napi::Function::New(env, MouseClick));
    exports.Set("mouseDown", Napi::Function::New(env, MouseDown));
    exports.Set("mouseUp", Napi::Function::New(env, MouseUp));
    exports.Set("scroll", Napi::Function::New(env, Scroll));

    // Keyboard input
    exports.Set("keyPress", Napi::Function::New(env, KeyPress));
    exports.Set("keyDown", Napi::Function::New(env, KeyDown));
    exports.Set("keyUp", Napi::Function::New(env, KeyUp));
    exports.Set("typeText", Napi::Function::New(env, TypeText));
    exports.Set("shortcut", Napi::Function::New(env, Shortcut));

    // Window management
    exports.Set("moveWindow", Napi::Function::New(env, MoveWindow));
    exports.Set("launchApp", Napi::Function::New(env, LaunchApp));

    return exports;
}

NODE_API_MODULE(virtual_display, Init)
