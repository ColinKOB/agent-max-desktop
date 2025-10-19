# 🖥️ Agent Max Desktop Application Guide

## Overview
Agent Max Desktop is a native desktop application built with Electron, React, and our premium Liquid Glass UI. It runs as a standalone app on Mac, Windows, and Linux - just like Notion, Discord, or VS Code.

---

## 🚀 Quick Start

### Development Mode (with hot reload)
```bash
# Run the desktop app in development mode
npm run electron:dev
```
This will:
1. Start the Vite dev server
2. Launch Electron once the server is ready
3. Enable hot reload for UI changes

### Web Preview (for testing UI only)
```bash
# For quick UI testing in browser
npm run dev
```
Then open http://localhost:5173

---

## 📦 Building for Distribution

### Build for Your Current Platform
```bash
npm run electron:build
```

### Platform-Specific Builds

#### macOS
```bash
npm run electron:build:mac
```
Creates:
- `release/Agent Max-1.0.0.dmg` - Drag-and-drop installer
- `release/Agent Max-1.0.0-mac.zip` - Portable ZIP

#### Windows
```bash
npm run electron:build:win
```
Creates:
- `release/Agent Max Setup 1.0.0.exe` - NSIS installer
- `release/Agent Max-1.0.0-win.zip` - Portable ZIP

#### Linux
```bash
npm run electron:build:linux
```
Creates:
- `release/Agent Max-1.0.0.AppImage` - Universal AppImage
- `release/agent-max-desktop_1.0.0_amd64.deb` - Debian/Ubuntu package
- `release/agent-max-desktop-1.0.0.x86_64.rpm` - RedHat/Fedora package

---

## 🎯 Key Features as Desktop App

### Window Modes
- **Card Mode**: Full-featured floating window (default)
- **Pill Mode**: Compact minimal interface
- **Single Window**: Traditional app window

### Native Features
- **System Tray Integration**: Minimize to tray
- **Global Shortcuts**: Quick access with Cmd/Ctrl+Shift+M
- **Native Notifications**: System-level alerts
- **Secure Storage**: Encrypted credentials using system keychain
- **Auto Updates**: Built-in update mechanism
- **Offline Mode**: Works without internet for local features

### Desktop-Specific Benefits
- **No browser tabs**: Dedicated app experience
- **System integration**: File system access, screenshots
- **Better performance**: Native optimizations
- **Privacy**: Data stays local unless syncing
- **Always available**: Lives in your dock/taskbar

---

## 🔧 Configuration

### Electron Settings
The main Electron configuration is in `electron/main.cjs` which handles:
- Window management
- IPC communication
- System tray
- Deep linking
- Auto-updater

### Build Configuration
Build settings in `package.json`:
```json
{
  "build": {
    "appId": "com.agentmax.desktop",
    "productName": "Agent Max",
    "mac": {
      "category": "public.app-category.productivity"
    }
  }
}
```

---

## 🎨 UI/UX Features

### Liquid Glass Design
- Semi-transparent windows with blur
- Smooth animations and transitions
- Native window controls
- Draggable regions

### Desktop Integration
- **Dock/Taskbar**: App icon with badge counter
- **Context Menus**: Right-click menus
- **File Drag & Drop**: Drop files into the app
- **System Theme**: Follows OS dark/light mode

---

## 📱 Multi-Window Support

The app supports multiple windows:
1. **Main Window**: Primary interface
2. **Settings Window**: Preferences (Cmd/Ctrl+,)
3. **Floating Widgets**: Mini tools
4. **Test Dashboard**: Component testing

---

## 🔐 Security

### Code Signing (macOS)
For distribution, the app needs to be code-signed:
```bash
# Set up code signing certificate
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password

# Build with signing
npm run electron:build:mac
```

### Windows Signing
```bash
# Set up Windows certificate
export WIN_CSC_LINK=path/to/certificate.pfx
export WIN_CSC_KEY_PASSWORD=your_password

# Build with signing
npm run electron:build:win
```

---

## 🚢 Distribution

### Direct Download
1. Build the app for each platform
2. Upload to your server/CDN
3. Provide download links on your website

### App Stores
- **Mac App Store**: Requires additional configuration and Apple Developer account
- **Microsoft Store**: Requires Windows developer account
- **Snap Store** (Linux): Package as snap

### Auto Updates
The app includes auto-update functionality:
1. Build releases
2. Upload to GitHub Releases or your update server
3. App will check and download updates automatically

---

## 🧪 Testing the Desktop App

### Run Tests
```bash
# Unit tests
npm test

# E2E tests with Electron
npm run test:electron

# Visual regression tests
npm run test:screenshot
```

### Debug Mode
```bash
# Run with Chrome DevTools
DEBUG=true npm run electron:dev
```

---

## 📋 Checklist for Production

- [ ] **Icons**: Generate all icon sizes (`npm run generate:icons`)
- [ ] **Version**: Update version in package.json
- [ ] **Signing**: Set up code signing certificates
- [ ] **Testing**: Run full test suite
- [ ] **Builds**: Test on all target platforms
- [ ] **Updates**: Configure update server
- [ ] **Analytics**: Set up crash reporting (Sentry)
- [ ] **Documentation**: Update user guides

---

## 🎯 User Experience

### Installation
Users can install Agent Max Desktop by:
1. **Download** the installer for their platform
2. **Run** the installer (DMG on Mac, EXE on Windows, AppImage on Linux)
3. **Launch** from Applications/Programs folder
4. **Pin** to dock/taskbar for quick access

### First Launch
On first launch, users will see:
1. Onboarding flow
2. API key setup
3. Theme selection
4. Quick tutorial

---

## 🆘 Troubleshooting

### Common Issues

#### "App can't be opened" (macOS)
- Right-click and select "Open" to bypass Gatekeeper
- Or go to System Preferences > Security & Privacy

#### Missing dependencies
```bash
# Reinstall native deps
npm run postinstall
```

#### Build failures
```bash
# Clean and rebuild
rm -rf dist/ release/ node_modules/
npm install
npm run electron:build
```

---

## 📚 Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [Auto Update Guide](https://www.electron.build/auto-update)

---

## 🎉 Summary

Agent Max Desktop provides a premium native application experience with:
- ✅ Beautiful Liquid Glass UI
- ✅ Native desktop integration
- ✅ Cross-platform support (Mac, Windows, Linux)
- ✅ Offline capabilities
- ✅ Secure credential storage
- ✅ Auto-updates
- ✅ System tray support
- ✅ Global shortcuts

Run `npm run electron:dev` to start developing, and `npm run electron:build` to create distributable packages!
