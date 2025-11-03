# 📦 Agent Max Distribution Guide

## Building Installers for Users

### Quick Start

```bash
# Build for macOS (DMG + ZIP)
npm run electron:build:mac

# Build for Windows (NSIS installer + portable)
npm run electron:build:win

# Build for Linux (AppImage + DEB)
npm run electron:build:linux

# Build for all platforms
npm run electron:build
```

### Output Location

Built installers will be in: `release/` directory

**macOS:**
- `Agent Max-1.0.0.dmg` - Drag-to-install DMG
- `Agent Max-1.0.0-mac.zip` - Portable ZIP

**Windows:**
- `Agent Max Setup 1.0.0.exe` - NSIS installer
- `Agent Max 1.0.0.exe` - Portable executable

**Linux:**
- `Agent Max-1.0.0.AppImage` - Universal Linux app
- `agent-max-desktop_1.0.0_amd64.deb` - Debian package

---

## Pre-Build Checklist

### 1. Create App Icons

You need icons in `build/` folder:
- `build/icon.icns` - macOS (512x512 PNG → ICNS)
- `build/icon.ico` - Windows (256x256 PNG → ICO)
- `build/icon.png` - Linux (512x512 PNG)

**Quick icon generation:**
```bash
# If you have a 1024x1024 PNG logo:
npm run generate:icons
# Or manually convert with online tools
```

### 2. Update Version & Info

Edit `package.json`:
```json
{
  "name": "agent-max-desktop",
  "version": "1.0.0",  // Increment for each release
  "description": "AI-powered desktop assistant",
  "author": "Your Name",
  "homepage": "https://agentmax.app"
}
```

### 3. Code Signing (Optional but Recommended)

**macOS:**
```bash
# Get Apple Developer ID certificate
# Add to package.json build config:
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)"
}
```

**Windows:**
```bash
# Get code signing certificate
# Add to package.json:
"win": {
  "certificateFile": "path/to/cert.pfx",
  "certificatePassword": "password"
}
```

---

## Building & Testing

### Step 1: Build the App
```bash
npm run electron:build:mac
```

### Step 2: Test the Installer
```bash
# Open the DMG
open release/Agent\ Max-1.0.0.dmg

# Drag to Applications
# Launch and test
```

### Step 3: Verify Everything Works
- ✅ App launches
- ✅ API connection works
- ✅ Settings persist
- ✅ Screen control works (if enabled)
- ✅ No console errors

---

## Distribution Options

### Option 1: Direct Download (Simple)

**Host the installers on your website:**
```
https://agentmax.app/download/Agent-Max-1.0.0.dmg
https://agentmax.app/download/Agent-Max-Setup-1.0.0.exe
```

**Create a download page:**
```html
<a href="/download/Agent-Max-1.0.0.dmg">
  Download for macOS
</a>
```

### Option 2: GitHub Releases (Free)

1. Create a GitHub release
2. Upload built installers as assets
3. Users download from GitHub

```bash
# Tag and release
git tag v1.0.0
git push origin v1.0.0

# Upload to GitHub Releases
# Attach: Agent Max-1.0.0.dmg, Agent Max Setup 1.0.0.exe
```

### Option 3: Auto-Updates (Advanced)

Use `electron-updater` for automatic updates:

```bash
npm install electron-updater
```

Configure in `electron/main.cjs`:
```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();
```

Host update files on S3/GitHub/your server.

---

## File Size Optimization

### Current Size (Estimated)
- macOS DMG: ~80-120 MB
- Windows installer: ~90-130 MB
- Linux AppImage: ~100-140 MB

### Reduce Size:
```json
// package.json
"build": {
  "compression": "maximum",
  "asar": true,
  "files": [
    "dist/**/*",
    "electron/**/*",
    "!node_modules/**/*"
  ]
}
```

---

## Troubleshooting

### "App is damaged" (macOS)
**Fix:** Code sign the app or user must:
```bash
xattr -cr /Applications/Agent\ Max.app
```

### "Windows protected your PC"
**Fix:** Code sign with EV certificate or user clicks "More info" → "Run anyway"

### App won't launch
**Check:**
1. Node modules bundled correctly
2. Paths are relative (not absolute)
3. API server is running

---

## Production Checklist

Before releasing to users:

- [ ] Version number updated
- [ ] Icons created (all platforms)
- [ ] App tested on clean machine
- [ ] Code signed (recommended)
- [ ] Release notes written
- [ ] Download page created
- [ ] Support email/docs ready
- [ ] Analytics/crash reporting added (optional)

---

## Next Steps

1. **Build for your platform:**
   ```bash
   npm run electron:build:mac
   ```

2. **Test the installer**

3. **Upload to your website or GitHub**

4. **Share the download link!**

Your users can now install Agent Max like any other desktop app! 🎉

App specific password is: fujq-zrci-bnes-wxxq
My email is Colinkobrien@me.com
The apple team ID is Q3Q2BF22GL